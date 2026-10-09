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
  vm.runInContext(read("classes.js"), c);
  vm.runInContext(read("combat-effects.js"), c);
  vm.runInContext(read("world-data.js"), c);
  const src = read("game.js");
  vm.runInContext(src.slice(0, src.indexOf("function show(")), c);
  c.eq = data("dofus-equipment-1-40.json");
  c.sets = data("dofus-item-sets.json");
  c.monsters = data("dofus-bestiary-1-40.json").monsters;
  c.extra = data("extra-equipment.json");
  vm.runInContext("EXTRA_EQUIPMENT=extra", c);
  vm.runInContext(
    "buildLocalData(eq,sets);M=buildCombatData(monsters);D.classId='iop';D.k=1000000;render=()=>{};",
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
    "Math.random=()=>0;M.forEach(m=>m.criticalChance=0);startEncounter(0,2);encounter.members[0].hp=0;selectTarget(1,true);enemy()",
  );
  await new Promise((r) => setTimeout(r, 950));
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
  for (const id of JSON.parse(run("JSON.stringify(ZONE_ORDER)"))) {
    assert.equal(run(`!!zoneOpen(${id})`), true);
    run(`D.encounterWins['${id}:2']=10`);
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
  run(
    "ZONE_ORDER.slice(0,ZONE_ORDER.indexOf(20)).forEach(id=>D.encounterWins[id+':2']=10);D.z=20;D.lv=40;Math.random=()=>0;startEncounter(20,2)",
  );
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

test("victory level announcement follows actual XP, including multiple levels and no level", () => {
  const { run } = game();
  run(
    "Math.random=()=>0;D.xp=0;startEncounter(0,0);encounter.members.forEach(e=>e.hp=0);victory()",
  );
  assert.equal(run("lastResult.levelsGained"), 0);
  assert.equal(run("lastResult.levelBefore"), 1);
  assert.equal(run("lastResult.levelAfter"), 1);
  run(
    "D.xp=need(D.lv)-1;startEncounter(0,0);encounter.members.forEach(e=>e.hp=0);victory()",
  );
  assert.equal(run("lastResult.levelsGained"), 1);
  assert.equal(run("lastResult.levelAfter"), 2);
  run(
    "D.lv=1;D.xp=99;D.inv.Sagesse=1000;startEncounter(0,2);encounter.members.forEach(e=>e.hp=0);victory()",
  );
  assert.ok(run("lastResult.levelsGained") > 1);
  assert.equal(
    run("lastResult.levelAfter-lastResult.levelBefore"),
    run("lastResult.levelsGained"),
  );
  assert.ok(run("D.xp>=0&&D.xp<need(D.lv)"));
});

test("nineteen complete class trees unlock with XP and reject locked or invalid casts", () => {
  const { run } = game();
  assert.equal(run("CLASSES.length"), 19);
  assert.equal(
    run(
      "CLASSES.every(c=>c.spells.length===8&&c.spells.filter(s=>s.level===1).length===2)",
    ),
    true,
  );
  assert.equal(
    run("new Set(CLASSES.flatMap(c=>c.spells.map(s=>s.id))).size"),
    152,
  );
  for (const id of run("CLASSES.map(c=>c.id)")) {
    run(`chooseClass('${id}');D.lv=1;startEncounter(0,0)`);
    const hp = run("D.eh"),
      pa = run("PA");
    run("cast(7);cast(-1);cast(999);D.spellPts=2;upSpell(7)");
    assert.equal(run("D.eh"), hp);
    assert.equal(run("PA"), pa);
    assert.equal(run("D.spellPts"), 2);
    for (const [level, count] of [
      [1, 2],
      [4, 2],
      [5, 3],
      [10, 4],
      [15, 5],
      [20, 6],
      [30, 7],
      [40, 8],
    ]) {
      run(`D.lv=${level}`);
      assert.equal(
        run("spellBook().filter((s,i)=>spellUnlocked(i)).length"),
        count,
      );
    }
    run('mode="picker"');
  }
});

test("class migration refunds old training once and preserves each class training and inventory", () => {
  const { run } = game();
  run(
    "D.spellLv=[3,2,1,1,1,1];D.spellPts=4;D.classMigration=0;migrateClassSave(D)",
  );
  assert.equal(run("D.spellPts"), 7);
  run("migrateClassSave(D)");
  assert.equal(run("D.spellPts"), 7);
  run('chooseClass("iop");upSpell(0)');
  assert.equal(run("spellRank(0)"), 2);
  run('chooseClass("sadida")');
  assert.equal(run("spellRank(0)"), 1);
  run('chooseClass("iop")');
  assert.equal(run("spellRank(0)"), 2);
  assert.equal(run("D.spellPts"), 6);
  run('startEncounter(0,0);chooseClass("cra")');
  assert.equal(run("D.classId"), "iop");
});

test("area attacks hurt every living enemy independently and shields absorb real incoming damage", () => {
  const { run } = game();
  run("D.lv=40;Math.random=()=>0;startEncounter(0,2)");
  const before = run("encounter.members.map(e=>e.hp)");
  run("cast(3)");
  const after = run("encounter.members.map(e=>e.hp)");
  for (let i = 0; i < 3; i++) assert.ok(after[i] < before[i]);
  assert.equal(run("wins()"), 0);
  run('mode="picker";chooseClass("feca");startEncounter(0,0);cast(1)');
  const shield = run("effects.shield");
  assert.ok(shield > 0);
  assert.equal(run("incomingDamage(mob(),0)"), 0);
  assert.ok(run("effects.shield") < shield);
  assert.equal(run("canCast(1)"), false);
  run("D.rd=4;PA=6");
  assert.equal(run("canCast(1)"), true);
});

test("poison victory cancels enemy attacks and cannot pay twice; next encounter clears effects", async () => {
  const { run } = game();
  run(
    'chooseClass("sadida");Math.random=()=>0;startEncounter(0,0);encounter.members[0].hp=2;D.eh=2;cast(1);enemy()',
  );
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(run("mode"), "result");
  assert.equal(run("D.hp"), 100);
  assert.equal(run("wins()"), 1);
  run("victory()");
  assert.equal(run("wins()"), 1);
  run("startEncounter(0,0)");
  assert.equal(run("Object.keys(effects.poisons).length"), 0);
  assert.equal(
    run("effects.shield+effects.summons.length+effects.bombs.length"),
    0,
  );
});

test("summons, bomb countdowns, healing, PA recovery and elemental combos have actual effects", () => {
  const { run } = game();
  run(
    'D.lv=40;Math.random=()=>0;chooseClass("osamodas");startEncounter(0,2);cast(1);cast(3)',
  );
  assert.equal(run("effects.summons.length"), 2);
  const hp = run("encounter.members[0].hp");
  run("tickFriendlyEffects()");
  assert.ok(run("encounter.members[0].hp") < hp);
  run('mode="picker";chooseClass("steamer");startEncounter(0,2);cast(1);PA=6');
  assert.equal(run("canCast(2)"), false);
  run('mode="picker";chooseClass("roublard");startEncounter(0,2)');
  const before = run("encounter.members.map(e=>e.hp)");
  run("cast(1);tickFriendlyEffects()");
  assert.equal(run("effects.bombs.length"), 1);
  assert.deepEqual(run("encounter.members.map(e=>e.hp)"), before);
  run("tickFriendlyEffects()");
  assert.equal(run("effects.bombs.length"), 0);
  const after = run("encounter.members.map(e=>e.hp)");
  for (let i = 0; i < 3; i++) assert.ok(after[i] < before[i]);
  run(
    'mode="picker";chooseClass("eniripsa");startEncounter(0,0);D.hp=40;cast(1)',
  );
  assert.equal(run("D.hp"), 52);
  run('mode="picker";chooseClass("xelor");startEncounter(0,0);PA=4;cast(2)');
  assert.equal(run("PA"), 4);
  assert.equal(run("canCast(2)"), false);
  run('mode="picker";chooseClass("huppermage");startEncounter(0,2);cast(0)');
  run("Math.random=()=>.999");
  const baseline = run('attackValue(spell(1),"dmg")');
  run("effects.lastElement=null");
  assert.ok(baseline > run('attackValue(spell(1),"dmg")'));
});

test("class confirmation is free initially, costs 20000 thereafter, and cannot double-charge", () => {
  const { run } = game();
  run("D.classId=null;D.k=0");
  assert.equal(run('chooseClass("iop")'), true);
  assert.equal(run("D.k"), 0);
  run("D.k=19999");
  assert.equal(run('chooseClass("cra")'), false);
  assert.equal(run("D.classId"), "iop");
  assert.equal(run("D.k"), 19999);
  run("D.k=20000");
  assert.equal(run('chooseClass("cra")'), true);
  assert.equal(run("D.k"), 0);
  assert.equal(run("D.classId"), "cra");
  assert.equal(run('chooseClass("cra")'), false);
  assert.equal(run("D.k"), 0);
  run("D.k=20000;startEncounter(0,0)");
  assert.equal(run('chooseClass("iop")'), false);
  assert.equal(run("D.k"), 20000);
});

test("all nonempty zones are freely accessible at level one with zero victories", () => {
  const { run } = game();
  run("D.lv=1;D.encounterWins={};D.master={};D.boss={}");
  assert.equal(run("ZONE_ORDER.every(zoneOpen)"), true);
  assert.equal(run("zoneOpen(-1)"), false);
  assert.equal(run("zoneOpen(500)"), false);
});
test("inventory sorts support all four directions without changing items or bag order", () => {
  const { run } = game();
  run(`sortFixture=Object.keys(I).map(id=>({id,...meta(id)})).filter(x=>Object.values(x.x).some(v=>v[0]!==v[1])).sort((a,b)=>a.l-b.l);low=sortFixture[0];high=sortFixture.at(-1);
    mk=(x,uid,max)=>({id:x.id,uid,st:Object.fromEntries(Object.entries(x.x).map(([k,v])=>[k,max?Math.max(...v):Math.min(...v)]))});
    D.bag=[mk(high,1,true),mk(low,2,false),mk(low,3,true)];original=JSON.stringify(D.bag)`);

  for (const [order, field, sign] of [
    ["levelAsc", "level", 1],
    ["levelDesc", "level", -1],
    ["jetAsc", "jet", 1],
    ["jetDesc", "jet", -1],
  ]) {
    assert.equal(
      run(
        `sortedInventory(D.bag,'${order}').map(q=>${field === "level" ? "meta(q.id).l" : "jet(q)"}).every((v,i,a)=>!i||(v-a[i-1])*${sign}>=0)`,
      ),
      true,
    );
  }
  assert.equal(run("JSON.stringify(D.bag)===original"), true);
});

test("reset characteristics refunds exact tier costs and wisdom without double refund", () => {
  const { run } = game();
  run(
    'D.pts=1000;D.inv={Terre:0,Feu:0,Eau:0,Air:0,Neutre:0,Sagesse:0};for(let i=0;i<125;i++)spend("Terre");for(let i=0;i<51;i++)spend("Air");for(let i=0;i<10;i++)spend("Sagesse");pointsBefore=D.pts;equipmentBefore=JSON.stringify(D.w);levelBefore=D.lv;spellBefore=D.spellPts',
  );
  assert.equal(run("investedStatPoints()"), 307);
  assert.equal(run("resetCharacteristics()"), true);
  assert.equal(run("D.pts"), 1000);
  assert.equal(run("Object.values(D.inv).every(v=>v===0)"), true);
  assert.equal(run("resetCharacteristics()"), false);
  assert.equal(run("D.pts"), 1000);
  assert.equal(
    run(
      "JSON.stringify(D.w)===equipmentBefore && D.lv===levelBefore && D.spellPts===spellBefore",
    ),
    true,
  );
  run('spend("Feu");mode="fight"');
  assert.equal(run("resetCharacteristics()"), false);
  assert.equal(run("D.inv.Feu"), 1);
});
test("equipment filters support multiple categories and preserve explicit empty selection", () => {
  const { run } = game();
  assert.equal(run("visibleInventorySlots().length"), 10);
  run('D.inventorySlots=["Anneau","Cape"]');
  assert.equal(run('visibleInventorySlots().join(",")'), "Anneau,Cape");
  run("D.inventorySlots=[]");
  assert.equal(run("visibleInventorySlots().length"), 0);
});

test("all class spells reach rank six with costs 1 to 5 and reject insufficient or repeated upgrades", () => {
  const { run } = game();
  const ids = JSON.parse(run("JSON.stringify(CLASSES.map(c=>c.id))"));
  for (const id of ids) {
    run(`D.classId='${id}';D.lv=40`);
    for (let i = 0; i < 8; i++) {
      let spent = 0;
      for (let rank = 1; rank <= 5; rank++) {
        assert.equal(run(`spellUpgradeCost(${i})`), rank);
        run(`D.spellPts=${rank - 1}`);
        assert.equal(run(`upSpell(${i})`), false);
        assert.equal(run(`spellRank(${i})`), rank);
        run(`D.spellPts=${rank}`);
        assert.equal(run(`upSpell(${i})`), true);
        assert.equal(run("D.spellPts"), 0);
        spent += rank;
      }
      assert.equal(spent, 15);
      assert.equal(run(`spellRank(${i})`), 6);
      assert.equal(
        run(
          `spell(${i})[3]===spellBook()[${i}].lo+10 && spell(${i})[4]===spellBook()[${i}].hi+20`,
        ),
        true,
      );
      run("D.spellPts=50");
      assert.equal(run(`upSpell(${i})`), false);
      assert.equal(run("D.spellPts"), 50);
    }
  }
  run("D.lv=1;D.spellPts=50");
  assert.equal(run("upSpell(7)"), false);
  assert.equal(run("upSpell(-1)"), false);
  assert.equal(run("upSpell(999)"), false);
});
test("locks follow items through equipment and refuse individual or repeated bulk sales", () => {
  const { run } = game();
  run(
    "D.lv=40;D.k=0;D.bag=[{uid:1,id:'d70',st:{Intelligence:10}},{uid:2,id:'d77',st:{Force:10}}]",
  );
  assert.equal(run("toggleItemLock(1)"), true);
  assert.equal(run("sell(1)"), 0);
  assert.equal(run("sellItems([1,2,2,999])"), 1);
  assert.equal(run("D.k"), 5);
  assert.equal(run("sellItems([2])"), 0);
  run("equip(1)");
  assert.equal(run("D.w.Amulette.locked"), true);
  run("uneq('Amulette')");
  assert.equal(run("D.bag[0].locked"), true);
  run("toggleItemLock(1)");
  assert.equal(run("sell(1)"), 1);
  assert.equal(run("D.k"), 10);
});
test("comparison includes lost set bonuses and calculates each ring independently without mutating gear", () => {
  const { run } = game();
  run(
    "I.a=['a','Anneau','setTest',1,{Force:[1,5]},1,1];I.b=['b','Cape','setTest',1,{Force:[1,5]},1,2];I.c=['c','Anneau',null,1,{Force:[1,8]},1,3];SET.setTest={2:{Force:10,PA:1}};D.w={Anneau1:{id:'a',st:{Force:5}},Anneau2:{id:'c',st:{Force:2}},Cape:{id:'b',st:{Force:5}}};candidate={id:'c',st:{Force:8}};before=JSON.stringify(D.w)",
  );
  assert.equal(run("equipmentDelta(candidate,'Anneau1').Force"), -7);
  assert.equal(run("equipmentDelta(candidate,'Anneau1').PA"), -1);
  assert.equal(run("equipmentDelta(candidate,'Anneau2').Force"), 6);
  assert.equal(run("equipmentDelta(candidate,'Anneau2').PA"), undefined);
  assert.equal(run("JSON.stringify(D.w)===before"), true);
  assert.equal(run("equipmentDelta(candidate,'Cape')"), null);
});

test("bulk confirmation refuses a changed snapshot and cannot pay twice", () => {
  const { run } = game();
  run(
    "D.k=0;D.bag=[{uid:1,id:'d70',st:{}},{uid:2,id:'d77',st:{}}];requestSale([1,2]);toggleItemLock(2)",
  );
  assert.equal(run("confirmSale()"), 0);
  assert.equal(run("D.bag.length"), 2);
  assert.equal(run("D.k"), 0);
  run("toggleItemLock(2);requestSale([1,2])");
  assert.equal(run("confirmSale()"), 2);
  assert.equal(run("D.k"), 10);
  assert.equal(run("confirmSale()"), 0);
  assert.equal(run("D.k"), 10);
});

test("level 200 caps XP, rewards the last level once and preserves progression", () => {
  const { run } = game();
  run(
    "D.lv=199;D.xp=0;D.inv.Sagesse=0;D.w={};D.pts=0;D.spellPts=0;D.k=1234;gainxp(need(199)*2)",
  );
  assert.equal(run("D.lv"), 200);
  assert.equal(run("D.xp"), 0);
  assert.equal(run("D.pts"), 5);
  assert.equal(run("D.spellPts"), 1);
  assert.equal(run("gainxp(100000)"), 0);
  assert.equal(run("D.pts"), 5);
  assert.equal(run("D.k"), 1234);
});
test("filtered catalogue keeps eligible monsters and all zones are sorted by level", () => {
  const c = data("monster-catalogue.json"),
    byId = new Map(c.monsters.map((m) => [m.id, m]));
  assert.equal(c.sourceMonsterCount, 5129);
  assert.equal(c.monsters.length, 1692);
  assert.equal(c.excludedMonsterIds.length, 3437);
  assert.deepEqual(c.excludedCategoryCounts, {
    archimonstre: 306,
    invocation: 291,
    quete: 2902,
  });
  assert.ok(c.excludedMonsterIds.every((id) => !byId.has(id)));
  for (const id of [36, 4785, 168, 2270]) assert.ok(!byId.has(id));
  for (const id of [101, 98, 147]) assert.ok(byId.has(id));
  assert.equal(byId.size, 1692);
  assert.equal(c.sourceVersion, "3.7.4.4");
  assert.equal(Math.max(...c.monsters.map((m) => m.maxLevel || 0)), 2400);
  const placed = new Set();
  let previous = 0;
  for (const z of c.zones) {
    if (z.id !== -1) {
      assert.ok(z.minLevel >= previous);
      previous = z.minLevel;
    }
    let level = 0;
    for (const id of z.monsters) {
      assert.ok(byId.has(id));
      const m = byId.get(id);
      assert.ok(m.minLevel >= level);
      level = m.minLevel;
      placed.add(id);
    }
  }
  assert.equal(placed.size, 1692);
  assert.ok(c.monsters.every((m) => m.name && m.minLevel > 0));
});

test("validated world contains exactly the 688 selected monsters and no empty zones", () => {
  const world = data("game-world.json"),
    selection = data("selected-monsters.json");
  assert.equal(world.monsters.length, 688);
  assert.equal(world.zones.length, 270);
  assert.deepEqual(
    [...world.selectedIds].sort((a, b) => a - b),
    [...selection.selectedIds].sort((a, b) => a - b),
  );
  const { c, run } = game();
  c.world = world;
  run("D.lv=1;D.xp=50;activateWorld(world)");
  assert.equal(run("M.length"), 688);
  assert.equal(
    run("M.every(m=>m.sourceDrops.every(d=>!!I['d'+d.itemId]))"),
    true,
  );
  assert.equal(run("ZONE_ORDER.every(zoneOpen)"), true);
  assert.equal(
    run(
      "ZONE_ORDER.every(z=>ENCOUNTER_TIERS[z].flat(2).every(id=>M.some(m=>m.sourceId===id&&monsterInZone(m,z))))",
    ),
    true,
  );
  assert.equal(
    run(
      "M.every(m=>ZONE_ORDER.some(z=>ENCOUNTER_TIERS[z].flat(2).includes(m.sourceId)))",
    ),
    true,
  );
  assert.equal(run("D.xp"), 55);
  run("activateWorld(world)");
  assert.equal(run("D.xp"), 55);
  assert.equal(run("Object.keys(I).length"), 3184);
  assert.equal(run("meta('d2411').n"), "Coiffe du Bouftou");
  assert.equal(
    run("M.every(m=>m.sourceDrops.every(d=>WORLD_ITEMS.has(d.itemId)))"),
    true,
  );
  run("D.encounterWins={};startEncounter(ZONE_ORDER.at(-2),2)");
  assert.equal(run("mode"), "fight");
});
test("source drops use per-item rates, exclude resources and allow conditioned equipment", () => {
  const { c, run } = game();
  c.world = data("game-world.json");
  run("activateWorld(world);D.resources={};D.bag=[];Math.random=()=>0");
  run(
    "sourceLoot({sourceDrops:[{itemId:384,rate:100,criterion:''},{itemId:2411,rate:100,criterion:''},{itemId:2411,rate:100,criterion:'Qa=1'}]})",
  );
  assert.equal(run("D.resources['384']||0"), 0);
  assert.equal(run("D.bag.length"), 2);
  assert.equal(run("D.bag[0].id"), "d2411");
  assert.equal(run("D.resources['999999']||0"), 0);
  run(
    "Math.random=()=>.99999;sourceLoot({sourceDrops:[{itemId:384,rate:1,criterion:''}]})",
  );
  assert.equal(run("D.resources['384']||0"), 0);
});

test("all usable equipment is obtainable by level with original drops preserved", () => {
  const { c, run } = game();
  c.world = data("game-world.json");
  run("activateWorld(world);D.w={};D.inv.Sagesse=0");
  assert.equal(
    run("Object.keys(I).every(id=>M.some(m=>mobDrops(m).includes(id)))"),
    true,
  );
  assert.equal(
    run(
      "M.every(m=>m.adaptedGearIds.every(id=>Math.abs(meta(id).l-Math.min(200,m.l))<=10 && !m.sourceDrops.some(d=>'d'+d.itemId===id)))",
    ),
    true,
  );
  assert.equal(run("M.every(m=>m.adaptedGearIds.length>0)"), true);
  assert.equal(
    run(
      "M.every(m=>Math.abs(m.adaptedGearIds.reduce((sum,id)=>sum+dropRate(id,m),0)-30)<1e-8)",
    ),
    true,
  );
  run(
    "fixtureMob=M.find(m=>m.sourceDrops.length===0);D.bag=[];Math.random=()=>0;sourceLoot(fixtureMob)",
  );
  assert.equal(run("D.bag.length"), 1);
  assert.equal(run("fixtureMob.adaptedGearIds.includes(D.bag[0].id)"), true);
  run("Math.random=()=>.99999;sourceLoot(fixtureMob)");
  assert.equal(run("D.bag.length"), 1);
});

test("imported equipment aliases work without rewriting existing item rolls", () => {
  const { run } = game();
  run("I.audit=['Audit','Cape',null,1,{},1,1];D.w={Cape:{id:'audit',st:{Soin:2,Soins:3,'Dommage':2,Dommages:1,'% Critique':4,Critique:2,'Dommage Feu':2,'Dommage Critique':3}}};snapshot=JSON.stringify(D.w)");
  assert.equal(run('st("Soins")'), 5);
  assert.equal(run('st("Dommages")'), 3);
  assert.equal(run('st("Critique")'), 6);
  assert.equal(run('st("Feu")'), 2);
  assert.equal(run('st("DommagesCritiques")'), 3);
  assert.equal(run('JSON.stringify(D.w)===snapshot'), true);
});

test("flat elemental damage, power and healing match equipment values", () => {
  const { run } = game();
  run("I.audit=['Audit','Cape',null,1,{},1,1];D.w={Cape:{id:'audit',st:{}}};D.inv={};Math.random=()=>.999;resetEffects()");
  for (const element of ['Feu','Air','Terre','Eau','Neutre']) {
    run(`D.w.Cape.st={'Dommage ${element}':2}`);
    assert.equal(run(`attackValue(['Test','${element}',1,6,6],'dmg')`), 8);
    assert.equal(run(`attackValue(['Test','${element}',1,8,8],'aoe')`), 10);
  }
  run("D.w.Cape.st={Puissance:1}");
  for (const element of ['Feu','Air','Terre','Eau','Neutre']) assert.equal(run(`attackValue(['Test','${element}',1,100,100],'dmg')`), 101);
  run("D.w.Cape.st={Soin:2}");
  assert.equal(run("healValue(['Test','Soin',1,8,8])"), 10);
  assert.equal(run("healValue(['Test','Soin',1,10,10])"), 12);
});

test("critical chance and damage apply only on successful critical rolls", () => {
  const { run } = game();
  run("I.audit=['Audit','Cape',null,1,{},1,1];D.w={Cape:{id:'audit',st:{'Dommage Critique':3}}};D.inv={};resetEffects();Math.random=()=>.049");
  assert.equal(run("attackValue(['Test','Feu',1,10,10],'dmg')"), 18);
  run("Math.random=()=>.05");
  assert.equal(run("attackValue(['Test','Feu',1,10,10],'dmg')"), 10);
  run("D.w.Cape.st['% Critique']=5;Math.random=()=>.099");
  assert.equal(run("attackValue(['Test','Feu',1,10,10],'dmg')"), 18);
  run("D.w.Cape.st['% Critique']=-5;Math.random=()=>0");
  assert.equal(run("attackValue(['Test','Feu',1,10,10],'dmg')"), 10);
  run("D.w.Cape.st['% Critique']=200;Math.random=()=>.999");
  assert.equal(run("attackValue(['Test','Feu',1,10,10],'dmg')"), 18);
});

test("percentage resistance matches the enemy element, then shields absorb damage", () => {
  const { run } = game();
  run("I.audit=['Audit','Cape',null,1,{},1,1];D.w={Cape:{id:'audit',st:{'% Resistance Feu':2}}};resetEffects();Math.random=()=>.999");
  assert.equal(run("incomingDamage({a:[100,100],e:'Feu'},0)"), 98);
  assert.equal(run("incomingDamage({a:[100,100],e:'Air'},0)"), 100);
  run("effects.shield=20");
  assert.equal(run("incomingDamage({a:[100,100],e:'Feu'},0)"), 78);
  run("D.w.Cape.st={'% Résistance Feu':-10}");
  assert.equal(run("incomingDamage({a:[100,100],e:'Feu'},0)"), 110);
  run("D.w.Cape.st={'% Resistance Feu':150}");
  assert.equal(run("incomingDamage({a:[100,100],e:'Feu'},0)"), 0);
});

test("class equipment and deleted stats disappear from drops, sets and existing saves", () => {
  const { c, run } = game();
  c.world = data('game-world.json');
  run("D.bag=[{uid:800,id:'d16143',st:{'Points de vie':13100}},{uid:801,id:'d2411',st:{Force:5,Pod:10,Invocation:1,'Dommage Pieges':3,Fuite:2,'Esquive PA':2}}];D.w.Cape={uid:802,id:'d8639',st:{}};D.seen.d16143=1;activateWorld(world)");
  assert.equal(run("removedClassGearIds.size"), 95);
  assert.equal(run("removedClassGearIds.has('d16143')"), true);
  assert.equal(run("D.bag.length"), 1);
  assert.equal(run("D.bag[0].uid"), 801);
  assert.equal(run("Object.keys(D.bag[0].st).join(',')"), 'Force');
  assert.equal(run("D.w.Cape"), null);
  assert.equal(run("D.seen.d16143"), undefined);
  assert.equal(run("Object.keys(I).every(id=>!removedClassGearIds.has(id)&&Object.keys(meta(id).x).every(name=>!removedEquipmentStat(name)))"), true);
  assert.equal(run("Object.values(SET).every(tiers=>Object.values(tiers).every(stats=>Object.keys(stats).every(name=>!removedEquipmentStat(name))))"), true);
  assert.equal(run("M.every(m=>mobDrops(m).every(id=>!removedClassGearIds.has(id)))"), true);
  const snapshot = run('JSON.stringify(D)');
  run('cleanEquipmentSave(D)');
  assert.equal(run('JSON.stringify(D)'), snapshot);
});

test("spell percent bonuses multiply attacks without affecting healing or reserved effects", () => {
  const { run } = game();
  run("I.audit=['Audit','Cape',null,1,{},1,1];D.w={Cape:{id:'audit',st:{'% Dommages aux sorts':2}}};D.inv={};Math.random=()=>.999;resetEffects()");
  assert.equal(run("attackValue(['Test','Feu',1,100,100],'dmg')"), 102);
  assert.equal(run("healValue(['Test','Soin',1,100,100])"), 100);
  run("D.w.Cape.st={'% Dommages aux sorts':-5}");
  assert.equal(run("attackValue(['Test','Feu',1,100,100],'dmg')"), 95);
  run("D.w.Cape.st={Initiative:1000,\"% Dommages d'armes\":200,'% Resistance melee':50,'% Resistance distance':50,'Dommages Renvoyes':99}");
  assert.equal(run("attackValue(['Test','Feu',1,100,100],'dmg')"), 100);
  assert.equal(run("incomingDamage({a:[100,100],e:'Feu',criticalChance:0},0)"), 100);
});

test("flat elemental and critical resistances reduce only their matching attacks", () => {
  const { run } = game();
  run("I.audit=['Audit','Cape',null,1,{},1,1];D.w={Cape:{id:'audit',st:{'Résistance Feu':1,'Résistance Critiques':2}}};Math.random=()=>.999;resetEffects()");
  assert.equal(run("incomingDamage({a:[5,5],e:'Feu',criticalChance:0},0)"), 4);
  assert.equal(run("incomingDamage({a:[10,10],e:'Feu',criticalChance:0},0)"), 9);
  assert.equal(run("incomingDamage({a:[10,10],e:'Air',criticalChance:0},0)"), 10);
  assert.equal(run("incomingDamage({a:[7,7],e:'Air',criticalChance:100},0)"), 8);
  assert.equal(run("incomingDamage({a:[10,10],e:'Air',criticalChance:100},0)"), 13);
  run("D.w.Cape.st={'Resistance Feu':1000}");
  assert.equal(run("incomingDamage({a:[5,5],e:'Feu',criticalChance:0},0)"), 0);
});

test("range can hit one adjacent living enemy without duplicating area damage or cascading", () => {
  const { run } = game();
  run("I.audit=['Audit','Cape',null,1,{},1,1];D.w={Cape:{id:'audit',st:{PO:100}}};D.lv=40;Math.random=()=>.999;startEncounter(0,2);encounter.members.forEach(e=>e.hp=1000);D.eh=1000;selectTarget(0,true)");
  run('cast(0)');
  assert.equal(run('encounter.members[0].hp===encounter.members[1].hp'), true);
  assert.equal(run('encounter.members[2].hp'), 1000);
  run("PA=20;effects.casts={};encounter.members.forEach(e=>e.hp=1000);D.eh=1000;cast(3)");
  assert.equal(run('new Set(encounter.members.map(e=>e.hp)).size'), 1);
  run("PA=20;effects.casts={};encounter.members.forEach(e=>e.hp=1000);D.eh=1000;D.w.Cape.st={Portee:2};rolls=[.1,.99,.019];Math.random=()=>rolls.shift()??.999;cast(0)");
  assert.equal(run('encounter.members[0].hp===encounter.members[1].hp'), true);
  assert.equal(run('encounter.members[2].hp'), 1000);
  run("PA=20;effects.casts={};encounter.members.forEach(e=>e.hp=1000);D.eh=1000;rolls=[.1,.99,.02];cast(0)");
  assert.equal(run('encounter.members[1].hp'), 1000);
  run("PA=20;effects.casts={};D.w.Cape.st={Portee:100};Math.random=()=>.999;encounter.members[0].hp=0;encounter.members[1].hp=0;encounter.members[2].hp=1000;selectTarget(2,true);cast(0)");
  assert.equal(run('encounter.members[0].hp+encounter.members[1].hp'), 0);
  assert.equal(run('mode'), 'fight');
});

test("legacy fixed resistance and critical effect IDs keep rolls while correcting labels", () => {
  const { run } = game();
  run("buildLocalData({items:[{id:90001,name:'Legacy',slot:'Cape',level:1,effects:[{effectId:243,stat:'Feu (fixe)',min:1,max:3},{effectId:421,stat:'Critiques (fixe)',min:2,max:4},{effectId:419,stat:'Critiques',min:10,max:20}]}]},{sets:[]});D.bag=[{uid:44,id:'d90001',st:{'Feu (fixe)':2,'Critiques (fixe)':3,Critique:15}}];cleanEquipmentSave(D);D.w={Cape:D.bag[0]}");
  assert.equal(run("st('Resistance Feu')"), 2);
  assert.equal(run("st('ResistanceCritiques')"), 3);
  assert.equal(run("st('DommagesCritiques')"), 15);
  assert.equal(run("st('Critique')"), 0);
  assert.equal(run("D.bag[0].uid"), 44);
  assert.equal(run("Object.keys(meta('d90001').x).sort().join(',')"), 'DommagesCritiques,Resistance Feu,ResistanceCritiques');
});

test("points of life and vitality share maximum HP, including set bonuses and old rolls", () => {
  const { run } = game();
  run("I.life=['Life','Cape',null,1,{'Points de vie':[50,50]},1,90001];D.bh=100;D.w={Cape:{uid:91,id:'life',st:{'Points de vie':50}}};lifeSnapshot=JSON.stringify(D.w)");
  assert.equal(run('mh()'), 150);
  assert.equal(run("st('Vitalite')"), 50);
  assert.equal(run('JSON.stringify(D.w)'), run('lifeSnapshot'));
  run("D.w.Cape.st.Vitalite=20");
  assert.equal(run('mh()'), 170);
  run("I.other=['Other','Anneau','lifeSet',1,{},1,90002];I.life[2]='lifeSet';SET.lifeSet={2:{'Points de vie':25}};D.w.Anneau1={id:'other',st:{}}");
  assert.equal(run('mh()'), 195);
  run("D.w.Cape=null");
  assert.equal(run('mh()'), 100);
  run("D.w.Cape={id:'life',st:{'Points de vie':-200}}");
  assert.equal(run('mh()'), 1);
});


test("new source equipment has complete pools, distinct Dofus and no ethereal durability", () => {
  const {c,run}=game(); c.world=data('game-world.json'); run('activateWorld(world)');
  const counts={}; for(const row of c.extra.items) counts[row.slot]=(counts[row.slot]||0)+1;
  assert.deepEqual(counts,{Arme:734,Familier:122,Dofus:31,'Trophée':266});
  assert.equal(new Set(c.extra.items.filter(x=>x.slot==='Dofus').map(x=>x.name)).size,31);
  assert.equal(run("[2341,2361,8338,27268].every(id=>!I['d'+id])"),true);
  assert.equal(run("extra.items.every(row=>M.some(m=>dropRate('d'+row.id,m)>0))"),true);
  assert.equal(run("Object.keys(D.w).length"),15);
});

test("new slots preserve saves and share six accessory slots without duplicates or losses", () => {
  const {c,run}=game(); c.world=data('game-world.json');run("activateWorld(world);D.lv=200;D.inventorySlots=['Cape'];D.extraEquipmentMigration=0;ensureEquipmentSlots();ids=['Arme','Familier','Dofus','Trophée'].map(s=>'d'+extra.items.find(x=>x.slot===s).id);items=ids.map(id=>roll(id));D.bag.push(...items);equip(items[0].uid,'Cape')");
  assert.equal(run('D.bag.length'),4);
  run("equip(items[0].uid);equip(items[1].uid);equip(items[2].uid);equip(items[3].uid)");
  assert.equal(run('D.bag.length'),0);
  assert.equal(run("D.w.Arme.id===ids[0]&&D.w.Familier.id===ids[1]&&D.w.Dofus1.id===ids[2]&&D.w.Dofus2.id===ids[3]"),true);
  run("duplicate=roll(ids[2]);D.bag.push(duplicate);equip(duplicate.uid,'Dofus3')");
  assert.equal(run('D.w.Dofus3'),null);
  assert.equal(run('D.bag.length'),1);
  run("uneq('Arme');uneq('Familier');uneq('Dofus1');uneq('Dofus2')");
  assert.equal(run('D.bag.length'),5);
  assert.equal(run("D.inventorySlots.join(',')"),'Cape');
});

test("radiant loot uses 1 percent boundary, ceiling positive perfect rolls and best normal malus", () => {
  const {run}=game();
  run("I.audit=['Audit','Arme',null,1,{PA:[1,1],Force:[1,5],Agilite:[-20,-10],PM:[0,0]},1,900001];Math.random=()=>.009;q=roll('audit',true)");
  assert.equal(run('q.rayonnant'),true);
  assert.equal(run('JSON.stringify(q.st)'),JSON.stringify({PA:2,Force:8,Agilite:-10,PM:0}));
  assert.equal(run('jet(q)'),150);
  assert.equal(run("roll('audit').rayonnant"),undefined);
  run('Math.random=()=>.01');
  assert.equal(run("roll('audit',true).rayonnant"),undefined);
});

test("weapon damage spends PA, limits casts, separates spell bonuses and applies critical damage once", () => {
  const {run}=game();
  run("I.audit=['Audit','Arme',null,1,{},1,900001,{ap:3,casts:1,criticalChance:0,criticalBonus:0,lines:[{kind:'damage',element:'Feu',min:10,max:10},{kind:'damage',element:'Air',min:10,max:10}]}];D.w.Arme={id:'audit',st:{\"% Dommages d'armes\":20,'% Dommages aux sorts':100}};Math.random=()=>.999;startEncounter(0,2);encounter.members.forEach(e=>e.hp=1000);D.eh=1000;PA=6");
  assert.equal(run('useWeapon()'),true);
  assert.equal(run('encounter.members[0].hp'),976);
  assert.equal(run('PA'),3);
  assert.equal(run('useWeapon()'),false);
  assert.equal(run('PA'),3);
  run("endEffectRound();D.w.Arme.st={Critique:100,DommagesCritiques:7};PA=6;useWeapon()");
  assert.equal(run('encounter.members[0].hp'),939);
  run("endEffectRound();D.w.Arme.rayonnant=true;D.w.Arme.st={};PA=2");
  assert.equal(run('canUseWeapon()'),false);
  assert.equal(run('weaponLines(D.w.Arme)[0].min'),15);
  assert.equal(run('weaponAutoScore()'),0);
});


test("defeat opens a retry result without rewards or changing the selected encounter", async () => {
 const {run}=game();
 run("startEncounter(0,2);encounter.members.forEach(e=>{e.hp=1000});D.hp=1;Math.random=()=>.999;before=JSON.stringify([D.k,D.xp,D.master,D.encounterWins,D.bag]);enemy()");
 await new Promise(resolve=>setTimeout(resolve,350));
 assert.equal(run('mode'),'result');
 assert.equal(run('lastResult.defeat'),true);
 assert.equal(run('lastResult.key'),'0:2');
 assert.equal(run('lastResult.tier'),2);
 assert.equal(run('JSON.stringify([D.k,D.xp,D.master,D.encounterWins,D.bag])'),run('before'));
});


test("single item sales validate ownership, identity, lock and cannot pay twice", () => {
 const {run}=game();run("D.bag=[{uid:701,id:'d70',st:{}},{uid:702,id:'d70',st:{},locked:true}];startK=D.k");
 assert.equal(run("confirmSingleSale(701,'wrong')"),0);
 assert.equal(run("confirmSingleSale(702,'d70')"),0);
 assert.equal(run("confirmSingleSale(701,'d70')"),1);
 assert.equal(run("confirmSingleSale(701,'d70')"),0);
 assert.equal(run('D.k-startK'),5);
 assert.equal(run('D.bag.length'),1);
});

test("automatic victories tally exact credited rewards once and keep individual drop identities", () => {
 const {run}=game();run("startEncounter(0,0);auto=true;D.autoSession={battles:0,wins:0,losses:0,xp:0,k:0,drops:[]};Math.random=()=>0;encounter.members.forEach(e=>e.hp=0);victory();clearTimeout(autoTimer)");
 assert.equal(run('D.autoSession.battles'),1);
 assert.equal(run('D.autoSession.wins'),1);
 assert.equal(run('D.autoSession.xp===lastResult.xp&&D.autoSession.k===lastResult.k'),true);
 assert.equal(run('D.autoSession.drops.map(q=>q.uid).join()===lastResult.drops.map(q=>q.uid).join()'),true);
 run('victory()');assert.equal(run('D.autoSession.battles'),1);
 assert.equal(run('D.autoSession.drops.every(q=>!q.st)'),true);
});

test('a complete round plays every living monster in order before restoring the player', async () => {
 const {run}=game();
 run('startEncounter(0,2);D.hp=100;incomingDamage=()=>3;enemy();enemy()');
 await new Promise(r=>setTimeout(r,350));
 assert.equal(run('enemyActingIndex'),0);assert.equal(run('D.hp'),97);assert.equal(run('D.rd'),1);assert.equal(run('D.tr'),false);
 await new Promise(r=>setTimeout(r,300));
 assert.equal(run('enemyActingIndex'),1);assert.equal(run('D.hp'),94);assert.equal(run('D.rd'),1);
 await new Promise(r=>setTimeout(r,300));
 assert.equal(run('enemyActingIndex'),2);assert.equal(run('D.hp'),91);assert.equal(run('D.rd'),1);
 await new Promise(r=>setTimeout(r,300));
 assert.equal(run('enemyActingIndex'),null);assert.equal(run('D.rd'),2);assert.equal(run('D.tr'),true);assert.equal(run('PA'),run('maxpa()'));
 run('enemy();fightToken++;mode="picker"');
 await new Promise(r=>setTimeout(r,350));assert.equal(run('D.hp'),91);
});
