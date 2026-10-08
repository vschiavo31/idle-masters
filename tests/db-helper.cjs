const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
function createDB() {
  const db = new DatabaseSync(":memory:");
  const dir = path.resolve(__dirname, "../drizzle");
  for (const file of fs
    .readdirSync(dir)
    .filter((x) => x.endsWith(".sql"))
    .sort())
    db.exec(fs.readFileSync(path.join(dir, file), "utf8"));
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              return { results: db.prepare(sql).all(...args) };
            },
            async first() {
              return db.prepare(sql).get(...args) || null;
            },
          };
        },
      };
    },
    close() {
      db.close();
    },
  };
}
module.exports = { createDB };
