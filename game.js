const Z = ZONE_DATA;
let M = [],
  BESTIARY = [];
let EQ = [],
  SETS = [],
  I = {},
  SET = {};
const STATMAP = {
  Agilité: "Agilite",
  Vitalité: "Vitalite",
  Critique: "Critique",
  Critiques: "Critique",
  Dommages: "Dommages",
  Soins: "Soins",
  Portée: "Portee",
  Puissance: "Puissance",
  Initiative: "Initiative",
  Sagesse: "Sagesse",
  Chance: "Chance",
  Force: "Force",
  Intelligence: "Intelligence",
  PA: "PA",
  PM: "PM",
  Invocation: "Invocation",
  Prospection: "Prospection",
  Tacle: "Tacle",
  Fuite: "Fuite",
  Terre: "Terre",
  Feu: "Feu",
  Eau: "Eau",
  Air: "Air",
  Neutre: "Neutre",
};
function statKey(s) {
  return (
    STATMAP[s] ||
    String(s || "Effet")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  );
}
function slotName(s) {
  return s === "Chapeau" ? "Coiffe" : s;
}
const lootPools = new Map();
function buildLocalData(eq, sets) {
  lootPools.clear();
  EQ = eq.items || [];
  SETS = sets.sets || [];
  I = {};
  EQ.forEach((x) => {
    let st = {};
    (x.effects || []).forEach((e) => {
      if (!e.stat) return;
      let a = Number(e.min),
        b = Number(e.max);
      if (!Number.isFinite(a)) return;
      if (!Number.isFinite(b)) b = a;
      if (b < a) [a, b] = [b, a];
      st[statKey(e.stat)] = [a, b];
    });
    if (!Object.keys(st).length) return;
    I["d" + x.id] = [
      x.name,
      slotName(x.slot),
      x.setId || null,
      localBaseRate(x.level),
      st,
      x.level,
      x.id,
    ];
  });
  SET = {};
  SETS.forEach((s) => {
    let name = s.name || "Panoplie " + s.id,
      key = "set" + s.id;
    SET[key] = {};
    (s.bonuses || []).forEach((row) => {
      let o = {};
      (row.effects || []).forEach((e) => {
        if (!e.stat) return;
        let v = Number(e.max);
        if (!Number.isFinite(v) || v === 0) v = Number(e.min) || 0;
        o[statKey(e.stat)] = (o[statKey(e.stat)] || 0) + v;
      });
      if (Object.keys(o).length) SET[key][row.pieces] = o;
    });
    EQ.filter((x) => x.setId === s.id).forEach((x) => {
      let q = I["d" + x.id];
      if (q) q[2] = key;
    });
  });
}
function localBaseRate(l) {
  return l <= 5 ? 16 : l <= 10 ? 13 : l <= 20 ? 9 : l <= 30 ? 6 : 4;
}
// These are Idle Masters equipment tables, not official Dofus drops.
function lootPool(m) {
  if (lootPools.has(m.sourceId)) return lootPools.get(m.sourceId);
  if (m.sourceDrops) {
    const ids = new Set([
      ...m.sourceDrops.filter((d) => d.rate > 0).map((d) => d.itemId),
      ...(m.adaptedGearIds || []).map((id) => Number(id.slice(1))),
    ]);
    const pool = EQ.filter((item) => I["d" + item.id] && ids.has(item.id));
    lootPools.set(m.sourceId, pool);
    return pool;
  }
  if (lootPools.has(m.sourceId)) return lootPools.get(m.sourceId);
  const table = FAMILY_LOOT[m.sourceId];
  if (!table) return [];
  const pool = EQ.filter((x) => {
    if (!I["d" + x.id]) return false;
    if (table.setId != null) return x.setId === table.setId;
    if (table.levelRange)
      return (
        x.level >= table.levelRange[0] &&
        x.level <= table.levelRange[1] &&
        !RESERVED_LOOT_SETS.has(x.setId) &&
        !RESERVED_LOOT_ITEMS.has(x.id)
      );
    return (table.itemIds || []).includes(x.id);
  });
  lootPools.set(m.sourceId, pool);
  return pool;
}
function lootLabel(m) {
  const table = FAMILY_LOOT[m.sourceId];
  return table?.setId != null
    ? SETS.find((s) => s.id === table.setId)?.name ||
        "Équipements de la famille"
    : table?.label || "Équipements du Chafer";
}
function mobDrops(m) {
  return lootPool(m).map((x) => "d" + x.id);
}
const BASE = [
  ["Pression", "Terre", 3, 6, 8, "dmg"],
  ["Flamiche", "Feu", 2, 3, 5, "dmg"],
  ["Vague", "Eau", 3, 6, 8, "dmg"],
  ["Lame de vent", "Air", 3, 5, 8, "dmg"],
  ["Coup brutal", "Neutre", 4, 8, 11, "dmg"],
  ["Soin mineur", "Soin", 3, 10, 14, "heal"],
];
const ACH = [
  ["first", "Premier sang", "Gagner 1 combat", (s) => wins(s) >= 1, 50],
  [
    "bouf25",
    "Berger",
    "Vaincre 25 Bouftous",
    (s) => (s.master.m36 || 0) >= 25,
    150,
  ],
  [
    "royal",
    "Roi contre Roi",
    "Vaincre le Bouftou Royal",
    (s) => (s.master.m147 || 0) >= 1,
    250,
  ],
  ["perfect", "Perfection", "Obtenir un jet 100 %", (s) => s.perfect, 300],
  [
    "collector",
    "Collectionneur",
    "Découvrir 10 équipements",
    (s) => Object.keys(s.seen || {}).length >= 10,
    400,
  ],
  [
    "dungeon",
    "Donjon des Bouftous",
    "Terminer le donjon",
    (s) => (s.dungeons || 0) >= 1,
    500,
  ],
];
let D = {
    lv: 1,
    xp: 0,
    pts: 0,
    spellPts: 0,
    spellLv: [1, 1, 1, 1, 1, 1],
    classId: null,
    spellRanks: {},
    inv: { Terre: 0, Feu: 0, Eau: 0, Air: 0, Neutre: 0, Sagesse: 0 },
    bh: 100,
    hp: 100,
    k: 0,
    z: 0,
    mid: "m4785",
    eh: 65,
    rd: 1,
    tr: true,
    end: false,
    bag: [],
    w: {
      Coiffe: null,
      Cape: null,
      Amulette: null,
      Anneau1: null,
      Anneau2: null,
      Ceinture: null,
      Bottes: null,
    },
    uid: 1,
    master: {},
    encounterWins: {},
    boss: {},
    seen: {},
    claimed: {},
    perfect: false,
    dungeons: 0,
  },
  PA = 6,
  mode = "picker",
  lastResult = null,
  dungeon = null,
  auto = false,
  autoTimer = null,
  fightToken = 0,
  encounter = null,
  targetIndex = 0,
  $ = (x) => document.getElementById(x),
  R = (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  need = (l) => Math.round(100 * Math.pow(1.45, l - 1));
function wins(s = D) {
  return Object.values(s.master || {}).reduce((a, b) => a + b, 0);
}
function mob() {
  return M.find((x) => x.id === D.mid) || M[0];
}
function meta(id) {
  let x = I[id];
  return x
    ? { n: x[0], s: x[1], set: x[2], r: x[3], x: x[4], l: x[5], ankamaId: x[6] }
    : null;
}
function sourceOf(id) {
  let x = meta(id);
  if (!x) return "Inconnue";
  const names = [
    ...new Set(M.filter((m) => mobDrops(m).includes(id)).map((m) => m.n)),
  ];
  return (
    "Équipement Dofus niv. " +
    x.l +
    (names.length
      ? " · Drops : " +
        names.slice(0, 4).join(", ") +
        (names.length > 4 ? " et " + (names.length - 4) + " autres" : "")
      : " · Aucun monstre actuel")
  );
}
function ranges(id) {
  let x = meta(id);
  return x
    ? Object.entries(x.x)
        .map(([k, v]) => k + " " + v[0] + "–" + v[1])
        .join(" · ")
    : "";
}
function sb(worn = D.w) {
  let c = {},
    o = {},
    seen = new Set();
  Object.values(worn).forEach((q) => {
    let x = q && meta(q.id);
    if (x && x.set && !seen.has(q.id)) {
      seen.add(q.id);
      c[x.set] = (c[x.set] || 0) + 1;
    }
  });
  for (let [s, n] of Object.entries(c)) {
    let tier = Object.keys(SET[s] || {})
      .map(Number)
      .filter((v) => v <= n)
      .sort((a, b) => b - a)[0];
    for (let [k, v] of Object.entries(SET[s]?.[tier] || {}))
      o[k] = (o[k] || 0) + v;
  }
  return o;
}
function gt(worn = D.w) {
  let t = {};
  Object.values(worn).forEach((q) => {
    if (q && meta(q.id))
      for (let [k, v] of Object.entries(q.st || {})) t[k] = (t[k] || 0) + v;
  });
  for (let [k, v] of Object.entries(sb(worn))) t[k] = (t[k] || 0) + v;
  return t;
}
function st(k) {
  return gt()[k] || 0;
}
function bonus(e) {
  let m = {
    Terre: "Force",
    Feu: "Intelligence",
    Eau: "Chance",
    Air: "Agilite",
    Neutre: "Force",
  };
  return (D.inv[e] || 0) + st(m[e]) + st("Puissance");
}
function mh() {
  return Math.max(1, D.bh + st("Vitalite"));
}
function maxpa() {
  return Math.max(1, 6 + st("PA"));
}
function wis() {
  return D.inv.Sagesse + st("Sagesse");
}
function txt(a) {
  return Object.entries(a)
    .map(([k, v]) => (v >= 0 ? "+" : "") + v + " " + k)
    .join(" · ");
}
function save() {
  GameSave.queue(D);
}
function jet(q) {
  let x = meta(q.id),
    s = 0,
    m = 0;
  if (!x) return 0;
  for (let [k, v] of Object.entries(x.x)) {
    let lo = Math.min(v[0], v[1]),
      hi = Math.max(v[0], v[1]);
    s += (q.st[k] ?? lo) - lo;
    m += hi - lo;
  }
  return m ? Math.round((100 * s) / m) : 100;
}
function roll(id) {
  let x = meta(id),
    a = {};
  if (!x) return null;
  for (let [k, v] of Object.entries(x.x))
    a[k] = R(Math.min(v[0], v[1]), Math.max(v[0], v[1]));
  let q = { uid: D.uid++, id, st: a };
  D.seen[id] = 1;
  if (jet(q) === 100) D.perfect = true;
  return q;
}
function spell(i) {
  const b = spellBook()[i];
  if (!b) return null;
  return spellValues(b, spellRank(i));
}
function spellValues(b, rank = 1) {
  const add = (rank - 1) * 2;
  return [b.n, b.e, b.pa, b.lo + add, b.hi + add * 2, b.kind];
}
function rarity(j) {
  return j === 100
    ? "rarity100"
    : j >= 95
      ? "rarity95"
      : j >= 90
        ? "rarity90"
        : j >= 80
          ? "rarity80"
          : "";
}
function equipmentChance() {
  return Math.max(0, Math.min(72, 30 * (1 + st("Prospection") / 100)));
}
function dropRate(id, m = mob()) {
  if (m.sourceDrops) {
    const source = m.sourceDrops
      .filter((d) => "d" + d.itemId === id)
      .reduce((sum, d) => sum + sourceDropChance(d), 0);
    return (
      source +
      ((m.adaptedGearIds || []).includes(id)
        ? equipmentChance() / m.adaptedGearIds.length
        : 0)
    );
  }
  let pool = mobDrops(m);
  return pool.includes(id) ? equipmentChance() / pool.length : 0;
}
const MAX_LEVEL = 200;
function gainxp(x) {
  if (D.lv >= MAX_LEVEL) {
    D.lv = MAX_LEVEL;
    D.xp = 0;
    return 0;
  }
  let g = Math.floor(x * (1 + wis() / 100));
  D.xp += g;
  while (D.lv < MAX_LEVEL && D.xp >= need(D.lv)) {
    D.xp -= need(D.lv);
    D.lv++;
    D.pts += 5;
    D.bh += 8;
    if (D.lv % 2 === 0) D.spellPts++;
  }
  if (D.lv === MAX_LEVEL) {
    g = Math.max(0, g - D.xp);
    D.xp = 0;
  }
  return g;
}
function loot(m = mob()) {
  if (m.sourceDrops) return sourceLoot(m);
  let out = [],
    pool = mobDrops(m);
  if (pool.length && Math.random() * 100 < equipmentChance()) {
    let id = pool[R(0, pool.length - 1)],
      q = roll(id);
    if (q) {
      D.bag.push(q);
      out.push(q);
    }
  }
  return out;
}
function checkAch() {
  ACH.forEach((a) => {
    if (a[3](D) && !D.claimed[a[0]]) {
      D.claimed[a[0]] = 1;
      D.k += a[4];
    }
  });
}
function lg(t) {
  let d = document.createElement("div");
  d.textContent = t;
  $("log").prepend(d);
}
function victory() {
  if (D.end || encounter?.members.some((e) => e.hp > 0)) return;
  const defeated = encounter
    ? encounter.members.map((e) => M.find((m) => m.id === e.id))
    : [mob()];
  const key = encounter?.key,
    zone = D.z,
    tier = encounter?.tier;
  let kg = 0,
    baseXp = 0,
    drops = [];
  for (const m of defeated) {
    kg += R(m.k[0], m.k[1]);
    baseXp += m.xp;
    drops.push(...loot(m));
    D.master[m.id] = (D.master[m.id] || 0) + 1;
    if (m.boss) D.boss[m.boss] = (D.boss[m.boss] || 0) + 1;
  }
  const levelBefore = D.lv;
  const xg = gainxp(baseXp);
  D.k += kg;
  if (key) D.encounterWins[key] = (D.encounterWins[key] || 0) + 1;
  D.hp = mh();
  D.end = true;
  D.tr = false;
  checkAch();
  lastResult = {
    mid: D.mid,
    ids: defeated.map((m) => m.id),
    key,
    zone,
    tier,
    xp: xg,
    levelBefore,
    levelAfter: D.lv,
    levelsGained: D.lv - levelBefore,
    unlocked: spellBook()
      .filter((s) => s.level > levelBefore && s.level <= D.lv)
      .map((s) => s.n),
    k: kg,
    drops,
  };
  if (auto && !dungeon) {
    save();
    render();
    return (autoTimer = setTimeout(
      () =>
        key ? startEncounter(zone, tier, true) : startFight(D.mid, false, true),
      650,
    ));
  }
  if (dungeon && dungeon.step < 3) {
    dungeon.step++;
    save();
    let token = fightToken;
    return setTimeout(() => {
      if (token === fightToken && dungeon)
        startFight(["m101", "m4822", "m148", "m147"][dungeon.step], true);
    }, 500);
  }
  if (dungeon) {
    D.dungeons++;
    dungeon = null;
    checkAch();
  }
  mode = "result";
  save();
  render();
}
function selectTarget(index, internal = false) {
  if (
    !encounter ||
    !encounter.members[index] ||
    encounter.members[index].hp <= 0 ||
    D.end ||
    (!internal && (!D.tr || auto))
  )
    return;
  targetIndex = index;
  D.mid = encounter.members[index].id;
  D.eh = encounter.members[index].hp;
  if (!internal) render();
}
function cast(i) {
  castClassSpell(i);
}
function enemy() {
  if (!D.tr || D.end) return;
  D.tr = false;
  let token = fightToken;
  render();
  setTimeout(() => {
    if (token !== fightToken || mode !== "fight") return;
    if (tickFriendlyEffects()) return;
    const attackers = livingTargets();
    for (const index of attackers) {
      const m = encounter
        ? M.find((m) => m.id === encounter.members[index].id)
        : mob();
      const d = incomingDamage(m, index);
      D.hp = Math.max(0, D.hp - d);
      lg(m.n + " : -" + d + " PV");
      if (D.hp <= 0) break;
    }
    endEffectRound();
    if (D.hp <= 0) {
      auto = false;
      D.hp = mh();
      D.end = true;
      dungeon = null;
      mode = "picker";
      return render();
    }
    D.rd++;
    PA = maxpa();
    D.tr = true;
    render();
    if (auto) scheduleAuto();
  }, 300);
}
function bestAutoSpell() {
  let best = -1,
    score = -1;
  spellBook().forEach((s, i) => {
    if (!canCast(i)) return;
    const p = spell(i);
    let value = 0;
    if (["dmg", "drain", "aoe"].includes(s.kind))
      value =
        (((p[3] + p[4]) / 2) *
          (1 + bonus(p[1]) / 100) *
          (s.kind === "aoe" ? livingTargets().length : 1)) /
        p[2];
    if (s.kind === "heal" && D.hp < mh() * 0.4) value = 100;
    if (s.kind === "summon" && effects.summons.length === 0) value = 20;
    if (s.kind === "poison" && !effects.poisons[targetIndex]) value = 10;
    if (s.kind === "bomb") value = 12;
    if (s.kind === "detonate" && effects.bombs.length >= 2) value = 30;
    if (value > score && value > 0) {
      score = value;
      best = i;
    }
  });
  return best;
}
function scheduleAuto() {
  clearTimeout(autoTimer);
  if (!auto || mode !== "fight" || D.end) return;
  autoTimer = setTimeout(() => {
    let i = bestAutoSpell();
    if (i >= 0) {
      cast(i);
      if (auto && !D.end) scheduleAuto();
    } else enemy();
  }, 300);
}
function autoWins() {
  return encounter?.key
    ? D.encounterWins[encounter.key] || 0
    : D.master[D.mid] || 0;
}
function toggleAuto() {
  if (autoWins() < 10 || dungeon) return;
  auto = !auto;
  if (auto) scheduleAuto();
  else clearTimeout(autoTimer);
  render();
}
function beginFight(
  ids,
  key = null,
  tier = null,
  keepDungeon = false,
  fromAuto = false,
) {
  if (
    typeof GameSave !== "undefined" &&
    GameSave.authenticated &&
    !GameSave.profile
  ) {
    show("spellsPage");
    previewClass(D.classId || "iop");
    return;
  }
  const chosen = ids.map((id) => M.find((m) => m.id === id));
  const fightZone = key ? Number(key.split(":")[0]) : chosen[0]?.z;
  if (
    !playerClass() ||
    chosen.some((m) => !m) ||
    !chosen.length ||
    chosen.some((m) => !monsterInZone(m, fightZone)) ||
    !zoneOpen(fightZone)
  )
    return;
  clearTimeout(autoTimer);
  fightToken++;
  resetEffects();
  encounter = {
    key,
    tier,
    members: chosen.map((m) => ({ id: m.id, hp: m.h })),
  };
  targetIndex = 0;
  D.mid = ids[0];
  D.z = fightZone;
  D.eh = chosen[0].h;
  D.hp = mh();
  D.rd = 1;
  PA = maxpa();
  D.tr = true;
  D.end = false;
  mode = "fight";
  if (!keepDungeon) dungeon = null;
  if (!fromAuto) auto = false;
  $("log").innerHTML = "";
  render();
  if (auto) scheduleAuto();
}
function startFight(id, keepDungeon = false, fromAuto = false) {
  beginFight([id], null, null, keepDungeon, fromAuto);
}
function startEncounter(zone, tier, fromAuto = false) {
  beginFight(
    rollEncounter(zone, tier),
    zone + ":" + tier,
    tier,
    false,
    fromAuto,
  );
}
function startDungeon() {
  auto = false;
  dungeon = { step: 0 };
  startFight("m101", true);
}
function statCost(n) {
  if (n === "Sagesse") return 3;
  return Math.floor((D.inv[n] || 0) / 50) + 1;
}
function investedStatPoints() {
  return Object.entries(D.inv).reduce((total, [name, count]) => {
    const blocks = Math.floor(count / 50),
      remainder = count % 50;
    return (
      total +
      (name === "Sagesse"
        ? count * 3
        : (50 * blocks * (blocks + 1)) / 2 + remainder * (blocks + 1))
    );
  }, 0);
}
function resetCharacteristics() {
  if (mode === "fight") return false;
  const refund = investedStatPoints();
  if (!refund) return false;
  D.pts += refund;
  Object.keys(D.inv).forEach((name) => (D.inv[name] = 0));
  render();
  return true;
}
function spend(n) {
  let c = statCost(n);
  if (D.pts >= c) {
    D.pts -= c;
    D.inv[n]++;
    render();
  }
}
const MAX_SPELL_RANK = 6;
function spellUpgradeCost(i) {
  return spellRank(i) < MAX_SPELL_RANK ? spellRank(i) : 0;
}
function upSpell(i) {
  const cost = spellUpgradeCost(i);
  if (!spellUnlocked(i) || !cost || D.spellPts < cost) return false;
  D.spellPts -= cost;
  D.spellRanks[spellBook()[i].id] = spellRank(i) + 1;
  render();
  return true;
}
const CLASS_CHANGE_PRICE = 20000;
let pendingClass = "iop",
  classPreviewOpen = false;
function classChangeCost(id) {
  return playerClass() && D.classId !== id ? CLASS_CHANGE_PRICE : 0;
}
function chooseClass(id) {
  if (mode === "fight" || !CLASSES.some((c) => c.id === id) || D.classId === id)
    return false;
  const cost = classChangeCost(id);
  if (D.k < cost) return false;
  D.k -= cost;
  D.classId = id;
  pendingClass = id;
  classPreviewOpen = false;
  resetEffects();
  lastResult = null;
  mode = "picker";
  render();
  return true;
}
function previewClass(id) {
  if (mode === "fight" || !CLASSES.some((c) => c.id === id)) return;
  pendingClass = id;
  classPreviewOpen = true;
  renderClassChoice();
}
function renderClassChoice() {
  const select = $("classSelect");
  if (select.options.length !== CLASSES.length) {
    select.innerHTML = "";
    CLASSES.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.name;
      select.append(o);
    });
  }
  select.value = pendingClass;
  const candidate = CLASSES.find((c) => c.id === pendingClass) || CLASSES[0];
  $("characterName").textContent = GameSave.profile?.nickname || "Aventurier";
  $("nicknameField").hidden = !!GameSave.profile;
  $("classCurrent").textContent = playerClass()
    ? "Classe : " + playerClass().name
    : "Choisis ta classe";
  $("classDashboard").textContent = playerClass()
    ? playerClass().name + " · " + playerClass().style
    : "Choisis une classe pour combattre";
  $("classList").hidden = classPreviewOpen;
  $("classDetail").hidden = !classPreviewOpen;
  $("classTraining").hidden = classPreviewOpen;
  $("classPreviewName").textContent = candidate.name;
  $("classPreview").textContent = candidate.style + " · " + candidate.passive;
  $("chooseClassBtn").textContent = "Voir les sorts du " + candidate.name;
  $("chooseClassBtn").disabled = mode === "fight";
  select.disabled = mode === "fight";
  const root = $("classPreviewSpells");
  root.innerHTML = "";
  candidate.spells.forEach((s) => {
    const rank = D.spellRanks[s.id] || 1,
      p = spellValues(s, rank),
      card = document.createElement("div");
    card.className = "card";
    card.innerHTML =
      "<b>" +
      s.n +
      "</b><div class='mut'>Niveau " +
      s.level +
      " · " +
      s.pa +
      " PA · " +
      s.e +
      " · Rang " +
      rank +
      "/6</div><div>" +
      spellEffectText(s, p, candidate.trait) +
      "</div><div class='mut'>" +
      (s.cd ? "Relance " + s.cd + " tours" : "3 lancers maximum par tour") +
      "</div>";
    root.append(card);
  });
  const cost = classChangeCost(candidate.id),
    current = D.classId === candidate.id;
  $("classCost").textContent = current
    ? "Ta classe actuelle"
    : cost
      ? "Changement : 20 000 kamas · Solde : " +
        D.k.toLocaleString("fr-FR") +
        " kamas" +
        (D.k < cost
          ? " · Il manque " + (cost - D.k).toLocaleString("fr-FR") + " kamas"
          : "")
      : "Premier choix gratuit";
  $("confirmClassBtn").disabled =
    mode === "fight" || (current && !!GameSave.profile) || D.k < cost;
  $("confirmClassBtn").textContent = !GameSave.profile
    ? "Confirmer le personnage"
    : current
      ? "Classe actuelle"
      : cost
        ? "Confirmer · 20 000 kamas"
        : "Confirmer la classe · gratuit";
}
function slot(q) {
  let x = meta(q.id);
  if (!x) return null;
  let s = x.s;
  if (s !== "Anneau") return s;
  if (!D.w.Anneau1) return "Anneau1";
  if (!D.w.Anneau2) return "Anneau2";
  return null;
}
function equip(u, target) {
  let j = D.bag.findIndex((x) => x.uid === u);
  if (j < 0) return;
  let q = D.bag[j],
    x = meta(q.id),
    s = target || slot(q);
  if (
    !x ||
    D.lv < x.l ||
    !s ||
    !(s in D.w) ||
    (x.s === "Anneau" ? !["Anneau1", "Anneau2"].includes(s) : s !== x.s)
  )
    return;
  let o = D.w[s];
  if (o) D.bag.push(o);
  D.w[s] = q;
  D.bag.splice(j, 1);
  render();
}
function uneq(s) {
  if (D.w[s]) {
    D.bag.push(D.w[s]);
    D.w[s] = null;
    render();
  }
}
let saleSelection = new Set(),
  pendingSale = [];
function itemByUid(uid) {
  return (
    D.bag.find((q) => q.uid === uid) ||
    Object.values(D.w).find((q) => q?.uid === uid)
  );
}
function toggleItemLock(uid) {
  const q = itemByUid(uid);
  if (!q) return false;
  q.locked = !q.locked;
  saleSelection.delete(uid);
  render();
  return true;
}
function sellItems(ids) {
  const wanted = new Set(ids);
  const items = D.bag.filter((q) => wanted.has(q.uid) && !q.locked);
  if (!items.length) return 0;
  const sold = new Set(items.map((q) => q.uid));
  D.bag = D.bag.filter((q) => !sold.has(q.uid));
  D.k += items.length * 5;
  sold.forEach((uid) => saleSelection.delete(uid));
  render();
  return items.length;
}
function sell(uid) {
  return sellItems([uid]);
}
function equipmentDelta(q, target) {
  const x = meta(q.id);
  if (
    !x ||
    !(target in D.w) ||
    (x.s === "Anneau"
      ? !["Anneau1", "Anneau2"].includes(target)
      : target !== x.s)
  )
    return null;
  const before = gt(),
    after = gt({ ...D.w, [target]: q });
  return Object.fromEntries(
    [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .map((key) => [key, (after[key] || 0) - (before[key] || 0)])
      .filter(([, delta]) => delta),
  );
}
function comparison(q) {
  const x = meta(q.id);
  if (!x) return "";
  return (x.s === "Anneau" ? ["Anneau1", "Anneau2"] : [x.s])
    .map((target) => {
      const current = D.w[target],
        delta = equipmentDelta(q, target);
      return (
        '<div class="compare"><b>Si équipé : ' +
        target +
        '</b><div class="mut">' +
        (current
          ? "Remplace " + (meta(current.id)?.n || "Ancien objet")
          : "Emplacement libre") +
        "</div><small>Écart total, bonus de panoplie inclus</small>" +
        (Object.entries(delta)
          .map(
            ([key, value]) =>
              '<div class="compareLine"><span>' +
              key +
              '</span><b class="' +
              (value > 0 ? "good" : "bad") +
              '">' +
              (value > 0 ? "+" : "") +
              value +
              "</b></div>",
          )
          .join("") ||
          '<div class="mut">Aucun changement de caractéristiques</div>') +
        "</div>"
      );
    })
    .join("");
}
function cancelSaleReview() {
  pendingSale = [];
  $("saleConfirm").hidden = true;
}
function requestSale(ids) {
  const wanted = new Set(ids);
  pendingSale = D.bag
    .filter((q) => wanted.has(q.uid) && !q.locked)
    .map((q) => ({
      uid: q.uid,
      id: q.id,
      name: meta(q.id)?.n || "Ancien objet",
    }));
  $("saleConfirm").hidden = !pendingSale.length;
  $("saleMessage").textContent =
    pendingSale.length +
    " objet(s) · " +
    pendingSale.length * 5 +
    " kamas. Cette vente retire les objets du sac.";
  $("saleList").textContent = pendingSale.map((q) => q.name).join(" · ");
}
function confirmSale() {
  const items = pendingSale;
  pendingSale = [];
  $("saleConfirm").hidden = true;
  if (!items.length) return 0;
  if (
    !items.every((q) =>
      D.bag.some(
        (item) => item.uid === q.uid && item.id === q.id && !item.locked,
      ),
    )
  ) {
    $("saleStatus").textContent =
      "La sélection a changé. Vérifie les objets et recommence.";
    return 0;
  }
  const count = sellItems(items.map((q) => q.uid));
  $("saleStatus").textContent =
    count + " objet(s) vendu(s) · +" + count * 5 + " kamas";
  return count;
}
function dashboard() {
  let n = need(D.lv),
    map = {
      Terre: "Force",
      Feu: "Intelligence",
      Eau: "Chance",
      Air: "Agilite",
      Neutre: "Force",
      Sagesse: "Sagesse",
    };
  $("lv").textContent = D.lv;
  $("levelBadge").textContent = D.lv;
  $("xpTxt").textContent =
    D.lv === MAX_LEVEL
      ? "Niveau 200 · maximum atteint"
      : D.xp + " / " + n + " XP";
  $("xpBar").style.width = D.lv === MAX_LEVEL ? "100%" : (D.xp / n) * 100 + "%";
  $("dashHp").textContent = mh();
  $("dashPa").textContent = maxpa();
  $("dashK").textContent = D.k;
  $("pts").textContent = D.pts;
  $("quickPts").textContent = D.pts;
  $("spellPts").textContent = D.spellPts;
  $("quickSeen").textContent = Object.keys(D.seen || {}).length;
  $("quickBag").textContent = D.bag.length;
  $("resetStatsBtn").disabled = mode === "fight" || !investedStatPoints();
  $("resetStatsInfo").textContent =
    "Gratuit, hors combat · " + investedStatPoints() + " point(s) à récupérer.";
  $("stats").innerHTML = "";
  Object.keys(map).forEach((x) => {
    let g = st(map[x]),
      t = (D.inv[x] || 0) + g,
      c = statCost(x),
      d = document.createElement("div");
    d.className = "stat";
    d.innerHTML =
      "<span>" +
      x +
      "</span><b>" +
      t +
      ' <small class="good">(+' +
      g +
      ")</small></b>";
    let b = document.createElement("button");
    b.textContent = "+1 · " + c + " pt" + (c > 1 ? "s" : "");
    b.disabled = D.pts < c;
    b.onclick = () => spend(x);
    d.append(b);
    $("stats").append(d);
  });
  $("achMini").textContent =
    ACH.filter((a) => D.claimed[a[0]]).length +
    " / " +
    ACH.length +
    " succès débloqués";
}
const INVENTORY_SLOTS = [
  "Coiffe",
  "Cape",
  "Amulette",
  "Anneau",
  "Ceinture",
  "Bottes",
];
function visibleInventorySlots() {
  return Array.isArray(D.inventorySlots)
    ? D.inventorySlots.filter((slot) => INVENTORY_SLOTS.includes(slot))
    : INVENTORY_SLOTS;
}
const INVENTORY_SORTS = ["levelAsc", "levelDesc", "jetAsc", "jetDesc"];
function sortedInventory(items, order) {
  const compare =
    {
      levelAsc: (a, b) => meta(a.id).l - meta(b.id).l,
      levelDesc: (a, b) => meta(b.id).l - meta(a.id).l,
      jetAsc: (a, b) => jet(a) - jet(b),
      jetDesc: (a, b) => jet(b) - jet(a),
    }[order] || ((a, b) => jet(b) - jet(a));
  return items
    .slice()
    .sort(
      (a, b) =>
        compare(a, b) ||
        String(a.uid).localeCompare(String(b.uid), "fr", { numeric: true }),
    );
}
function inventory() {
  let search = ($("bagSearch").value || "").toLowerCase();
  $("bagCount").textContent = D.bag.length;
  $("seenCount").textContent = Object.keys(D.seen || {}).length;
  $("wornCount").textContent =
    Object.values(D.w).filter(Boolean).length + " / " + Object.keys(D.w).length;
  let w = $("worn");
  w.innerHTML = "";
  Object.entries(D.w).forEach(([s, q]) => {
    let x = q && meta(q.id),
      d = document.createElement("div");
    d.className = "gearSlot";
    d.innerHTML =
      '<div class="gearBox ' +
      (x ? "filled" : "") +
      '"><div class="gearGlyph">' +
      (x ? x.n : q ? "Ancien objet" : "+") +
      "</div></div><small>" +
      s +
      "</small>";
    if (q?.locked) {
      const tag = document.createElement("small");
      tag.textContent = "Verrouillé";
      d.append(tag);
    }
    if (q) {
      const lock = document.createElement("button");
      lock.textContent = q.locked ? "Déverrouiller" : "Verrouiller";
      lock.onclick = (event) => {
        event.stopPropagation();
        toggleItemLock(q.uid);
      };
      d.append(lock);
    }
    if (x) d.onclick = () => uneq(s);
    w.append(d);
  });
  $("sets").textContent = txt(sb()) || "Aucun bonus de panoplie actif";
  let e = $("bag");
  e.innerHTML = "";
  let ready = D.bag.slice().filter((q) => meta(q.id));
  let pending = D.bag.length - ready.length;
  $("bagSort").value = INVENTORY_SORTS.includes(D.inventorySort)
    ? D.inventorySort
    : "jetDesc";
  document
    .querySelectorAll("#bagFilters input")
    .forEach(
      (input) =>
        (input.checked = visibleInventorySlots().includes(input.value)),
    );
  const visible = sortedInventory(ready, $("bagSort").value).filter(
    (q) =>
      visibleInventorySlots().includes(meta(q.id).s) &&
      meta(q.id).n.toLowerCase().includes(search),
  );
  saleSelection = new Set(
    [...saleSelection].filter((uid) =>
      visible.some((q) => q.uid === uid && !q.locked),
    ),
  );
  if (
    pendingSale.length &&
    pendingSale.some(
      (item) =>
        !visible.some(
          (q) => q.uid === item.uid && q.id === item.id && !q.locked,
        ),
    )
  ) {
    pendingSale = [];
    $("saleConfirm").hidden = true;
    $("saleStatus").textContent =
      "Vente annulée : les objets affichés ou leur protection ont changé.";
  }
  $("bagFilteredCount").textContent = visible.length + " objet(s) affiché(s)";
  $("saleSelected").textContent =
    saleSelection.size +
    " sélectionné(s) · " +
    saleSelection.size * 5 +
    " kamas";
  $("sellSelected").disabled = !saleSelection.size;
  visible.forEach((q) => {
    let x = meta(q.id),
      j = jet(q),
      d = document.createElement("div");
    d.className = "item";
    d.dataset.uid = q.uid;
    d.innerHTML =
      '<div class="itemHead"><div><div class="eyebrow">' +
      x.s +
      " · Niv. " +
      x.l +
      '</div><div class="itemName">' +
      x.n +
      '</div></div><b class="' +
      rarity(j) +
      '">Jet ' +
      j +
      '%</b></div><div class="itemStats">' +
      Object.entries(q.st)
        .map(
          ([k, v]) =>
            "<span>" +
            k +
            " <b>" +
            (v >= 0 ? "+" : "") +
            v +
            '</b><div class="itemRange">Jet possible : ' +
            x.x[k][0] +
            "–" +
            x.x[k][1] +
            "</div></span>",
        )
        .join("") +
      '</div><div class="itemInfo"><b>Provenance</b><div class="mut">' +
      sourceOf(q.id) +
      '</div><b>Conditions</b><div class="mut">Niveau requis : ' +
      x.l +
      '. Autres conditions Dofus absentes de la source locale.</div><b>Jet maximum</b><div class="mut">' +
      ranges(q.id) +
      "</div></div>" +
      comparison(q) +
      '<div class="itemActions"></div>';
    let a = d.querySelector(".itemActions");
    if (x.s === "Anneau" && D.w.Anneau1 && D.w.Anneau2) {
      ["Anneau1", "Anneau2"].forEach((s, i) => {
        let b = document.createElement("button");
        b.textContent = "Remplacer anneau " + (i + 1);
        b.disabled = D.lv < x.l;
        b.onclick = () => equip(q.uid, s);
        a.append(b);
      });
    } else {
      let b = document.createElement("button");
      b.textContent = x.s === "Anneau" ? "Équiper" : "Équiper";
      b.disabled = D.lv < x.l;
      b.onclick = () => equip(q.uid);
      a.append(b);
    }
    let s = document.createElement("button");
    s.textContent = "Vendre · 5 K";
    s.disabled = !!q.locked;
    s.onclick = () => requestSale([q.uid]);
    const lock = document.createElement("button");
    lock.textContent = q.locked ? "Déverrouiller" : "Verrouiller";
    lock.onclick = () => toggleItemLock(q.uid);
    const label = document.createElement("label");
    label.className = "saleChoice";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = saleSelection.has(q.uid);
    check.disabled = !!q.locked;
    check.onchange = () => {
      cancelSaleReview();
      if (check.checked) saleSelection.add(q.uid);
      else saleSelection.delete(q.uid);
      inventory();
    };
    label.append(
      check,
      document.createTextNode(q.locked ? "Verrouillé" : "Sélectionner"),
    );
    a.append(lock, label, s);
    e.append(d);
  });
  if (pending) {
    let d = document.createElement("div");
    d.className = "card mut";
    d.textContent =
      pending +
      " ancien(s) équipement(s) sauvegardé(s) sont conservés mais ne sont plus dans la table locale actuelle.";
    e.append(d);
  }
  if (!e.children.length)
    e.innerHTML =
      '<div class="mut">Aucun objet ne correspond aux filtres.</div>';
}
function spells() {
  $("spPtsTop").textContent = D.spellPts + " point(s)";
  const root = $("spellList");
  root.innerHTML = "";
  if (!playerClass()) return;
  spellBook().forEach((s, i) => {
    const p = spell(i),
      unlocked = spellUnlocked(i),
      d = document.createElement("div");
    d.className = "card" + (unlocked ? "" : " locked");
    d.dataset.spell = String(i);
    d.innerHTML =
      "<b>" +
      s.n +
      '</b><div class="mut">' +
      (unlocked
        ? "Rang " + spellRank(i) + "/6"
        : "Déblocage niveau " + s.level) +
      " · " +
      p[2] +
      " PA · " +
      s.e +
      "</div><div>" +
      spellEffectText(s, p) +
      '</div><div class="mut">' +
      (s.cd ? "Relance " + s.cd + " tours" : "3 lancers maximum par tour") +
      "</div>";
    const button = document.createElement("button");
    const cost = spellUpgradeCost(i);
    button.textContent = !unlocked
      ? "Niveau " + s.level + " requis"
      : !cost
        ? "Rang 6 · maximum"
        : "Améliorer · " + cost + " point" + (cost > 1 ? "s" : "");
    button.disabled = !unlocked || !cost || D.spellPts < cost;
    button.onclick = () => upSpell(i);
    d.append(button);
    root.append(d);
  });
}
function collection() {
  renderEquipmentSearch(M);
  renderLocalBestiary(BESTIARY, M);
  let a = $("achievements");
  a.innerHTML = "";
  ACH.forEach((x) => {
    let d = document.createElement("div");
    d.className = "card";
    d.innerHTML =
      "<b>" +
      (D.claimed[x[0]] ? "Terminé · " : "") +
      x[1] +
      '</b><div class="mut">' +
      x[2] +
      "</div>";
    a.append(d);
  });
}
// Keep persistent zone IDs; progression follows the displayed difficulty order.
let ZONE_ORDER = Z.map((zone, id) => ({ zone, id }))
  .sort((a, b) => a.zone[1] - b.zone[1] || a.id - b.id)
  .map(({ id }) => id);
function hardWins(id) {
  return D.encounterWins[id + ":2"] || 0;
}
function zoneOpen(id) {
  return ZONE_ORDER.includes(id) && !!Z[id];
}
function zoneRequirement(id) {
  return "";
}
function picker() {
  let z = $("zones");
  z.innerHTML = "";
  ZONE_ORDER.forEach((i) => {
    const x = Z[i];
    let ok = zoneOpen(i),
      b = document.createElement("button");
    b.dataset.zone = String(i);
    b.className = "choice " + (D.z === i ? "sel" : "");
    b.disabled = !ok;
    b.innerHTML =
      "<b>" +
      x[0] +
      "</b> · niv. " +
      Z[i][1] +
      "–" +
      Math.max(...M.filter((m) => monsterInZone(m, i)).map((m) => m.l)) +
      " " +
      (ok ? "" : zoneRequirement(i));
    b.onclick = () => {
      D.z = i;
      render();
    };
    z.append(b);
  });
  $("zoneTitle").textContent = Z[D.z][0] + " · choisir un combat";
  let e = $("mobs");
  e.innerHTML = "";
  ENCOUNTER_TIERS[D.z].forEach((slots, tier) => {
    const key = D.z + ":" + tier,
      n = D.encounterWins[key] || 0,
      b = document.createElement("button");
    b.className = "choice";
    const names = slots
      .map(
        (pool) =>
          pool
            .slice(0, 3)
            .map((id) => M.find((m) => m.sourceId === id).n)
            .join(" / ") +
          (pool.length > 3 ? " / +" + (pool.length - 3) + " variantes" : ""),
      )
      .join(" + ");
    b.innerHTML =
      "<b>Combat " +
      (tier + 1) +
      " · " +
      ["Facile", "Intermédiaire", "Difficile"][tier] +
      '</b><br><span class="mut">' +
      slots.length +
      " monstre(s) · " +
      names +
      "<br>" +
      n +
      " victoire(s)" +
      (n >= 10 ? " · Auto disponible" : "") +
      "</span>";
    b.disabled = !playerClass();
    b.onclick = () => startEncounter(D.z, tier);
    e.append(b);
  });
  if (
    D.z === 2 ||
    (WORLD &&
      Z[D.z][0].toLowerCase().includes("bouftou") &&
      [101, 4822, 148, 147].every((id) => M.some((m) => m.sourceId === id)))
  ) {
    let b = document.createElement("button");
    b.className = "choice boss";
    b.innerHTML = "<b>Donjon des Bouftous</b> · 4 salles";
    b.disabled = !playerClass();
    b.disabled = ![101, 4822, 148, 147].every((id) =>
      M.some((m) => m.sourceId === id),
    );
    b.onclick = startDungeon;
    e.append(b);
  }
}
function fight() {
  let m = mob(),
    h = mh(),
    unlocked = autoWins() >= 10;
  $("fightZone").textContent = Z[D.z][0];
  $("turn").textContent = auto
    ? "Combat automatique"
    : D.tr
      ? "À toi de jouer"
      : "Tour ennemi";
  $("enemyGroup").innerHTML = "";
  if (encounter)
    encounter.members.forEach((enemy, index) => {
      let type = M.find((x) => x.id === enemy.id),
        button = document.createElement("button");
      button.className = "choice " + (targetIndex === index ? "sel" : "");
      button.disabled = enemy.hp <= 0 || auto || !D.tr || D.end;
      button.textContent =
        type.n +
        " · " +
        enemy.hp +
        "/" +
        type.h +
        " PV" +
        (enemy.hp <= 0 ? " · Vaincu" : index === targetIndex ? " · Cible" : "");
      button.onclick = () => selectTarget(index);
      $("enemyGroup").append(button);
    });
  $("mobName").textContent = m.n;
  $("mobInfo").textContent =
    "Niv. " +
    m.l +
    " · " +
    m.h +
    " PV · " +
    (D.master[m.id] || 0) +
    " victoire(s)";
  $("enemyHp").textContent = D.eh + " / " + m.h + " PV";
  $("enemyBar").style.width = (100 * D.eh) / m.h + "%";
  $("fightHp").textContent = D.hp + " / " + h + " PV";
  $("playerBar").style.width = (100 * D.hp) / h + "%";
  $("fightPa").textContent = PA + " / " + maxpa() + " PA";
  $("roundTxt").textContent = "Tour " + D.rd;
  let e = $("combatSpells");
  e.innerHTML = "";
  spellBook().forEach((s, i) => {
    const p = spell(i),
      b = document.createElement("button");
    b.disabled = auto || !canCast(i);
    b.dataset.spell = String(i);
    const waiting = Math.max(0, (effects.cooldowns[i] || 0) - D.rd);
    const status = !spellUnlocked(i)
      ? "Niveau " + s.level + " requis"
      : waiting
        ? "Disponible dans " + waiting + " tour(s)"
        : p[2] + " PA · " + s.e;
    b.innerHTML =
      "<b>" +
      s.n +
      "</b><br>" +
      status +
      '<br><span class="mut">' +
      spellEffectText(s, p) +
      "</span>";
    b.onclick = () => cast(i);
    e.append(b);
  });
  $("fightEffects").textContent = [
    effects.shield ? effects.shield + " bouclier" : "",
    effects.buff ? "Puissance +" + effects.buff + " %" : "",
    effects.focus ? "Prochaine attaque +" + effects.focus + " %" : "",
    effects.summons.length ? effects.summons.length + " invocation(s)" : "",
    effects.bombs.length ? effects.bombs.length + " bombe(s)" : "",
    effects.rage ? "Rage " + effects.rage + "/3" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  $("endBtn").disabled = auto || !D.tr;
  $("autoBtn").disabled = !unlocked || !!dungeon;
  $("autoBtn").textContent = unlocked
    ? auto
      ? "Arrêter le mode automatique"
      : "Mode automatique"
    : "Auto : " + autoWins() + "/10 victoires sur ce combat";
}
function combatProgress() {
  const next = D.lv === MAX_LEVEL ? 1 : need(D.lv);
  const xp = D.lv === MAX_LEVEL ? 1 : Math.max(0, Math.min(next, D.xp));
  const percent = (100 * xp) / next;
  $("combatLevel").textContent = "Niveau " + D.lv;
  $("combatXpPercent").textContent = Math.floor(percent) + " %";
  $("combatXpText").textContent =
    D.lv === MAX_LEVEL
      ? "Niveau 200 · maximum atteint"
      : xp +
        " / " +
        next +
        " XP · " +
        (next - xp) +
        " XP avant le niveau " +
        (D.lv + 1);
  $("combatXpBar").style.width = percent + "%";
  $("combatXpTrack").setAttribute("aria-valuemin", "0");
  $("combatXpTrack").setAttribute("aria-valuemax", String(next));
  $("combatXpTrack").setAttribute("aria-valuenow", String(xp));
  $("combatXpTrack").setAttribute(
    "aria-valuetext",
    $("combatXpText").textContent,
  );
}
function result() {
  let m = M.find((x) => x.id === lastResult.mid);
  $("resultMob").textContent = (lastResult.ids || [m.id])
    .map((id) => M.find((x) => x.id === id).n)
    .join(" + ");
  const levels = lastResult.levelsGained || 0;
  $("resultLevelUp").hidden = levels === 0;
  $("resultLevelUp").textContent =
    levels > 0
      ? "Niveau " +
        lastResult.levelAfter +
        " atteint ! · +" +
        levels +
        " niveau" +
        (levels > 1 ? "x" : "")
      : "";
  $("resultNewSpells").textContent = (lastResult.unlocked || []).length
    ? "Nouveaux sorts : " + lastResult.unlocked.join(", ")
    : "";
  $("resultXp").textContent = "+" + lastResult.xp;
  $("resultK").textContent = "+" + lastResult.k;
  $("resultDrops").innerHTML = lastResult.drops.length
    ? lastResult.drops
        .map((q) =>
          q.resourceId
            ? "<div><b>" +
              esc(
                WORLD_ITEMS.get(q.resourceId)?.name || "Objet " + q.resourceId,
              ) +
              "</b> × " +
              q.quantity +
              "</div>"
            : "<div><b>" +
              esc(meta(q.id).n) +
              "</b> · Jet " +
              jet(q) +
              "%</div>",
        )
        .join("")
    : '<span class="mut">Aucun drop cette fois</span>';
}
function render() {
  renderClassChoice();
  combatProgress();
  dashboard();
  inventory();
  resourceInventory();
  spells();
  collection();
  picker();
  $("picker").style.display = mode === "picker" ? "block" : "none";
  $("fight").style.display = mode === "fight" ? "block" : "none";
  $("result").style.display = mode === "result" ? "block" : "none";
  if (mode === "fight") fight();
  if (mode === "result" && lastResult) result();
  save();
}
function show(p) {
  document
    .querySelectorAll(".page")
    .forEach((x) => x.classList.toggle("on", x.id === p));
  document
    .querySelectorAll(".nav button")
    .forEach((x) => x.classList.toggle("on", x.dataset.page === p));
  if (GameSave.authenticated) {
    render();
    if (p === "rosterSelection")
      RosterSelection.open(
        D,
        M.map((m) => m.sourceId),
        save,
      );
  }
}
$("openRosterSelection").onclick = () => show("rosterSelection");
$("resourceSearch").oninput = resourceInventory;
$("rosterBack").onclick = () => show("collection");
document
  .querySelectorAll(".nav button")
  .forEach((b) => (b.onclick = () => show(b.dataset.page)));
$("bagSearch").oninput = inventory;
$("selectSaleVisible").onclick = () => {
  cancelSaleReview();
  saleSelection = new Set(
    D.bag
      .filter(
        (q) =>
          meta(q.id) &&
          !q.locked &&
          visibleInventorySlots().includes(meta(q.id).s) &&
          meta(q.id)
            .n.toLowerCase()
            .includes($("bagSearch").value.toLowerCase()),
      )
      .map((q) => q.uid),
  );
  inventory();
};
$("clearSaleSelection").onclick = () => {
  cancelSaleReview();
  saleSelection.clear();
  inventory();
};
$("sellSelected").onclick = () => requestSale([...saleSelection]);
$("cancelSale").onclick = cancelSaleReview;
$("confirmSale").onclick = confirmSale;
$("resetStatsBtn").onclick = () => {
  $("resetStatsConfirm").hidden = false;
};
$("cancelResetStats").onclick = () => {
  $("resetStatsConfirm").hidden = true;
};
$("confirmResetStats").onclick = () => {
  resetCharacteristics();
  $("resetStatsConfirm").hidden = true;
};
document.querySelectorAll("#bagFilters input").forEach(
  (input) =>
    (input.onchange = () => {
      D.inventorySlots = [
        ...document.querySelectorAll("#bagFilters input:checked"),
      ].map((x) => x.value);
      inventory();
      save();
    }),
);
$("bagAll").onclick = () => {
  D.inventorySlots = [...INVENTORY_SLOTS];
  inventory();
  save();
};
$("bagNone").onclick = () => {
  D.inventorySlots = [];
  inventory();
  save();
};
$("bagSort").onchange = () => {
  D.inventorySort = $("bagSort").value;
  inventory();
  save();
};
$("endBtn").onclick = enemy;
$("autoBtn").onclick = toggleAuto;
$("backMob").onclick = () => {
  fightToken++;
  auto = false;
  clearTimeout(autoTimer);
  dungeon = null;
  mode = "picker";
  render();
};
$("again").onclick = () =>
  lastResult.key
    ? startEncounter(lastResult.zone, lastResult.tier)
    : startFight(lastResult.mid);
$("changeMob").onclick = () => {
  mode = "picker";
  render();
};
$("changeZone").onclick = () => {
  D.z = 0;
  mode = "picker";
  render();
};
$("classSelect").onchange = () => previewClass($("classSelect").value);
$("chooseClassBtn").onclick = () => previewClass(pendingClass);
let creatingCharacter = false;
$("confirmClassBtn").onclick = async () => {
  if (creatingCharacter || mode === "fight") return;
  const id = pendingClass;
  if (D.k < classChangeCost(id)) return;
  creatingCharacter = true;
  $("confirmClassBtn").disabled = true;
  $("characterError").textContent = "";
  try {
    if (!GameSave.profile)
      await GameSave.createCharacter($("nicknameInput").value);
    if (D.classId !== id) chooseClass(id);
    else {
      classPreviewOpen = false;
      render();
    }
    await GameSave.flush();
  } catch (error) {
    $("characterError").textContent = error.message;
  } finally {
    creatingCharacter = false;
    renderClassChoice();
  }
};
async function loadLadder() {
  $("ladderStatus").textContent = "Chargement du classement…";
  $("ladderEntries").replaceChildren();
  try {
    if (GameSave.authenticated) await GameSave.flush();
    const response = await fetch("/api/ladder", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw Error("Classement indisponible. Réessaie.");
    const { entries } = await response.json();
    $("ladderStatus").textContent = entries.length
      ? ""
      : "Aucun personnage classé pour le moment.";
    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "card";
      const name = document.createElement("b");
      name.textContent =
        "#" + entry.rank + " · " + entry.nickname + (entry.own ? " · Toi" : "");
      const detail = document.createElement("div");
      detail.className = "mut";
      detail.textContent =
        (CLASSES.find((c) => c.id === entry.classId)?.name || "Aventurier") +
        " · Niveau " +
        entry.level +
        " · " +
        Number(entry.xp).toLocaleString("fr-FR") +
        " XP";
      row.style.overflowWrap = "anywhere";
      row.append(name, detail);
      $("ladderEntries").append(row);
    });
  } catch (error) {
    $("ladderStatus").textContent = error.message;
  }
}
$("ladderBtn").onclick = () => {
  show("ladderPage");
  loadLadder();
};
$("ladderRefresh").onclick = loadLadder;
$("shareBtn").onclick = async () => {
  const url = location.origin + "/";
  try {
    await navigator.clipboard.writeText(url);
    $("shareStatus").textContent = "Lien copié : envoie-le à tes amis.";
  } catch {
    $("shareStatus").textContent = "Lien à partager : " + url;
  }
};
$("backClassBtn").onclick = () => {
  classPreviewOpen = false;
  renderClassChoice();
};
$("classDashboardBtn").onclick = () => show("spellsPage");
async function boot() {
  let originalSave = await GameSave.initialize();
  if (!GameSave.authenticated) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("on"));
    document.querySelector(".nav").hidden = true;
    $("saveNow").disabled = true;
    $("authGate").hidden = false;
    return;
  }
  try {
    let x = JSON.parse(originalSave);
    if (x) D = { ...D, ...x };
  } catch (e) {}
  D.lv = Math.min(MAX_LEVEL, Math.max(1, D.lv || 1));
  if (D.lv === MAX_LEVEL) D.xp = 0;
  D.master = D.master || {};
  D.encounterWins = D.encounterWins || {};
  D.boss = D.boss || {};
  D.seen = D.seen || {};
  D.claimed = D.claimed || {};
  D.spellLv = D.spellLv || [1, 1, 1, 1, 1, 1];
  migrateClassSave(D);
  pendingClass = D.classId || "iop";
  D.w = {
    Coiffe: null,
    Cape: null,
    Amulette: null,
    Anneau1: null,
    Anneau2: null,
    Ceinture: null,
    Bottes: null,
    ...(D.w || {}),
  };
  try {
    let files = [
      "dofus-equipment-1-40.json",
      "dofus-item-sets.json",
      "dofus-bestiary-1-40.json",
      "game-world.json",
    ];
    let [eq, sets, bestiary, world] = await Promise.all(
      files.map(async (f) => {
        let r = await fetch(f + "?v=3.12.1");
        if (!r.ok) throw Error(f + " : HTTP " + r.status);
        return r.json();
      }),
    );
    buildLocalData(eq, sets);
    BESTIARY = bestiary.monsters || [];
    M = buildCombatData(BESTIARY);
    if (M.some((m) => !lootPool(m).length))
      throw Error("Table de drop de famille incomplète");
    if (!M.length || !Object.keys(I).length)
      throw Error("Données locales incomplètes");
    if (originalSave && !D.localCombatMigration) {
      try {
        localStorage.setItem("idleMastersBackupBefore332", originalSave);
      } catch (e) {}
      migrateCombatSave(D, M);
    }
    D.localCombatMigration = 1;
    activateWorld(world);
    if (!M.some((m) => m.id === D.mid)) D.mid = M[0].id;
    if (!Z[D.z] || !zoneOpen(D.z))
      D.z = ZONE_ORDER.filter(zoneOpen).at(-1) ?? ZONE_ORDER[0];
    D.hp = mh();
    PA = maxpa();
    checkAch();
    render();
    if (!playerClass() || !GameSave.profile) {
      show("spellsPage");
      if (playerClass()) previewClass(D.classId);
    }
  } catch (e) {
    console.error(e);
    let status = document.createElement("div");
    status.className = "panel bad";
    status.textContent =
      "Impossible de charger les données du jeu. Recharge la page. Si tu ouvres le fichier directement, utilise un serveur HTTP pour charger les fichiers JSON. " +
      e.message;
    document.querySelector(".wrap").prepend(status);
    document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  }
}
boot();
