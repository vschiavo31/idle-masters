const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const root = path.resolve(__dirname, "..");
async function main() {
  const { createDB } = require("./db-helper.cjs");
  const DB = createDB();
  const worker = (await import("../worker/index.mjs")).default;
  const server = http.createServer(async (req, res) => {
    if (new URL(req.url, "http://test").pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const user =
        (req.headers.cookie || "").match(/test-user=([^;]+)/)?.[1] || "test";
      const response = await worker.fetch(
        new Request("http://" + req.headers.host + req.url, {
          method: req.method,
          headers: {
            ...req.headers,
            ...(user === "anonymous"
              ? {}
              : { "oai-authenticated-user-id": user }),
          },
          body: ["PUT", "POST"].includes(req.method)
            ? Buffer.concat(chunks)
            : undefined,
        }),
        { DB },
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    const pathname = decodeURIComponent(
      new URL(req.url, "http://test").pathname,
    );
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const types = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".json": "application/json",
      };
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "text/plain",
      });
      res.end(fs.readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    const browsers = process.env.CHROMIUM_ONLY
      ? [chromium]
      : [chromium, webkit];
    for (const engine of browsers) {
      const options = { headless: true };
      if (engine === chromium && process.env.CHROMIUM_PATH) {
        options.executablePath = process.env.CHROMIUM_PATH;
        options.args = ["--no-sandbox", "--disable-dev-shm-usage"];
      }
      const browser = await engine.launch(options);
      try {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        });
        await page
          .context()
          .addCookies([
            { name: "test-user", value: engine.name(), url: origin },
          ]);
        const errors = [],
          external = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          if (!request.url().startsWith(origin)) external.push(request.url());
        });
        await page.addInitScript(() => {
          if (!localStorage.getItem("legacySeeded")) {
            localStorage.setItem(
              "idleMastersV2",
              JSON.stringify({
                lv: 1,
                k: 123,
                master: { m36: 2 },
                claimed: { first: 1 },
                bag: [
                  { uid: 77, id: "d2411", st: { Force: 16, Intelligence: 16 } },
                ],
                localCombatMigration: 1,
              }),
            );
            localStorage.setItem("legacySeeded", "1");
          }
        });
        // Existing account's durable save must survive the new profile onboarding.
        await DB.prepare(
          "INSERT INTO game_saves (user_id, revision, payload, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT DO NOTHING RETURNING revision",
        )
          .bind(
            engine.name(),
            JSON.stringify({
              lv: 1,
              k: 123,
              w: {},
              bag: [
                { uid: 77, id: "d2411", st: { Force: 16, Intelligence: 16 } },
              ],
              master: { m36: 2 },
              claimed: { first: 1 },
              localCombatMigration: 1,
            }),
            Date.now(),
          )
          .first();
        await page.goto(origin);
        await page.waitForFunction(
          () => document.getElementById("lv").textContent === "1",
        );
        await page.locator("#classSelect").selectOption("cra");
        assert.equal(
          await page.locator("#classPreviewSpells .card").count(),
          8,
        );
        assert.equal(await page.evaluate(() => D.classId), null);
        assert.equal(await page.evaluate(() => D.k), 123);
        await page.locator("#backClassBtn").click();
        await page.locator("#classSelect").selectOption("iop");
        await page
          .locator("#nicknameInput")
          .fill("Aventurier-" + engine.name());
        await page.locator("#confirmClassBtn").click();
        await page.waitForFunction(
          () => D.classId === "iop" && !!GameSave.profile,
        );
        assert.equal(
          await page.locator("#characterName").textContent(),
          "Aventurier-" + engine.name(),
        );
        await page.evaluate(() => show("dashboard"));
        await page.locator("#ladderBtn").click();
        await page.waitForFunction(() =>
          document.getElementById("ladderEntries").textContent.includes("Toi"),
        );
        await page.evaluate(() => show("spellsPage"));
        // Previewing and backing out is free, even when a change is unaffordable.
        await page.locator("#classSelect").selectOption("xelor");
        assert.equal(
          await page.locator("#classPreviewSpells .card").count(),
          8,
        );
        assert.equal(await page.locator("#confirmClassBtn").isDisabled(), true);
        assert.equal(await page.evaluate(() => D.classId), "iop");
        assert.equal(await page.evaluate(() => D.k), 123);
        await page.locator("#backClassBtn").click();
        assert.equal(
          await page.locator('script[src*="bestiary-ui.js"]').count(),
          1,
          "Duplicate bestiary script",
        );
        assert.equal(await page.evaluate(() => M.length), 195);
        assert.equal(
          await page.evaluate(() => D.k),
          123,
          "Legacy kamas preserved",
        );
        assert.equal(
          await page.evaluate(() => D.master.m36),
          2,
          "Legacy victories preserved",
        );
        assert.equal(
          await page.evaluate(() => D.bag.some((q) => q.uid === 77)),
          true,
          "Legacy equipment preserved",
        );
        assert.equal(
          await page.evaluate(() => Object.keys(D.encounterWins).length),
          0,
        );
        await page
          .getByRole("button", { name: "COLLECTION", exact: true })
          .click();
        assert.equal(await page.locator("#achievements .card").count(), 6);
        await page
          .locator("#bestiary details")
          .first()
          .locator("summary")
          .first()
          .click();
        await page.waitForFunction(() =>
          document.querySelector("#bestiary details .card"),
        );
        await page.getByRole("button", { name: "COMBAT", exact: true }).click();
        await page.locator("#mobs button").first().click();
        assert.equal(await page.locator("#mobs button").count(), 3);
        assert.equal(await page.locator("#enemyGroup button").count(), 1);
        assert.equal(
          await page.locator("#combatLevel").textContent(),
          "Niveau 1",
        );
        assert.equal(
          await page.locator("#combatXpTrack").getAttribute("aria-valuenow"),
          "0",
        );
        assert.equal(
          await page.locator("#combatXpTrack").getAttribute("aria-valuemax"),
          "100",
        );
        const firstMob = await page.evaluate(() => D.mid);
        await page.locator("#combatSpells button").first().click();
        assert.equal(
          await page.evaluate(() => mode),
          "fight",
          "Basic spell must not one-shot",
        );
        for (
          let step = 0;
          step < 30 && (await page.evaluate(() => mode === "fight"));
          step++
        ) {
          if (await page.locator("#combatSpells button").first().isEnabled())
            await page.locator("#combatSpells button").first().click();
          else {
            await page
              .getByRole("button", { name: "Fin du tour", exact: true })
              .click();
            await page.waitForFunction(() => D.tr || mode !== "fight");
          }
        }
        await page.waitForFunction(() => mode === "result");
        assert.equal(await page.locator("#resultLevelUp").isVisible(), false);
        assert.equal(
          await page.locator("#combatXpTrack").getAttribute("aria-valuenow"),
          String(await page.evaluate(() => D.xp)),
        );
        assert.equal(await page.evaluate((id) => D.master[id], firstMob), 1);
        assert.equal(await page.evaluate(() => D.encounterWins["0:0"]), 1);
        await page
          .getByRole("button", { name: "Refaire", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Fin du tour", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Quitter", exact: true })
          .click();
        await page.locator("#mobs button").first().click();
        const hp = await page.evaluate(() => D.hp);
        await page.waitForTimeout(400);
        assert.equal(
          await page.evaluate(() => D.hp),
          hp,
          "Stale turn damaged the next fight",
        );
        await page
          .getByRole("button", { name: "Sauvegarder", exact: true })
          .click();
        await page.waitForFunction(() =>
          document
            .getElementById("saveStatus")
            .textContent.startsWith("Sauvegardé"),
        );
        await page.reload();
        await page.waitForFunction(
          () => document.getElementById("lv").textContent !== "",
        );
        assert.equal(
          await page.evaluate((id) => D.master[id], firstMob),
          1,
          "Victory lost on reload",
        );
        // A real three-enemy encounter: target switching, all living enemies attack,
        // and no reward is granted when the player abandons the fight.
        await page.getByRole("button", { name: "COMBAT", exact: true }).click();
        await page.locator("#mobs button").nth(2).click();
        assert.equal(await page.locator("#enemyGroup button").count(), 3);
        await page.locator("#enemyGroup button").nth(1).click();
        assert.equal(await page.evaluate(() => targetIndex), 1);
        const hpBefore = await page.evaluate(() => D.hp);
        await page
          .getByRole("button", { name: "Fin du tour", exact: true })
          .click();
        await page.waitForFunction(() => D.rd === 2);
        assert.ok((await page.evaluate(() => D.hp)) < hpBefore);
        assert.equal(await page.locator("#log div").count(), 3);
        await page
          .getByRole("button", { name: "Quitter", exact: true })
          .click();
        assert.equal(await page.evaluate(() => D.encounterWins["0:2"] || 0), 0);
        for (const width of [320, 390, 430]) {
          await page.setViewportSize({ width, height: 844 });
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            "Horizontal overflow at " + width,
          );
          assert.equal(
            await page.evaluate(() =>
              [...document.querySelectorAll(".nav button")].every(
                (b) => b.getBoundingClientRect().right <= innerWidth,
              ),
            ),
            true,
            "Navigation exceeds screen at " + width,
          );
        }
        // Verify actual level-up results and the reset XP bar, without replaying long fights.
        for (const wisdom of [0, 1000]) {
          await page.evaluate((w) => {
            D.lv = 1;
            D.xp = 99;
            D.inv.Sagesse = w;
            startEncounter(0, 2);
            encounter.members.forEach((e) => (e.hp = 0));
            victory();
          }, wisdom);
          const levels = await page.evaluate(() => lastResult.levelsGained);
          assert.equal(wisdom === 0 ? levels === 1 : levels > 1, true);
          assert.equal(await page.locator("#resultLevelUp").isVisible(), true);
          assert.ok(
            (await page.locator("#resultLevelUp").textContent()).includes(
              "+" + levels + " niveau",
            ),
          );
          assert.equal(
            await page.locator("#combatLevel").textContent(),
            "Niveau " + (await page.evaluate(() => D.lv)),
          );
          assert.equal(
            await page.locator("#combatXpTrack").getAttribute("aria-valuenow"),
            String(await page.evaluate(() => D.xp)),
          );
          assert.equal(
            await page.locator("#combatXpTrack").getAttribute("aria-valuemax"),
            String(await page.evaluate(() => need(D.lv))),
          );
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          await page.locator("#changeZone").click();
        }
        await page.evaluate(() => {
          D.inv.Sagesse = 0;
          startEncounter(0, 0);
          D.xp = 0;
          encounter.members.forEach((e) => (e.hp = 0));
          victory();
        });
        assert.equal(
          await page.locator("#resultLevelUp").isVisible(),
          false,
          "Previous level-up message must disappear",
        );
        await page.locator("#changeZone").click();
        // All 19 classes: level gates, actual casts of all 152 spells, and class lock during fights.
        await page.evaluate(() => {
          M.forEach((m) => (m.h += 10000));
          D.k = 500000;
        });
        const classIds = await page.evaluate(() => CLASSES.map((c) => c.id));
        for (const id of classIds) {
          await page
            .getByRole("button", { name: "SORTS", exact: true })
            .click();
          await page.locator("#classSelect").selectOption(id);
          const same = await page.evaluate((id) => D.classId === id, id);
          const bank = await page.evaluate(() => D.k);
          assert.equal(
            await page.locator("#classPreviewSpells .card").count(),
            8,
          );
          if (!same) await page.locator("#confirmClassBtn").click();
          else await page.locator("#backClassBtn").click();
          assert.equal(
            await page.evaluate(() => D.k),
            bank - (same ? 0 : 20000),
          );
          await page.evaluate(() => {
            D.lv = 1;
            render();
          });
          assert.equal(await page.locator("#spellList .card").count(), 8);
          assert.equal(await page.locator("#spellList .locked").count(), 6);
          await page.evaluate(() => {
            D.lv = 39;
            render();
          });
          assert.equal(await page.locator("#spellList .locked").count(), 1);
          await page.evaluate(() => {
            D.lv = 40;
            D.z = 0;
            render();
          });
          assert.equal(await page.locator("#spellList .locked").count(), 0);
          await page
            .getByRole("button", { name: "COMBAT", exact: true })
            .click();
          await page.locator("#mobs button").nth(2).click();
          for (let i = 0; i < 8; i++) {
            await page.evaluate((i) => {
              PA = maxpa();
              effects.casts = {};
              effects.cooldowns = {};
              effects.summons = [];
              if (spellBook()[i].kind === "heal") D.hp = Math.floor(mh() / 2);
              if (spellBook()[i].kind === "detonate") {
                cast(1);
                PA = maxpa();
              }
              render();
            }, i);
            const rows = await page.locator("#log div").count();
            await page
              .locator(`#combatSpells button[data-spell="${i}"]`)
              .click();
            assert.ok(
              (await page.locator("#log div").count()) > rows,
              id + " spell " + i + " did not resolve",
            );
          }
          await page
            .getByRole("button", { name: "SORTS", exact: true })
            .click();
          assert.equal(await page.locator("#classSelect").isDisabled(), true);
          await page
            .getByRole("button", { name: "COMBAT", exact: true })
            .click();
          await page.locator("#backMob").click();
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
        }
        await page.evaluate(() => {
          M.forEach((m) => (m.h -= 10000));
        });
        await page.evaluate(() => {
          delete D.spellRanks[spellBook()[0].id];
          show("spellsPage");
        });
        const upgrade = page.locator('#spellList .card[data-spell="0"] button');
        for (let cost = 1; cost <= 5; cost++) {
          await page.evaluate((cost) => {
            D.spellPts = cost - 1;
            render();
          }, cost);
          assert.equal(await upgrade.isDisabled(), true);
          assert.equal(
            (await upgrade.textContent()).includes(String(cost) + " point"),
            true,
          );
          await page.evaluate((cost) => {
            D.spellPts = cost;
            render();
          }, cost);
          await upgrade.click();
          assert.equal(await page.evaluate(() => D.spellPts), 0);
          assert.equal(await page.evaluate(() => spellRank(0)), cost + 1);
        }
        assert.equal(await upgrade.textContent(), "Rang 6 · maximum");
        assert.equal(await upgrade.isDisabled(), true);
        assert.equal(
          (
            await page.locator('#spellList .card[data-spell="0"]').textContent()
          ).includes("6/6"),
          true,
        );
        // Ten hard wins unlock exactly the next displayed zone; level cannot bypass it.
        const gateBackup = await page.evaluate(() => D.encounterWins);
        await page.evaluate(() => {
          D.encounterWins = {};
          D.z = 0;
          show("combat");
        });
        const order = await page.evaluate(() => ZONE_ORDER);
        assert.equal(await page.locator("#zones button:enabled").count(), 1);
        await page.evaluate(() => {
          D.encounterWins["0:0"] = 100;
          D.encounterWins["0:1"] = 100;
          D.encounterWins["0:2"] = 9;
          render();
        });
        assert.equal(
          await page
            .locator(`#zones button[data-zone="${order[1]}"]`)
            .isEnabled(),
          false,
        );
        await page.evaluate(() => {
          D.encounterWins["0:2"] = 10;
          render();
        });
        await page.locator(`#zones button[data-zone="${order[1]}"]`).click();
        assert.equal(await page.evaluate(() => D.z), order[1]);
        await page.evaluate((backup) => {
          D.encounterWins = backup;
          ZONE_ORDER.forEach((id) => (D.encounterWins[id + ":2"] = 10));
          render();
        }, gateBackup);
        await page.evaluate(() => show("inventory"));
        for (const sort of ["levelAsc", "levelDesc", "jetAsc", "jetDesc"]) {
          await page.locator("#bagSort").selectOption(sort);
          assert.equal(await page.evaluate(() => D.inventorySort), sort);
          const values = await page
            .locator("#bag .item")
            .evaluateAll(
              (items, sort) =>
                items.map((item) =>
                  Number(
                    item
                      .querySelector(
                        sort.startsWith("level") ? ".eyebrow" : ".itemHead > b",
                      )
                      .textContent.match(/(?:Niv\. |Jet )(\d+)/)[1],
                  ),
                ),
              sort,
            );
          assert.equal(
            values.every(
              (v, i) =>
                !i ||
                (sort.endsWith("Asc")
                  ? v >= values[i - 1]
                  : v <= values[i - 1]),
            ),
            true,
          );
        }
        await page.evaluate(() => {
          for (const slot of INVENTORY_SLOTS) {
            const id = Object.keys(I).find((id) => meta(id).s === slot);
            D.bag.push(roll(id));
          }
          show("inventory");
        });
        await page.locator("#bagNone").click();
        assert.equal(await page.locator("#bag .item").count(), 0);
        await page.locator('#bagFilters input[value="Anneau"]').check();
        assert.equal((await page.locator("#bag .item").count()) > 0, true);
        assert.equal(
          await page
            .locator("#bag .item .eyebrow")
            .evaluateAll((items) =>
              items.every((item) => item.textContent.startsWith("Anneau")),
            ),
          true,
        );
        await page.locator('#bagFilters input[value="Cape"]').check();
        assert.equal(
          await page
            .locator("#bag .item .eyebrow")
            .evaluateAll((items) =>
              items.every((item) => /^(Anneau|Cape)/.test(item.textContent)),
            ),
          true,
        );
        await page.locator('#bagFilters input[value="Anneau"]').uncheck();
        assert.equal(
          await page
            .locator("#bag .item .eyebrow")
            .evaluateAll((items) =>
              items.every((item) => item.textContent.startsWith("Cape")),
            ),
          true,
        );
        // Locking an item excludes it from selection and every sale path.
        const saleFixture = await page.evaluate(() => {
          const id = Object.keys(I).find((id) => meta(id).s === "Cape");
          const locked = roll(id),
            sold = roll(id),
            sold2 = roll(id);
          D.bag.push(locked, sold, sold2);
          show("inventory");
          return {
            locked: locked.uid,
            sold: sold.uid,
            sold2: sold2.uid,
            k: D.k,
          };
        });
        const lockedCard = page.locator(
          `#bag .item[data-uid="${saleFixture.locked}"]`,
        );
        await lockedCard
          .getByRole("button", { name: "Verrouiller", exact: true })
          .click();
        assert.equal(
          await lockedCard
            .getByRole("button", { name: "Vendre · 5 K", exact: true })
            .isDisabled(),
          true,
        );
        assert.equal(
          await lockedCard.locator(".saleChoice input").isDisabled(),
          true,
        );
        const soldCard = page.locator(
          `#bag .item[data-uid="${saleFixture.sold}"]`,
        );
        await soldCard.locator(".saleChoice input").check();
        await page
          .locator(
            `#bag .item[data-uid="${saleFixture.sold2}"] .saleChoice input`,
          )
          .check();
        await page.locator("#sellSelected").click();
        assert.equal(await page.evaluate(() => D.k), saleFixture.k);
        assert.equal(
          (await page.locator("#saleMessage").textContent()).includes(
            "2 objet(s) · 10 kamas",
          ),
          true,
        );
        await page.locator("#cancelSale").click();
        assert.equal(await soldCard.count(), 1);
        await page.locator("#sellSelected").click();
        await page.locator("#confirmSale").click();
        assert.equal(await soldCard.count(), 0);
        assert.equal(await page.evaluate(() => D.k), saleFixture.k + 10);
        assert.equal(await lockedCard.count(), 1);
        await page.locator("#selectSaleVisible").click();
        assert.equal(
          await lockedCard.locator(".saleChoice input").isChecked(),
          false,
        );
        await page.locator("#clearSaleSelection").click();
        assert.equal(await page.locator("#sellSelected").isDisabled(), true);
        // Lock stays attached to the same item through equip, removal and reload.
        await lockedCard
          .getByRole("button", { name: "Équiper", exact: true })
          .click();
        assert.equal(await page.evaluate(() => D.w.Cape.locked), true);
        await page.evaluate(() => {
          uneq("Cape");
          checkAch();
          render();
        });
        await page.locator("#sellSelected").isDisabled();
        const statsBackup = await page.evaluate(() => ({
          inv: D.inv,
          pts: D.pts,
        }));
        await page.evaluate(() => {
          D.inv = { Terre: 0, Feu: 0, Eau: 0, Air: 0, Neutre: 0, Sagesse: 0 };
          D.pts = 100;
          for (let i = 0; i < 51; i++) spend("Terre");
          for (let i = 0; i < 3; i++) spend("Sagesse");
          show("dashboard");
        });
        await page.locator("#resetStatsBtn").click();
        await page.locator("#cancelResetStats").click();
        assert.equal(await page.evaluate(() => D.inv.Terre), 51);
        await page.locator("#resetStatsBtn").click();
        await page.locator("#confirmResetStats").click();
        assert.equal(await page.evaluate(() => D.pts), 100);
        assert.equal(
          await page.evaluate(() => Object.values(D.inv).every((v) => v === 0)),
          true,
        );
        assert.equal(await page.locator("#resetStatsBtn").isDisabled(), true);
        await page.evaluate((backup) => {
          Object.assign(D, backup);
          show("combat");
        }, statsBackup);
        // Catalogue choices, empty draft, validation and level cap on the real mobile UI.
        await page.evaluate(() => show("collection"));
        await page.locator("#openRosterSelection").click();
        await page.waitForFunction(() =>
          document.getElementById("rosterCount").textContent.includes("1692"),
        );
        assert.equal(await page.locator("#rosterZone option").count(), 433);
        assert.equal(
          await page.evaluate(() => D.rosterDraft.selectedIds.length),
          169,
        );
        // Simulate an already-validated draft created before the exclusion policy.
        await page.evaluate(() => {
          D.rosterDraft = {
            sourceVersion: "3.7.4.4",
            selectedIds: [36, 4785, 168, 2270, 101, 98],
            validated: true,
          };
          save();
        });
        await page.evaluate(() => GameSave.flush());
        await page.reload();
        await page.waitForFunction(() => !!M.length);
        await page.evaluate(() => show("rosterSelection"));
        await page.waitForFunction(
          () =>
            D.rosterDraft.exclusionPolicy ===
            "no-archmonsters-summons-quests-v1",
        );
        assert.deepEqual(
          await page.evaluate(() => D.rosterDraft.selectedIds),
          [101, 98],
        );
        assert.equal(await page.evaluate(() => D.rosterDraft.validated), false);
        await page.evaluate(() => GameSave.flush());
        await page.reload();
        await page.waitForFunction(() => !!M.length);
        await page.evaluate(() => show("rosterSelection"));
        await page.waitForFunction(() =>
          document.querySelector("#rosterList input"),
        );
        assert.deepEqual(
          await page.evaluate(() => D.rosterDraft.selectedIds),
          [101, 98],
        );
        const firstCheckbox = page.locator("#rosterList input").first();
        const mid = Number(await firstCheckbox.getAttribute("data-monster"));
        const checked = await firstCheckbox.isChecked();
        await firstCheckbox.setChecked(!checked);
        await page.evaluate(() => GameSave.flush());
        await page.reload();
        await page.waitForFunction(() => !!M.length);
        await page.evaluate(() => show("rosterSelection"));
        await page.waitForFunction(() =>
          document.querySelector("#rosterList input"),
        );
        assert.equal(
          await page.evaluate(
            (id) => D.rosterDraft.selectedIds.includes(id),
            mid,
          ),
          !checked,
        );
        await page.evaluate(() => {
          D.rosterDraft.selectedIds = [];
          D.rosterDraft.validated = false;
          save();
        });
        await page.evaluate(() => GameSave.flush());
        await page.reload();
        await page.waitForFunction(() => !!M.length);
        await page.evaluate(() => show("rosterSelection"));
        await page.waitForFunction(() =>
          document.getElementById("rosterCount").textContent.startsWith("0 /"),
        );
        assert.equal(
          await page.locator("#rosterList input:checked").count(),
          0,
        );
        await page.locator("#rosterSearch").fill("Bouftou");
        assert.ok((await page.locator("#rosterList input").count()) > 0);
        await page.locator("#rosterList input").first().check();
        await page.locator("#rosterValidate").click();
        await page.waitForFunction(
          () => D.rosterDraft.validated && GameSave.confirmed,
        );
        assert.equal(
          await page.evaluate(() => D.rosterDraft.selectedIds.length),
          1,
        );
        const capBackup = await page.evaluate(() => ({
          lv: D.lv,
          xp: D.xp,
          pts: D.pts,
          bh: D.bh,
          spellPts: D.spellPts,
        }));
        await page.evaluate(() => {
          D.lv = 200;
          D.xp = 0;
          gainxp(9999);
          show("combat");
        });
        assert.ok(
          (await page.locator("#combatXpText").textContent()).includes(
            "maximum atteint",
          ),
        );
        assert.equal(await page.evaluate(() => D.xp), 0);
        await page.evaluate((backup) => {
          Object.assign(D, backup);
          render();
        }, capBackup);
        // Open every added zone and all three difficulties through the mobile controls.
        await page.evaluate(() => {
          D.lv = 40;
          render();
        });
        assert.equal(await page.locator("#zones button").count(), 25);
        for (let zone = 4; zone < 25; zone++) {
          await page.locator(`#zones button[data-zone="${zone}"]`).click();
          for (let tier = 0; tier < 3; tier++) {
            await page.locator("#mobs button").nth(tier).click();
            assert.equal(
              await page.locator("#enemyGroup button").count(),
              tier + 1,
            );
            assert.equal(
              await page.evaluate(
                (z) =>
                  encounter.members.every(
                    (e) => M.find((m) => m.id === e.id).z === z,
                  ),
                zone,
              ),
              true,
            );
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
              ),
              false,
            );
            await page.locator("#backMob").click();
          }
        }
        await page
          .getByRole("button", { name: "INVENTAIRE", exact: true })
          .click();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        // Close the original session entirely, then recover from the server in a
        // fresh session where Safari-like browser storage is unavailable.
        // Fixture gear also earns collection rewards, just as a real victory would.
        await page.evaluate(() => {
          checkAch();
          render();
        });
        const kept = await page.evaluate(() => ({
          k: D.k,
          bag: D.bag.length,
          wins: D.encounterWins["0:0"],
          level: D.lv,
          zone: D.z,
          classId: D.classId,
          spellRanks: D.spellRanks,
          inventorySort: D.inventorySort,
          inventorySlots: D.inventorySlots,
          locks: D.bag.filter((q) => q.locked).map((q) => q.uid),
        }));
        await page
          .getByRole("button", { name: "Sauvegarder", exact: true })
          .click();
        await page.waitForFunction(() =>
          document
            .getElementById("saveStatus")
            .textContent.startsWith("Sauvegardé"),
        );
        await page.context().close();
        const recovered = await browser.newContext({
          viewport: { width: 390, height: 844 },
        });
        await recovered.addCookies([
          { name: "test-user", value: engine.name(), url: origin },
        ]);
        await recovered.addInitScript(() => {
          Storage.prototype.getItem = () => {
            throw new DOMException("Blocked", "SecurityError");
          };
          Storage.prototype.setItem = () => {
            throw new DOMException("Blocked", "SecurityError");
          };
        });
        const reopened = await recovered.newPage();
        reopened.on("pageerror", (e) => errors.push(e.message));
        await reopened.goto(origin);
        await reopened.waitForFunction(
          () => document.getElementById("lv").textContent !== "",
        );
        assert.deepEqual(
          await reopened.evaluate(() => ({
            k: D.k,
            bag: D.bag.length,
            wins: D.encounterWins["0:0"],
            level: D.lv,
            zone: D.z,
            classId: D.classId,
            spellRanks: D.spellRanks,
            inventorySort: D.inventorySort,
            inventorySlots: D.inventorySlots,
            locks: D.bag.filter((q) => q.locked).map((q) => q.uid),
          })),
          kept,
        );
        await reopened.evaluate(() => {
          D.k += 7;
          save();
        });
        await reopened
          .getByRole("button", { name: "Sauvegarder", exact: true })
          .click();
        await reopened.waitForFunction(() =>
          document
            .getElementById("saveStatus")
            .textContent.startsWith("Sauvegardé"),
        );
        await reopened.reload();
        await reopened.waitForFunction(
          () => document.getElementById("lv").textContent !== "",
        );
        assert.equal(await reopened.evaluate(() => D.k), kept.k + 7);
        await recovered.close();
        // Switching accounts in the same browser must not import the former save.
        const isolated = await browser.newContext({
          viewport: { width: 320, height: 700 },
        });
        await isolated.addCookies([
          { name: "test-user", value: "new-" + engine.name(), url: origin },
        ]);
        const fresh = await isolated.newPage();
        fresh.on("pageerror", (e) => errors.push(e.message));
        await fresh.addInitScript(() =>
          localStorage.setItem(
            "idleMastersV2",
            JSON.stringify({
              lv: 40,
              k: 999999,
              bag: [{ uid: 88 }],
              w: {},
              classId: "iop",
            }),
          ),
        );
        await fresh.goto(origin);
        await fresh.waitForFunction(
          () => document.getElementById("lv").textContent === "1",
        );
        assert.equal(await fresh.evaluate(() => D.classId), null);
        assert.equal(await fresh.evaluate(() => D.bag.length), 0);
        await fresh.locator("#classSelect").selectOption("cra");
        await fresh
          .locator("#nicknameInput")
          .fill("Aventurier-" + engine.name());
        await fresh.locator("#confirmClassBtn").click();
        await fresh.waitForFunction(() =>
          document
            .getElementById("characterError")
            .textContent.includes("déjà pris"),
        );
        assert.equal(await fresh.evaluate(() => D.classId), null);
        await fresh.locator("#nicknameInput").fill("Nouvel-" + engine.name());
        await fresh.locator("#confirmClassBtn").click();
        await fresh.waitForFunction(
          () => D.classId === "cra" && !!GameSave.profile,
        );
        await fresh.evaluate(() => show("dashboard"));
        await fresh.locator("#ladderBtn").click();
        await fresh.waitForFunction(() =>
          document
            .getElementById("ladderEntries")
            .textContent.includes("Nouvel-"),
        );
        assert.equal(
          await fresh.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await isolated.addCookies([
          { name: "test-user", value: "anonymous", url: origin },
        ]);
        await fresh.reload();
        await fresh.waitForFunction(
          () => !document.getElementById("authGate").hidden,
        );
        assert.equal(await fresh.locator("#saveNow").isDisabled(), true);
        await fresh.getByRole("button", { name: "Voir le ladder" }).click();
        await fresh.waitForFunction(() =>
          document
            .getElementById("ladderEntries")
            .textContent.includes("Nouvel-"),
        );
        assert.equal(
          await fresh
            .locator('a[href^="/signin-with-chatgpt"]')
            .getAttribute("target"),
          "_top",
        );
        await isolated.close();
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        console.log(
          engine.name() +
            ": mobile boot, collection, combat, save, reload and navigation passed",
        );
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    DB.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
