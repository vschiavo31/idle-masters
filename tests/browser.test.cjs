const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const root = path.resolve(__dirname, "..");
async function main() {
  const server = http.createServer((req, res) => {
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
        const errors = [],
          external = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          if (!request.url().startsWith(origin)) external.push(request.url());
        });
        await page.goto(origin);
        await page.waitForFunction(
          () => document.getElementById("lv").textContent === "1",
        );
        assert.equal(
          await page.locator('script[src*="bestiary-ui.js"]').count(),
          1,
          "Duplicate bestiary script",
        );
        assert.equal(await page.evaluate(() => M.length), 21);
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
        await page.locator("#combatSpells button").first().click();
        if (await page.evaluate(() => mode === "fight"))
          await page.locator("#combatSpells button").first().click();
        await page.waitForFunction(() => mode === "result");
        assert.equal(await page.evaluate(() => D.master.m4785), 1);
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
        await page.reload();
        await page.waitForFunction(
          () => document.getElementById("lv").textContent !== "",
        );
        assert.equal(
          await page.evaluate(() => D.master.m4785),
          1,
          "Victory lost on reload",
        );
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
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
