const Z = [["Incarnam"], ["Astrub"], ["Tainéla"], ["Forêt d’Astrub"]];
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
function buildLocalData(eq, sets) {
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
  let hi = Math.min(40, (m.maxLevel || m.l) + 5),
    lo = Math.max(1, m.l - 5);
  return EQ.filter((x) => x.level >= lo && x.level <= hi && I["d" + x.id]);
}
function mobDrops(m) {
  return lootPool(m).map((x) => "d" + x.id);
}
const BASE = [
  ["Pression", "Terre", 3, 16, 22, "dmg"],
  ["Flamiche", "Feu", 2, 9, 13, "dmg"],
  ["Vague", "Eau", 3, 15, 21, "dmg"],
  ["Lame de vent", "Air", 3, 14, 23, "dmg"],
  ["Coup brutal", "Neutre", 4, 25, 32, "dmg"],
  ["Soin mineur", "Soin", 3, 13, 20, "heal"],
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
  return x ? "Équipement Dofus niv. " + x.l : "Inconnue";
}
function ranges(id) {
  let x = meta(id);
  return x
    ? Object.entries(x.x)
        .map(([k, v]) => k + " " + v[0] + "–" + v[1])
        .join(" · ")
    : "";
}
function sb() {
  let c = {},
    o = {},
    seen = new Set();
  Object.values(D.w).forEach((q) => {
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
function gt() {
  let t = {};
  Object.values(D.w).forEach((q) => {
    if (q && meta(q.id))
      for (let [k, v] of Object.entries(q.st || {})) t[k] = (t[k] || 0) + v;
  });
  for (let [k, v] of Object.entries(sb())) t[k] = (t[k] || 0) + v;
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
  localStorage.setItem("idleMastersV2", JSON.stringify(D));
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
  let b = BASE[i],
    l = D.spellLv[i] || 1,
    add = (l - 1) * 2;
  return [b[0], b[1], b[2], b[3] + add, b[4] + add * 2, b[5]];
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
  let pool = mobDrops(m);
  return pool.includes(id) ? equipmentChance() / pool.length : 0;
}
function gainxp(x) {
  let g = Math.floor(x * (1 + wis() / 100));
  D.xp += g;
  while (D.xp >= need(D.lv)) {
    D.xp -= need(D.lv);
    D.lv++;
    D.pts += 5;
    D.bh += 8;
    if (D.lv % 2 === 0) D.spellPts++;
  }
  return g;
}
function loot() {
  let out = [],
    pool = mobDrops(mob());
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
  let m = mob(),
    kg = R(m.k[0], m.k[1]),
    xg = gainxp(m.xp),
    drops = loot();
  D.k += kg;
  D.master[m.id] = (D.master[m.id] || 0) + 1;
  if (m.boss) D.boss[m.boss] = (D.boss[m.boss] || 0) + 1;
  D.hp = mh();
  D.end = true;
  D.tr = false;
  checkAch();
  if (auto && !dungeon) {
    lastResult = { mid: m.id, xp: xg, k: kg, drops };
    save();
    render();
    return (autoTimer = setTimeout(() => startFight(m.id, false, true), 650));
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
  lastResult = { mid: m.id, xp: xg, k: kg, drops };
  mode = "result";
  save();
  render();
}
function cast(i) {
  if (!D.tr || D.end) return;
  let p = spell(i);
  if (PA < p[2]) return;
  PA -= p[2];
  if (p[5] === "heal") {
    let h = Math.max(
      0,
      Math.floor(R(p[3], p[4]) * (1 + st("Intelligence") / 100)) + st("Soins"),
    );
    D.hp = Math.min(mh(), D.hp + h);
    lg("Soin : +" + h + " PV");
  } else {
    let d = Math.max(
      0,
      Math.floor(R(p[3], p[4]) * (1 + bonus(p[1]) / 100)) +
        st("Dommages") +
        st(p[1]),
    );
    D.eh = Math.max(0, D.eh - d);
    lg(p[0] + " : " + d + " dégâts");
    if (D.eh <= 0) return victory();
  }
  render();
}
function enemy() {
  if (!D.tr || D.end) return;
  D.tr = false;
  let token = fightToken;
  render();
  setTimeout(() => {
    if (token !== fightToken || mode !== "fight") return;
    let m = mob(),
      d = R(m.a[0], m.a[1]);
    if (m.boss && D.rd % 3 === 0) d = Math.floor(d * 1.5);
    D.hp = Math.max(0, D.hp - d);
    lg(m.n + " : -" + d + " PV");
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
  BASE.forEach((_, i) => {
    let p = spell(i);
    if (p[5] === "dmg" && p[2] <= PA) {
      let s = (((p[3] + p[4]) / 2) * (1 + bonus(p[1]) / 100)) / p[2];
      if (s > score) {
        score = s;
        best = i;
      }
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
function toggleAuto() {
  if ((D.master[D.mid] || 0) < 10) {
    alert("Mode automatique débloqué après 10 victoires sur ce monstre.");
    return;
  }
  auto = !auto;
  if (auto) scheduleAuto();
  else clearTimeout(autoTimer);
  render();
}
function startFight(id, keepDungeon = false, fromAuto = false) {
  clearTimeout(autoTimer);
  let chosen = M.find((x) => x.id === id);
  if (!chosen || !zoneOpen(chosen.z)) return;
  fightToken++;
  D.mid = id;
  let m = mob();
  D.z = m.z;
  D.eh = m.h;
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
function startDungeon() {
  auto = false;
  dungeon = { step: 0 };
  startFight("m101", true);
}
function statCost(n) {
  if (n === "Sagesse") return 3;
  return Math.floor((D.inv[n] || 0) / 50) + 1;
}
function spend(n) {
  let c = statCost(n);
  if (D.pts >= c) {
    D.pts -= c;
    D.inv[n]++;
    render();
  }
}
function upSpell(i) {
  if (D.spellPts > 0 && (D.spellLv[i] || 1) < 5) {
    D.spellPts--;
    D.spellLv[i] = (D.spellLv[i] || 1) + 1;
    render();
  }
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
function sell(u) {
  let j = D.bag.findIndex((x) => x.uid === u);
  if (j >= 0) {
    D.k += 5;
    D.bag.splice(j, 1);
    render();
  }
}
function comparison(q) {
  let x = meta(q.id);
  if (!x) return "";
  let slots = x.s === "Anneau" ? ["Anneau1", "Anneau2"] : [x.s],
    h = "";
  slots.forEach((s) => {
    let eq = D.w[s];
    if (!eq || !meta(eq.id)) {
      h += '<div class="compare good">' + s + " libre</div>";
      return;
    }
    let keys = [
      ...new Set([...Object.keys(q.st || {}), ...Object.keys(eq.st || {})]),
    ];
    h +=
      '<div class="compare"><small>' + s + " · " + meta(eq.id).n + "</small>";
    keys.forEach((k) => {
      let a = q.st[k] || 0,
        b = eq.st[k] || 0,
        d = a - b;
      h +=
        '<div class="compareLine"><span>' +
        k +
        " : " +
        a +
        '</span><b class="' +
        (d > 0 ? "good" : d < 0 ? "bad" : "mut") +
        '">' +
        (d > 0 ? "+" : "") +
        d +
        "</b></div>";
    });
    h += "</div>";
  });
  return h;
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
  $("xpTxt").textContent = D.xp + " / " + n + " XP";
  $("xpBar").style.width = (D.xp / n) * 100 + "%";
  $("dashHp").textContent = mh();
  $("dashPa").textContent = maxpa();
  $("dashK").textContent = D.k;
  $("pts").textContent = D.pts;
  $("quickPts").textContent = D.pts;
  $("spellPts").textContent = D.spellPts;
  $("quickSeen").textContent = Object.keys(D.seen || {}).length;
  $("quickBag").textContent = D.bag.length;
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
    if (x) d.onclick = () => uneq(s);
    w.append(d);
  });
  $("sets").textContent = txt(sb()) || "Aucun bonus de panoplie actif";
  let e = $("bag");
  e.innerHTML = "";
  let ready = D.bag.slice().filter((q) => meta(q.id));
  let pending = D.bag.length - ready.length;
  ready
    .sort((a, b) => jet(b) - jet(a))
    .filter((q) => meta(q.id).n.toLowerCase().includes(search))
    .forEach((q) => {
      let x = meta(q.id),
        j = jet(q),
        d = document.createElement("div");
      d.className = "item";
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
      s.onclick = () => sell(q.uid);
      a.append(s);
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
    e.innerHTML = '<div class="mut">Aucun objet dans le sac.</div>';
}
function spells() {
  $("spPtsTop").textContent = D.spellPts + " point(s)";
  let e = $("spellList");
  e.innerHTML = "";
  BASE.forEach((_, i) => {
    let p = spell(i),
      l = D.spellLv[i] || 1,
      d = document.createElement("div");
    d.className = "card";
    d.innerHTML =
      "<b>" +
      p[0] +
      '</b><div class="mut">Niv. ' +
      l +
      "/5 · " +
      p[2] +
      " PA · " +
      p[1] +
      "</div><div>" +
      p[3] +
      "–" +
      p[4] +
      "</div>";
    let b = document.createElement("button");
    b.textContent = "Améliorer";
    b.disabled = !D.spellPts || l >= 5;
    b.onclick = () => upSpell(i);
    d.append(b);
    e.append(d);
  });
}
function collection() {
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
function zoneWins(z) {
  return M.filter((m) => m.z === z).reduce(
    (n, m) => n + (D.master[m.id] || 0),
    0,
  );
}
function zoneOpen(i) {
  return (
    i === 0 ||
    (i === 1 && (D.boss.incarnam || zoneWins(0) >= 10)) ||
    (i === 2 && (D.boss.astrub || zoneWins(1) >= 10)) ||
    (i === 3 && (D.boss.tainela || D.master.m147 >= 1))
  );
}
function picker() {
  let z = $("zones");
  z.innerHTML = "";
  Z.forEach((x, i) => {
    let ok = zoneOpen(i),
      b = document.createElement("button");
    b.className = "choice " + (D.z === i ? "sel" : "");
    b.disabled = !ok;
    b.innerHTML =
      "<b>" +
      x[0] +
      "</b> " +
      (ok
        ? ""
        : i === 3
          ? "— vaincre le Bouftou Royal"
          : "— 10 victoires dans la zone précédente");
    b.onclick = () => {
      D.z = i;
      render();
    };
    z.append(b);
  });
  let e = $("mobs");
  e.innerHTML = "";
  M.filter((m) => m.z === D.z).forEach((m) => {
    let n = D.master[m.id] || 0,
      b = document.createElement("button");
    b.className = "choice " + (m.boss ? "boss" : "");
    b.innerHTML =
      "<b>" +
      m.n +
      "</b> · Niv. " +
      m.l +
      '<br><span class="mut">' +
      n +
      " victoire(s)" +
      (n >= 10 ? " · Auto disponible" : "") +
      "</span>";
    b.onclick = () => startFight(m.id);
    e.append(b);
  });
  if (D.z === 2) {
    let b = document.createElement("button");
    b.className = "choice boss";
    b.innerHTML = "<b>Donjon des Bouftous</b> · 4 salles";
    b.onclick = startDungeon;
    e.append(b);
  }
}
function fight() {
  let m = mob(),
    h = mh(),
    unlocked = (D.master[m.id] || 0) >= 10;
  $("fightZone").textContent = Z[m.z][0];
  $("turn").textContent = auto
    ? "Combat automatique"
    : D.tr
      ? "À toi de jouer"
      : "Tour ennemi";
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
  BASE.forEach((_, i) => {
    let p = spell(i),
      b = document.createElement("button");
    b.disabled = auto || !D.tr || PA < p[2];
    b.innerHTML =
      "<b>" + p[0] + "</b><br>" + p[2] + " PA · " + p[3] + "–" + p[4];
    b.onclick = () => cast(i);
    e.append(b);
  });
  $("endBtn").disabled = auto || !D.tr;
  $("autoBtn").disabled = !unlocked || !!dungeon;
  $("autoBtn").textContent = unlocked
    ? auto
      ? "Arrêter le mode automatique"
      : "Mode automatique"
    : "Auto : " + (D.master[m.id] || 0) + "/10 victoires";
}
function result() {
  let m = M.find((x) => x.id === lastResult.mid);
  $("resultMob").textContent = m.n;
  $("resultXp").textContent = "+" + lastResult.xp;
  $("resultK").textContent = "+" + lastResult.k;
  $("resultDrops").innerHTML = lastResult.drops.length
    ? lastResult.drops
        .map(
          (q) => "<div><b>" + meta(q.id).n + "</b> · Jet " + jet(q) + "%</div>",
        )
        .join("")
    : '<span class="mut">Aucun équipement cette fois</span>';
}
function render() {
  dashboard();
  inventory();
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
  render();
}
document
  .querySelectorAll(".nav button")
  .forEach((b) => (b.onclick = () => show(b.dataset.page)));
$("bagSearch").oninput = inventory;
$("sortBtn").onclick = inventory;
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
$("again").onclick = () => startFight(lastResult.mid);
$("changeMob").onclick = () => {
  mode = "picker";
  render();
};
$("changeZone").onclick = () => {
  D.z = 0;
  mode = "picker";
  render();
};
async function boot() {
  let originalSave = localStorage.getItem("idleMastersV2");
  try {
    let x = JSON.parse(originalSave);
    if (x) D = { ...D, ...x };
  } catch (e) {}
  D.master = D.master || {};
  D.boss = D.boss || {};
  D.seen = D.seen || {};
  D.claimed = D.claimed || {};
  D.spellLv = D.spellLv || [1, 1, 1, 1, 1, 1];
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
    ];
    let [eq, sets, bestiary] = await Promise.all(
      files.map(async (f) => {
        let r = await fetch(f + "?v=3.3.2");
        if (!r.ok) throw Error(f + " : HTTP " + r.status);
        return r.json();
      }),
    );
    buildLocalData(eq, sets);
    BESTIARY = bestiary.monsters || [];
    M = buildCombatData(BESTIARY);
    if (!M.length || !Object.keys(I).length)
      throw Error("Données locales incomplètes");
    if (originalSave && !D.localCombatMigration) {
      localStorage.setItem("idleMastersBackupBefore332", originalSave);
      migrateCombatSave(D, M);
    }
    D.localCombatMigration = 1;
    if (!M.some((m) => m.id === D.mid)) D.mid = M[0].id;
    if (!Z[D.z] || !zoneOpen(D.z)) D.z = 0;
    D.hp = mh();
    PA = maxpa();
    checkAch();
    render();
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
