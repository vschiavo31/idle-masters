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
    if (new URL(req.url, "http://test").pathname === "/api/save") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const user =
        (req.headers.cookie || "").match(/test-user=([^;]+)/)?.[1] || "test";
      const response = await worker.fetch(
        new Request("http://" + req.headers.host + req.url, {
          method: req.method,
          headers: { ...req.headers, "oai-authenticated-user-id": user },
          body: req.method === "PUT" ? Buffer.concat(chunks) : undefined,
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
        await page.goto(origin);
        await page.waitForFunction(
          () => document.getElementById("lv").textContent === "1",
        );
        await page.locator("#classSelect").selectOption("iop");
        await page.locator("#chooseClassBtn").click();
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
        });
        const classIds = await page.evaluate(() => CLASSES.map((c) => c.id));
        for (const id of classIds) {
          await page
            .getByRole("button", { name: "SORTS", exact: true })
            .click();
          await page.locator("#classSelect").selectOption(id);
          if (await page.locator("#chooseClassBtn").isEnabled())
            await page.locator("#chooseClassBtn").click();
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
          D.spellPts += 1;
          upSpell(0);
        });
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
        const kept = await page.evaluate(() => ({
          k: D.k,
          bag: D.bag.length,
          wins: D.encounterWins["0:0"],
          level: D.lv,
          zone: D.z,
          classId: D.classId,
          spellRanks: D.spellRanks,
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
