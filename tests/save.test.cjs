const test = require("node:test"),
  assert = require("node:assert/strict");
const { createDB } = require("./db-helper.cjs");
const state = {
  lv: 3,
  k: 250,
  bag: [{ id: "d2411", uid: 1, st: { Force: 16 } }],
  w: {},
  master: { m36: 20 },
  encounterWins: { "0:0": 10 },
};
async function setup() {
  const { default: worker } = await import("../worker/index.mjs");
  const DB = createDB();
  return {
    DB,
    request: (user, method = "GET", body, extra = {}) =>
      worker.fetch(
        new Request("https://game.test/api/save", {
          method,
          headers: {
            ...(user ? { "oai-authenticated-user-id": user } : {}),
            ...(body ? { "content-type": "application/json" } : {}),
            ...extra,
          },
          body: body ? JSON.stringify(body) : undefined,
        }),
        { DB },
      ),
  };
}
test("durable save survives independent requests and is isolated by authenticated user", async () => {
  const { DB, request } = await setup();
  try {
    assert.equal((await request(null)).status, 401);
    assert.equal((await request("a")).status, 200);
    assert.equal(
      (await request("a", "PUT", { revision: 0, state })).status,
      200,
    );
    const recovered = await (await request("a")).json();
    assert.deepEqual(recovered.state, state);
    assert.equal(recovered.revision, 1);
    assert.equal((await (await request("b")).json()).state, null);
    assert.equal(
      (await request("a", "PUT", { revision: 1, state: { ...state, k: 300 } }))
        .status,
      200,
    );
    assert.equal((await (await request("a")).json()).state.k, 300);
  } finally {
    DB.close();
  }
});
test("stale tabs cannot replace newer saves; invalid and cross-origin writes are rejected", async () => {
  const { DB, request } = await setup();
  try {
    await request("a", "PUT", { revision: 0, state });
    assert.equal(
      (await request("a", "PUT", { revision: 0, state: { ...state, k: 0 } }))
        .status,
      409,
    );
    assert.equal(
      (await request("a", "PUT", { revision: 1, state: {} })).status,
      400,
    );
    assert.equal(
      (
        await request(
          "a",
          "PUT",
          { revision: 1, state },
          { origin: "https://other.test" },
        )
      ).status,
      403,
    );
    assert.equal((await (await request("a")).json()).state.k, 250);
  } finally {
    DB.close();
  }
});
