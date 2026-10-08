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

// Zone labels and access levels are Idle Masters rules, not source location data.
const EXTRA_ZONES = [
  [
    "Champs d’Astrub",
    16,
    "Terre",
    [4821, 79, 78, 48, 4820, 467, 799, 59, 4819],
  ],
  [
    "Égouts d’Astrub",
    11,
    "Neutre",
    [4818, 474, 4817, 473, 4813, 475, 3205, 465, 255, 126],
  ],
  ["Calanques d’Astrub", 16, "Eau", [922, 921, 924, 920, 923, 928, 112]],
  [
    "Prairies d’Incarnam",
    1,
    "Air",
    [
      3273, 3272, 3270, 3271, 973, 972, 971, 984, 970, 979, 980, 981, 982, 4106,
      4105, 4109, 4108, 4110, 4107, 8017,
    ],
  ],
  ["Cimetière d’Incarnam", 5, "Neutre", [4046, 4047, 4048, 4049, 4050, 4051]],
  ["Territoire des Larves", 11, "Eau", [3359, 5225, 46, 34, 3358]],
  [
    "Nids des Tofus",
    16,
    "Air",
    [
      5222, 801, 805, 1013, 1012, 804, 5224, 98, 4824, 796, 5223, 808, 806, 800,
      1011,
    ],
  ],
  [
    "Cimetière d’Astrub",
    25,
    "Neutre",
    [110, 396, 3240, 108, 3238, 111, 127, 124, 154, 207, 3235, 2976, 2975],
  ],
  ["Forêt des Abraknydes", 27, "Terre", [4000, 256, 47]],
  ["Plaine des Biblops", 24, "Eau", [278, 279, 277, 280]],
  ["Plaine des Scarafeuilles", 30, "Air", [798, 241, 198, 194, 240, 795, 797]],
  ["Campement des Bworks", 32, "Terre", [6904, 62, 6902, 6901, 178, 6900, 74]],
  ["Bois des Champas", 35, "Feu", [654, 655, 653, 652]],
  ["Marécages", 20, "Eau", [150, 498, 495, 496]],
  [
    "Repaire des Bandits",
    35,
    "Neutre",
    [153, 155, 384, 385, 386, 387, 570, 388, 389, 390, 391, 392, 393],
  ],
  [
    "Souterrains d’Astrub",
    32,
    "Neutre",
    [3940, 3944, 3942, 3941, 3943, 3945, 5230, 5228, 5231, 5229],
  ],
  [
    "Plage d’Otomaï",
    36,
    "Eau",
    [1060, 1061, 1063, 1062, 1064, 1065, 1067, 1066, 1022],
  ],
  ["Île des Wabbits", 40, "Terre", [72]],
  ["Montagnes des Kwaks", 16, "Air", [267, 268, 265, 266]],
  [
    "Temples des Dopeuls",
    20,
    "Neutre",
    [
      168, 165, 3976, 166, 162, 7226, 160, 4290, 167, 161, 4777, 2691, 3111,
      455, 169, 163, 3286, 164, 3132,
    ],
  ],
  ["Plaines de Cania", 40, "Terre", [297, 397]],
];
const ZONE_DATA = [
  ["Incarnam", 1],
  ["Astrub", 11],
  ["Tainéla", 22],
  ["Forêt d’Astrub", 22],
  ...EXTRA_ZONES.map(([name, level]) => [name, level]),
];
EXTRA_ZONES.forEach(([, , element, ids], index) => {
  ids.forEach((id) => COMBAT_ROSTER.push([id, index + 4, element]));
});
function assignFamily(ids, table) {
  ids.forEach((id) => {
    FAMILY_LOOT[id] = table;
  });
}
assignFamily([4821, 79, 78, 48, 4820, 467, 799], { setId: 18 });
assignFamily([59], { setId: 24 });
assignFamily([4818, 474, 4817, 255], { setId: 22 });
assignFamily([3359, 5225, 46, 34, 3358], { setId: 33 });
assignFamily(
  [
    5222, 801, 805, 1013, 1012, 804, 5224, 98, 4824, 796, 5223, 808, 806, 800,
    1011, 473, 111, 970,
  ],
  { setId: 50 },
);
assignFamily([973, 972, 971, 984, 8017], { setId: 1 });
assignFamily([922, 921, 924, 920, 923, 928], { setId: 63 });
assignFamily([4046, 4047, 4048, 4049, 4050, 4051], { setId: 375 });
assignFamily([110, 396, 3240, 108, 3238], {
  itemIds: [458],
  label: "Équipements du Chafer",
});
assignFamily([127, 124], { itemIds: [754], label: "Cape du Vampire" });
assignFamily([4000, 256, 47], { setId: 3 });
assignFamily(
  [153, 155, 384, 385, 386, 387, 570, 388, 389, 390, 391, 392, 393],
  { setId: 25 },
);
assignFamily([297], { setId: 21 });
assignFamily([267], { setId: 15 });
assignFamily([268], { setId: 13 });
assignFamily([265], { setId: 2 });
assignFamily([266], { setId: 14 });
// No matching family set in the level-1–40 snapshot: use a labelled level pool.
// Keep named family sets/items out of these generic pools to preserve their provenance.
const RESERVED_LOOT_SETS = new Set(
  Object.values(FAMILY_LOOT)
    .map((t) => t.setId)
    .filter((id) => id != null),
);
const RESERVED_LOOT_ITEMS = new Set(
  Object.values(FAMILY_LOOT).flatMap((t) => t.itemIds || []),
);
const GENERIC_LOOT = [
  { levelRange: [1, 10], label: "Équipements niveau 1–10" },
  { levelRange: [11, 20], label: "Équipements niveau 11–20" },
  { levelRange: [21, 30], label: "Équipements niveau 21–30" },
  { levelRange: [31, 40], label: "Équipements niveau 31–40" },
];
function buildCombatData(monsters) {
  const source = new Map(monsters.map((m) => [m.id, m]));
  buildExtraEncounterTiers(monsters);
  const seen = new Set();
  return COMBAT_ROSTER.map(([id, z, e, boss]) => {
    const m = source.get(id);
    if (!m || m.hpMin <= 0) throw Error("Monstre local manquant : " + id);
    if (seen.has(id)) throw Error("Monstre en double : " + id);
    seen.add(id);
    const l = m.minLevel;
    if (!FAMILY_LOOT[id])
      FAMILY_LOOT[id] = GENERIC_LOOT[Math.min(3, Math.floor((l - 1) / 10))];
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
// Partition by HP, so even the lightest higher-tier roll outweighs the heaviest lower tier.
// Every selected monster belongs to a reachable pool; bosses only occur in the hardest band.
function buildExtraEncounterTiers(monsters) {
  const source = new Map(monsters.map((m) => [m.id, m]));
  EXTRA_ZONES.forEach(([, , , ids], index) => {
    const sorted = [...ids].sort(
      (a, b) => source.get(a).hpMin - source.get(b).hpMin || a - b,
    );
    const size = Math.max(1, Math.ceil(sorted.length / 3));
    const low = sorted.slice(0, size);
    const mid = sorted.slice(size, size * 2);
    const high = sorted.slice(size * 2);
    ENCOUNTER_TIERS[index + 4] = [
      [low],
      [low, mid.length ? mid : low],
      [
        low,
        mid.length ? mid : low,
        high.length ? high : mid.length ? mid : low,
      ],
    ];
  });
}
function rollEncounter(zone, tier, random = Math.random) {
  const slots = ENCOUNTER_TIERS[zone]?.[tier];
  if (!slots) throw Error("Combat inconnu");
  return slots.map(
    (pool) =>
      "m" + pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))],
  );
}
