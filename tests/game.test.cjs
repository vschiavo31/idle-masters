const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = (p) => fs.readFileSync(p, "utf8");
const data = (p) => JSON.parse(read(p));
function game() {
  const c = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    localStorage: { setItem() {} },
    GameSave: { queue() {} },
    document: {
      getElementById() {
        return { innerHTML: "", prepend() {} };
      },
      createElement() {
        return {};
      },
    },
  });
  vm.runInContext(read("local-data.js"), c);
  const src = read("game.js");
  vm.runInContext(src.slice(0, src.indexOf("function show(")), c);
  c.eq = data("dofus-equipment-1-40.json");
  c.sets = data("dofus-item-sets.json");
  c.monsters = data("dofus-bestiary-1-40.json").monsters;
  vm.runInContext(
    "buildLocalData(eq,sets);M=buildCombatData(monsters);render=()=>{};",
    c,
  );
  return { c, run: (s) => vm.runInContext(s, c) };
}
test("combat records share source IDs, levels, HP; roster avoids unselected entries", () => {
  const { run } = game();
  assert.equal(run("M.length"), 195);
  assert.equal(
    run(
      "M.every(m=>monsters.some(x=>x.id===m.sourceId&&x.name===m.n&&x.hpMin===m.h&&x.minLevel===m.l))",
    ),
    true,
  );
  assert.equal(run('M.some(m=>m.n.includes("invoqué"))'), false);
});
test("highest set tier only and duplicate rings counted once", () => {
  const { run } = game();
  run(
    "I.a=['a','Anneau','setTest',1,{},1,1];I.b=['b','Cape','setTest',1,{},1,2];SET.setTest={2:{Force:5},3:{Force:10}};D.w={Anneau1:{id:'a',st:{}},Anneau2:{id:'a',st:{}},Cape:{id:'b',st:{}}}",
  );
  assert.equal(run("sb().Force"), 5);
  run("I.c=['c','Bottes','setTest',1,{},1,3];D.w.Bottes={id:'c',st:{}};");
  assert.equal(run("sb().Force"), 10);
});
test("displayed drop rates equal the real equipment gate over the full pool", () => {
  const { run } = game();
  assert.equal(run("M.every(m=>mobDrops(m).length>0)"), true);
  assert.ok(
    Math.abs(run("mobDrops(M[0]).reduce((n,id)=>n+dropRate(id,M[0]),0)") - 30) <
      1e-9,
  );
  run("D.w={Amulette:{id:'d70',st:{Prospection:1000}}}");
  assert.equal(run("equipmentChance()"), 72);
  run("D.mid=M[0].id;Math.random=()=>0;");
  assert.equal(run("loot().length"), 1);
  assert.equal(run("D.bag.length"), 1);
});
test("equipment respects level and slot; no item loss when refused", () => {
  const { run } = game();
  run("D.bag=[{uid:1,id:'d70',st:{Intelligence:10}}];D.lv=1;equip(1)");
  assert.equal(run("D.bag.length"), 1);
  assert.equal(run("D.w.Amulette"), null);
  run("D.lv=8;equip(1,'Cape')");
  assert.equal(run("D.bag.length"), 1);
  run("equip(1)");
  assert.equal(run("D.bag.length"), 0);
  assert.equal(run("D.w.Amulette.uid"), 1);
});
test("migration preserves unknown items, old wins and moves high-level worn gear to bag", () => {
  const { run } = game();
  run(
    "D.master={tofu:10,m4785:2,oak:4};D.mid='tofu';D.bag=[{uid:8,id:'unknown',st:{}}];D.w.Amulette={uid:9,id:'d70',st:{Intelligence:10}};migrateCombatSave(D,M)",
  );
  assert.equal(run("D.master.m4785"), 12);
  assert.equal(run("wins()"), 16);
  assert.equal(run("D.mid"), "m4785");
  assert.equal(run("D.bag.length"), 2);
  assert.equal(run("D.w.Amulette"), null);
  assert.equal(run("D.uid"), 10);
});
test("progression gates and existing unlocked zones", () => {
  const { run } = game();
  assert.equal(run("zoneOpen(1)"), false);
  run("D.master.m4785=10");
  assert.equal(run("!!zoneOpen(1)"), true);
  run("D.master.m489=10");
  assert.equal(run("!!zoneOpen(2)"), true);
  run("D.master.m147=1");
  assert.equal(run("!!zoneOpen(3)"), true);
});

test("family drops are exact, complete and never leak into unrelated families", () => {
  const { run } = game();
  const cases = [
    [36, 1, 6],
    [101, 1, 6],
    [148, 1, 6],
    [147, 4, 6],
    [4785, 50, 6],
    [489, 60, 6],
    [491, 61, 6],
    [236, 62, 6],
    [492, 70, 6],
    [493, 71, 6],
    [490, 72, 6],
    [52, 22, 3],
    [61, 23, 4],
    [31, 33, 4],
    [103, 31, 4],
    [104, 21, 3],
  ];
  for (const [id, setId, count] of cases) {
    assert.equal(run(`lootPool(M.find(m=>m.sourceId===${id})).length`), count);
    assert.equal(
      run(
        `lootPool(M.find(m=>m.sourceId===${id})).every(x=>x.setId===${setId})`,
      ),
      true,
    );
    assert.ok(
      Math.abs(
        run(
          `mobDrops(M.find(m=>m.sourceId===${id})).reduce((n,item)=>n+dropRate(item,M.find(m=>m.sourceId===${id})),0)`,
        ) - 30,
      ) < 1e-9,
    );
  }
  assert.equal(run("mobDrops(M.find(m=>m.sourceId===54)).join()"), "d458");
  assert.equal(
    run("lootPool(M.find(m=>m.sourceId===36)).some(x=>x.level===20)"),
    true,
    "Bouftou level 1 can drop all Bouftou pieces",
  );
  assert.equal(
    run("dropRate('d8214',M.find(m=>m.sourceId===489))"),
    0,
    "Red Piou never drops blue Piou equipment",
  );
});
test("actual rolls reach every family piece and preserve the no-drop chance", () => {
  const { run } = game();
  run('D.mid="m36";Math.random=()=>0.9');
  assert.equal(run("loot().length"), 0);
  for (let index = 0; index < 6; index++) {
    run(
      `let calls${index}=0;Math.random=()=>++calls${index}===1?0:(calls${index}===2?${(index + 0.5) / 6}:0);`,
    );
    assert.equal(run("loot()[0].id"), run(`mobDrops(mob())[${index}]`));
  }
  assert.equal(run("new Set(D.bag.map(q=>q.id)).size"), 6);
});

test("every zone has increasing groups, correct species, and actual random variants", () => {
  const { run } = game();
  for (let zone = 0; zone < run("Z.length"); zone++)
    for (let tier = 0; tier < 3; tier++) {
      assert.equal(
        run(`rollEncounter(${zone},${tier},()=>0).length`),
        tier + 1,
      );
      assert.equal(
        run(
          `rollEncounter(${zone},${tier},()=>0).every(id=>M.some(m=>m.id===id&&m.z===${zone}))`,
        ),
        true,
      );
    }
  assert.equal(run("rollEncounter(2,2,()=>0).join()"), "m134,m101,m148");
  assert.equal(run("rollEncounter(2,2,()=>0.999).join()"), "m149,m4822,m148");
  assert.notEqual(
    run("rollEncounter(0,0,()=>0).join()"),
    run("rollEncounter(0,0,()=>0.999).join()"),
  );
  for (let z = 0; z < run("Z.length"); z++) {
    const low = run(
      `ENCOUNTER_TIERS[${z}].map(slots=>slots.reduce((n,pool)=>n+Math.min(...pool.map(id=>M.find(m=>m.sourceId===id).h)),0))`,
    );
    const high = run(
      `ENCOUNTER_TIERS[${z}].map(slots=>slots.reduce((n,pool)=>n+Math.max(...pool.map(id=>M.find(m=>m.sourceId===id).h)),0))`,
    );
    assert.ok(low[1] > high[0] && low[2] > high[1]);
  }
});
test("basic unmodified spells cannot one-shot level-one Tofu", () => {
  const { run } = game();
  assert.equal(run('BASE.filter(s=>s[5]==="dmg").every(s=>s[4]<17)'), true);
  run('Math.random=()=>0.999;startFight("m4785");cast(0)');
  assert.equal(run("D.eh"), 9);
  assert.equal(run("mode"), "fight");
  run("cast(0)");
  assert.equal(run("D.eh"), 1);
  assert.equal(run("D.master.m4785||0"), 0);
  run("PA=3;cast(0)");
  assert.equal(run("mode"), "result");
  assert.equal(run("D.master.m4785"), 1);
});
test("target HP is independent and full-group victory pays each enemy exactly once", () => {
  const { run } = game();
  run("Math.random=()=>0;startEncounter(0,2);D.inv.Terre=1000;cast(0)");
  assert.equal(run("encounter.members[0].hp"), 0);
  assert.equal(run("targetIndex"), 1);
  assert.equal(run("D.master.m4785||0"), 0);
  assert.equal(run("D.xp"), 0);
  assert.equal(run("D.bag.length"), 0);
  run("selectTarget(2);cast(0)");
  assert.equal(run("encounter.members[2].hp"), 0);
  assert.equal(run("targetIndex"), 1);
  assert.equal(run("D.eh"), 29);
  run("PA=3;cast(0)");
  assert.equal(run("mode"), "result");
  assert.equal(run('D.encounterWins["0:2"]'), 1);
  assert.equal(run("D.master.m4785+D.master.m36+D.master.m4561"), 3);
  assert.equal(run("D.bag.length"), 3);
  assert.equal(run("lastResult.ids.length"), 3);
  run("victory()");
  assert.equal(run("D.bag.length"), 3);
  assert.equal(run('D.encounterWins["0:2"]'), 1);
});
test("dead enemies do not attack and group auto progress is separate from individual kills", async () => {
  const { run } = game();
  run(
    "Math.random=()=>0;startEncounter(0,2);encounter.members[0].hp=0;selectTarget(1,true);enemy()",
  );
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(
    run("D.hp"),
    96,
    "only two surviving enemies deal 2 damage each",
  );
  assert.equal(run("D.rd"), 2);
  run("D.master.m36=50");
  assert.equal(run("autoWins()"), 0);
  run('D.encounterWins["0:2"]=10');
  assert.equal(run("autoWins()"), 10);
});

test("expanded zones cover level 1–40, are reachable, and keep original saves valid", () => {
  const { run } = game();
  assert.equal(run("Z.length"), 25);
  assert.equal(run("new Set(M.map(m=>m.sourceId)).size"), 195);
  assert.equal(run("Math.min(...M.map(m=>m.l))"), 1);
  assert.equal(run("Math.max(...M.map(m=>m.l))"), 40);
  assert.equal(run("M.every(m=>m.l>=1&&m.l<=40)"), true);
  assert.equal(
    run(
      "M.filter(m=>!m.boss).every(m=>ENCOUNTER_TIERS[m.z].flat(2).includes(m.sourceId))",
    ),
    true,
  );
  for (let z = 4; z < run("Z.length"); z++) {
    run(`D.lv=Z[${z}][1]-1`);
    assert.equal(run(`!!zoneOpen(${z})`), false);
    run(`D.lv=Z[${z}][1]`);
    assert.equal(run(`!!zoneOpen(${z})`), true);
  }
  assert.equal(run("!!zoneOpen(500)"), false);
});

test("every added monster has nonempty level-1–40 loot and the same global gate", () => {
  const { run } = game();
  assert.equal(run("M.every(m=>lootPool(m).length>0)"), true);
  assert.equal(
    run("M.every(m=>lootPool(m).every(x=>x.level>=1&&x.level<=40))"),
    true,
  );
  assert.equal(
    run(
      "M.every(m=>Math.abs(mobDrops(m).reduce((sum,id)=>sum+dropRate(id,m),0)-30)<1e-8)",
    ),
    true,
  );
  assert.equal(
    run(
      "M.filter(m=>FAMILY_LOOT[m.sourceId].levelRange).every(m=>lootPool(m).every(x=>!RESERVED_LOOT_SETS.has(x.setId)&&!RESERVED_LOOT_ITEMS.has(x.id)))",
    ),
    true,
  );
  for (const [id, set] of [
    [59, 24],
    [79, 18],
    [46, 33],
    [47, 3],
    [98, 50],
    [921, 63],
    [4046, 375],
    [153, 25],
    [267, 15],
  ]) {
    assert.equal(
      run(`lootPool(M.find(m=>m.sourceId===${id})).every(x=>x.setId===${set})`),
      true,
    );
  }
  run("D.z=20;D.lv=40;Math.random=()=>0;startEncounter(20,2)");
  assert.equal(run("encounter.members.length"), 3);
  const earned = run(
    "encounter.members.reduce((n,e)=>n+M.find(m=>m.id===e.id).xp,0)",
  );
  const before = run("wins()");
  run("encounter.members.forEach(e=>e.hp=0);victory()");
  assert.equal(run("D.encounterWins['20:2']"), 1);
  assert.equal(run("lastResult.xp"), earned);
  assert.equal(run("wins()"), before + 3);
  assert.equal(run("D.bag.length"), 3);
});
