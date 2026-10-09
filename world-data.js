/* The validated selection is the sole live combat catalogue. */
let WORLD = null,
  WORLD_ITEMS = new Map(),
  EXTRA_EQUIPMENT = {items: [], sets: []};
function monsterInZone(m, zone) {
  return (m.zones || [m.z]).includes(zone);
}
function activateWorld(data, state = D) {
  if (!data) return;
  WORLD = data;
  WORLD_ITEMS = new Map(data.dropItems.map((i) => [i.id, i]));
  const previousZone = Z[state.z]?.[0];
  const fraction = Math.max(0, Math.min(0.999999, state.xp / need(state.lv)));
  const sets = new Map(data.sets.sets.map(set => [set.id, set]));
  for (const set of EXTRA_EQUIPMENT.sets) if (!sets.has(set.id)) sets.set(set.id, set);
  buildLocalData({items: [...data.equipment.items, ...EXTRA_EQUIPMENT.items]}, {sets: [...sets.values()]});
  cleanEquipmentSave(state);
  ensureEquipmentSlots(state);
  Z.length = 0;
  ENCOUNTER_TIERS.length = 0;
  for (const zone of data.zones) {
    Z[zone.id] = [zone.name, zone.level];
    const sorted = [...zone.monsters].sort((a, b) => {
      const first = data.monsters.find((m) => m.id === a),
        second = data.monsters.find((m) => m.id === b);
      return first.hpMin - second.hpMin || a - b;
    });
    const size = Math.max(1, Math.ceil(sorted.length / 3)),
      low = sorted.slice(0, size),
      middle = sorted.slice(size, size * 2),
      high = sorted.slice(size * 2);
    ENCOUNTER_TIERS[zone.id] = [
      [low],
      [low, middle.length ? middle : low],
      [
        low,
        middle.length ? middle : low,
        high.length ? high : middle.length ? middle : low,
      ],
    ];
  }
  ZONE_ORDER = data.zones.map((z) => z.id);
  BESTIARY = data.monsters;
  M = data.monsters.map((m) => ({
    id: "m" + m.id,
    sourceId: m.id,
    z: m.zones[0],
    zones: m.zones,
    n: m.name,
    l: m.minLevel,
    maxLevel: m.maxLevel,
    h: m.hpMin,
    hpMax: m.hpMax,
    pa: m.pa,
    pm: m.pm,
    raceId: m.raceId,
    e: m.element,
    boss: m.id === 147 ? "tainela" : m.boss ? "source" + m.id : null,
    a: [
      Math.max(2, Math.round(m.minLevel * 0.35 + 2)),
      Math.max(4, Math.round(m.minLevel * 0.5 + 4)),
    ],
    xp: m.xp,
    k: [Math.max(1, m.minLevel), Math.max(3, m.minLevel * 2)],
    sourceDrops: m.drops.filter((drop) => I["d" + drop.itemId]),
  }));
  for (const m of M) {
    const level = Math.min(200, m.l);
    const original = new Set(m.sourceDrops.map((d) => d.itemId));
    m.adaptedGearIds = EQ.filter(
      (item) =>
        I["d" + item.id] &&
        Math.abs(item.level - level) <= 10 &&
        !original.has(item.id),
    ).map((item) => "d" + item.id);
  }
  need = (l) => (l >= 200 ? 1 : data.xpNeeds[Math.max(0, l - 1)]);
  if (!state.selectedWorldMigration) {
    state.xp = state.lv >= 200 ? 0 : Math.floor(fraction * need(state.lv));
    state.selectedWorldMigration = 1;
  }
  state.resources ||= {};
  if (!zoneOpen(state.z))
    state.z =
      data.zones.find((z) => z.name === previousZone)?.id ||
      M.find((m) => m.id === state.mid)?.z ||
      ZONE_ORDER[0];
  if (!M.some((m) => m.id === state.mid))
    state.mid = M.find((m) => monsterInZone(m, state.z))?.id || M[0].id;
}
function sourceDropChance(drop) {
  return Math.max(0, Math.min(100, drop.rate * (1 + st("Prospection") / 100)));
}
function sourceLoot(m) {
  const out = [];
  for (const drop of m.sourceDrops) {
    if (!I["d" + drop.itemId] || Math.random() * 100 >= sourceDropChance(drop))
      continue;
    const id = "d" + drop.itemId;
    if (I[id]) {
      const q = roll(id, true);
      D.bag.push(q);
      out.push(q);
    }
  }
  const pool = m.adaptedGearIds || [];
  if (pool.length && Math.random() * 100 < equipmentChance()) {
    const q = roll(pool[R(0, pool.length - 1)], true);
    D.bag.push(q);
    out.push(q);
  }
  return out;
}
function resourceInventory() {
  const root = document.getElementById("resourceList");
  if (!root) return;
  const query = (
    document.getElementById("resourceSearch").value || ""
  ).toLocaleLowerCase("fr");
  const entries = Object.entries(D.resources || {}).filter(
    ([, count]) => count > 0,
  );
  document.getElementById("resourceCount").textContent =
    entries.length + " types d’objets collectés";
  const filtered = entries
    .map(([id, count]) => ({ item: WORLD_ITEMS.get(Number(id)), id, count }))
    .filter(
      (x) =>
        !query ||
        (x.item?.name || x.id).toLocaleLowerCase("fr").includes(query),
    )
    .sort(
      (a, b) =>
        (a.item?.level || 0) - (b.item?.level || 0) ||
        (a.item?.name || "").localeCompare(b.item?.name || "", "fr"),
    );
  const signature = JSON.stringify(filtered);
  if (root.dataset.signature === signature) return;
  root.dataset.signature = signature;
  root.innerHTML =
    filtered
      .map(
        (x) =>
          '<div class="dropRow"><span>' +
          esc(x.item?.name || "Objet " + x.id) +
          ' <small class="mut">· niv. ' +
          (x.item?.level || 1) +
          "</small></span><b>× " +
          x.count +
          "</b></div>",
      )
      .join("") || '<p class="mut">Aucun objet collecté pour ce filtre.</p>';
}
function sourceDropDetails(live) {
  const details = document.createElement("details"),
    summary = document.createElement("summary");
  summary.textContent =
    "Drops · " +
    (live.sourceDrops.length + live.adaptedGearIds.length) +
    " équipements";
  details.append(summary);
  details.addEventListener("toggle", () => {
    if (!details.open || details.dataset.loaded) return;
    details.dataset.loaded = "1";
    const info = document.createElement("p");
    info.className = "mut";
    info.textContent =
      "Un tirage indépendant par équipement. Aucune condition de quête, métier ou événement.";
    details.append(info);
    info.textContent =
      "Drops d’origine conservés. Équipements à ±10 niveaux : " +
      equipmentChance().toFixed(1) +
      " % de chance de recevoir un équipement supplémentaire, partagé entre les items de cette sélection. Aucune condition de quête, métier ou événement.";
    for (const id of mobDrops(live)) {
      const item = meta(id),
        row = document.createElement("div");
      row.className = "dropRow";
      row.innerHTML =
        "<span>" +
        esc(item.n) +
        " · niv. " +
        item.l +
        '</span><span class="dropRate">' +
        dropRate(id, live).toFixed(3) +
        " %</span>";
      details.append(row);
    }
  });
  return details;
}
