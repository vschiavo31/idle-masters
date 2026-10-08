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
test("character names are unique, immutable and ladder exposes only public character fields", async () => {
  const { default: worker } = await import("../worker/index.mjs");
  const { DB, request } = await setup();
  const call = (user, route, nickname) =>
    worker.fetch(
      new Request("https://game.test/api/" + route, {
        method: nickname === undefined ? "GET" : "POST",
        headers: {
          ...(user ? { "oai-authenticated-user-id": user } : {}),
          "content-type": "application/json",
        },
        body: nickname === undefined ? undefined : JSON.stringify({ nickname }),
      }),
      { DB },
    );
  try {
    assert.equal((await call(null, "character", "Hero")).status, 401);
    assert.equal((await call("a", "character", "<script>")).status, 400);
    assert.equal((await call("a", "character", "Hero")).status, 200);
    assert.equal((await call("b", "character", "hERO")).status, 409);
    assert.equal(
      (await (await call("a", "character", "Changed")).json()).profile.nickname,
      "Hero",
    );
    await call("b", "character", "Cra-ami");
    await request("a", "PUT", {
      revision: 0,
      state: { ...state, lv: 5, xp: 1, classId: "iop" },
    });
    await request("b", "PUT", {
      revision: 0,
      state: { ...state, lv: 5, xp: 2, classId: "cra" },
    });
    const entries = (await (await call("a", "ladder")).json()).entries;
    assert.deepEqual(
      entries.map((e) => e.nickname),
      ["Cra-ami", "Hero"],
    );
    assert.equal(entries[1].own, true);
    assert.equal(JSON.stringify(entries).includes("user_id"), false);
    assert.equal(JSON.stringify(entries).includes("bag"), false);
    assert.equal(
      (await request("b", "PUT", { revision: 1, accountKey: "a", state }))
        .status,
      409,
    );
  } finally {
    DB.close();
  }
});
