/* Source names, levels and HP come from the checked-in Dofus snapshot.
 * Zones, damage, rewards, boss encounter and dungeon sequence are game rules.
 * Explicit selection avoids treating quest actors and summons as wild encounters. */
const COMBAT_ROSTER = [
  [4785, 0, "Air"],
  [36, 0, "Terre"],
  [4784, 0, "Air"],
  [4561, 0, "Air"],
  [2781, 0, "Terre"],
  [489, 1, "Feu"],
  [490, 1, "Terre"],
  [491, 1, "Eau"],
  [492, 1, "Air"],
  [493, 1, "Air"],
  [236, 1, "Air"],
  [52, 1, "Terre"],
  [61, 1, "Air"],
  [31, 1, "Eau"],
  [134, 2, "Terre"],
  [149, 2, "Neutre"],
  [101, 2, "Terre"],
  [4822, 2, "Terre"],
  [148, 2, "Neutre"],
  [147, 2, "Terre", "tainela"],
  [103, 3, "Feu"],
  [104, 3, "Terre"],
  [54, 3, "Neutre"],
];
// Explicit Idle Masters loot assignments. Set IDs come from local equipment data.
const FAMILY_LOOT = {
  4785: { setId: 50 },
  4784: { setId: 50 },
  4561: { setId: 50 },
  36: { setId: 1 },
  134: { setId: 1 },
  149: { setId: 1 },
  2781: { setId: 1 },
  101: { setId: 1 },
  4822: { setId: 1 },
  148: { setId: 1 },
  147: { setId: 4 },
  489: { setId: 60 },
  491: { setId: 61 },
  236: { setId: 62 },
  492: { setId: 70 },
  493: { setId: 71 },
  490: { setId: 72 },
  52: { setId: 22 },
  61: { setId: 23 },
  31: { setId: 33 },
  103: { setId: 31 },
  104: { setId: 21 },
  // No Chafer set in the local snapshot; use its named equipment instead.
  54: { itemIds: [458] },
};
function buildCombatData(monsters) {
  const source = new Map(monsters.map((m) => [m.id, m]));
  return COMBAT_ROSTER.map(([id, z, e, boss]) => {
    const m = source.get(id);
    if (!m || m.hpMin <= 0) throw Error("Monstre local manquant : " + id);
    const l = m.minLevel;
    return {
      id: "m" + id,
      sourceId: id,
      z,
      n: m.name,
      l,
      maxLevel: m.maxLevel,
      h: m.hpMin,
      hpMax: m.hpMax,
      pa: m.pa,
      pm: m.pm,
      raceId: m.raceId,
      e,
      boss,
      a: [
        Math.max(2, Math.round(l * 0.35 + 2)),
        Math.max(4, Math.round(l * 0.5 + 4)),
      ],
      xp: Math.round(25 + l * 12 + (boss ? 200 : 0)),
      k: [Math.max(1, l), Math.max(3, l * 2)],
    };
  });
}
function migrateCombatSave(state, monsters) {
  // Keep all unrecognised legacy records; never erase an item on a failed match.
  const aliases = {
    tofu: "m4785",
    bouf: "m36",
    chef: "m148",
    br: "m147",
    piou: "m489",
    arak: "m52",
    boar: "m104",
    prespic: "m103",
  };
  for (const [old, id] of Object.entries(aliases)) {
    if (state.master[old]) {
      state.master[id] = (state.master[id] || 0) + state.master[old];
      delete state.master[old];
    }
  }
  state.mid = aliases[state.mid] || state.mid;
  const items = [...state.bag, ...Object.values(state.w).filter(Boolean)];
  state.uid = Math.max(
    state.uid || 1,
    ...items.map((q) => (Number(q.uid) || 0) + 1),
  );
  for (const [slot, q] of Object.entries(state.w)) {
    if (q && meta(q.id) && meta(q.id).l > state.lv) {
      state.bag.push(q);
      state.w[slot] = null;
    }
  }
}

// Each slot rolls independently within its pool; groups grow from one to three enemies.
const ENCOUNTER_TIERS = [
  [[[4785, 4784]], [[4785, 4784], [36]], [[4785, 4784], [36], [4561, 2781]]],
  [
    [[489, 490, 491, 492, 493, 236]],
    [
      [489, 490, 491, 492, 493, 236],
      [52, 61, 31],
    ],
    [
      [489, 490, 491, 492, 493, 236],
      [52, 61, 31],
      [52, 61, 31],
    ],
  ],
  [
    [[134, 149]],
    [
      [134, 149],
      [101, 4822],
    ],
    [[134, 149], [101, 4822], [148]],
  ],
  [
    [[103, 104]],
    [
      [103, 104],
      [103, 104],
    ],
    [[103, 104], [103, 104], [54]],
  ],
];
function rollEncounter(zone, tier, random = Math.random) {
  const slots = ENCOUNTER_TIERS[zone]?.[tier];
  if (!slots) throw Error("Combat inconnu");
  return slots.map(
    (pool) =>
      "m" + pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))],
  );
}
