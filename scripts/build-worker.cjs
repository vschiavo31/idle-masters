const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "dist");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "server"), { recursive: true });
fs.mkdirSync(path.join(out, ".openai"), { recursive: true });
const files = [
  "index.html",
  "game.js",
  "world-data.js",
  "game-world.json",
  "extra-equipment.json",
  "roster-selection.js",
  "monster-catalogue.json",
  "classes.js",
  "combat-effects.js",
  "saving.js",
  "local-data.js",
  "bestiary-ui.js",
  "dofus-bestiary-1-40.json",
  "dofus-equipment-1-40.json",
  "dofus-item-sets.json",
];
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};
const assets = Object.fromEntries(
  files.map((file) => [
    "/" + file,
    {
      body: fs.readFileSync(path.join(root, file), "utf8"),
      type: types[path.extname(file)],
    },
  ]),
);
fs.writeFileSync(
  path.join(out, "server", "index.js"),
  "const SITE_ASSETS=" +
    JSON.stringify(assets) +
    ";\n" +
    fs.readFileSync(path.join(root, "worker", "index.mjs"), "utf8"),
);
fs.copyFileSync(
  path.join(root, ".openai", "hosting.json"),
  path.join(out, ".openai", "hosting.json"),
);
if (fs.existsSync(path.join(root, "drizzle")))
  fs.cpSync(path.join(root, "drizzle"), path.join(out, "drizzle"), {
    recursive: true,
  });
console.log("Built game and durable save API");
