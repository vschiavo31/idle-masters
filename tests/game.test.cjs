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
  const src = read("game.js");
  vm.runInContext(src.slice(0, src.indexOf("function show(")), c);
  c.eq = data("dofus-equipment-1-40.json");
  c.sets = data("dofus-item-sets.json");
  c.monsters = data("dofus-bestiary-1-40.json").monsters;
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

test("zones unlock in displayed order only after ten hard wins in every preceding zone", () => {
  const { run } = game();
  const order = JSON.parse(run("JSON.stringify(ZONE_ORDER)"));
  assert.equal(new Set(order).size, 25);
  assert.equal(order[0], 0);
  run("D.lv=40;D.boss={incarnam:1,astrub:1,tainela:1};D.master.m4785=999");
  assert.equal(run(`!!zoneOpen(${order[1]})`), false);
  run('D.encounterWins={"8:2":17}');
  assert.equal(
    run("!!zoneOpen(1)"),
    false,
    "Later saved wins cannot skip predecessors",
  );
  run("D.encounterWins={}");
  for (let n = 1; n < order.length; n++) {
    const previous = order[n - 1],
      next = order[n];
    run(
      `D.encounterWins['${previous}:0']=100;D.encounterWins['${previous}:1']=100;D.encounterWins['${previous}:2']=9`,
    );
    assert.equal(run(`!!zoneOpen(${next})`), false);
    run(`D.encounterWins['${previous}:2']=10`);
    assert.equal(run(`!!zoneOpen(${next})`), true);
  }
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
  assert.equal(run("visibleInventorySlots().length"), 6);
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
