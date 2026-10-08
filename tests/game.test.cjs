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
  assert.equal(run("M.length"), 21);
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
