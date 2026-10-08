/* Idle Masters spellbook: original balancing and effects for this game's arena.
 * Class names are familiar; these are not official Dofus spell tables. */
const CLASS_UNLOCKS = [1, 1, 5, 10, 15, 20, 30, 40];
const CLASS_TYPES = {
  dmg: "Dégâts sur la cible",
  aoe: "Dégâts sur tous les ennemis",
  heal: "Soin personnel",
  drain: "Dégâts et vol de vie",
  poison: "Poison sur la cible",
  shield: "Bouclier personnel",
  buff: "Renforce les dégâts",
  summon: "Invocation",
  regen: "Régénération",
  weaken: "Réduit les dégâts de la cible",
  mark: "Augmente les dégâts reçus par la cible",
  focus: "Renforce la prochaine attaque",
  ap: "Récupère des PA",
  bomb: "Bombe différée",
  detonate: "Fait exploser les bombes",
};
const CLASS_CATALOG = [
  [
    "iop",
    "Iop",
    "Puissance et attaques de groupe",
    "Détermination : les attaques renforcées profitent des bonus de puissance.",
    "none",
    [
      ["Pression", "Terre", "dmg"],
      ["Élan du guerrier", "Air", "dmg"],
      ["Puissance du Iop", "Neutre", "buff"],
      ["Épée tournoyante", "Terre", "aoe"],
      ["Lame ardente", "Feu", "dmg"],
      ["Garde du guerrier", "Neutre", "shield"],
      ["Tempête du Iop", "Feu", "aoe"],
      ["Colère du Iop", "Terre", "dmg"],
    ],
  ],
  [
    "cra",
    "Crâ",
    "Tirs précis et cibles marquées",
    "Précision : +10 % aux dégâts directs sur une seule cible.",
    "precision",
    [
      ["Flèche vive", "Air", "dmg"],
      ["Flèche brûlante", "Feu", "dmg"],
      ["Visée précise", "Neutre", "focus"],
      ["Flèche révélatrice", "Air", "mark"],
      ["Pluie de flèches", "Eau", "aoe"],
      ["Flèche absorbante", "Air", "drain"],
      ["Flèche explosive", "Feu", "aoe"],
      ["Flèche punitive", "Terre", "dmg"],
    ],
  ],
  [
    "eniripsa",
    "Eniripsa",
    "Soins et régénération",
    "Bienveillance : +20 % aux soins personnels.",
    "healer",
    [
      ["Mot blessant", "Feu", "dmg"],
      ["Mot de soin", "Soin", "heal"],
      ["Mot régénérant", "Soin", "regen"],
      ["Mot éclatant", "Feu", "aoe"],
      ["Mot protecteur", "Neutre", "shield"],
      ["Mot vampirique", "Eau", "drain"],
      ["Mot revitalisant", "Soin", "heal"],
      ["Mot de triomphe", "Feu", "aoe"],
    ],
  ],
  [
    "sadida",
    "Sadida",
    "Poisons, ronces et poupées",
    "Sève : les poisons infligent 20 % de dégâts supplémentaires.",
    "poison",
    [
      ["Ronce", "Terre", "dmg"],
      ["Poison de feuilles", "Feu", "poison"],
      ["Sève réparatrice", "Soin", "regen"],
      ["Ronces multiples", "Terre", "aoe"],
      ["Poupée piquante", "Air", "summon"],
      ["Ronce entravante", "Terre", "weaken"],
      ["Broussaille venimeuse", "Eau", "poison"],
      ["Forêt vengeresse", "Terre", "aoe"],
    ],
  ],
  [
    "feca",
    "Féca",
    "Boucliers et protection",
    "Armure : réduit de 15 % les dégâts des attaques ennemies.",
    "armor",
    [
      ["Étincelle du Féca", "Feu", "dmg"],
      ["Armure de pierre", "Neutre", "shield"],
      ["Bulle tranchante", "Eau", "dmg"],
      ["Glyphe de braise", "Feu", "aoe"],
      ["Rempart du Féca", "Neutre", "shield"],
      ["Aveuglement mystique", "Terre", "weaken"],
      ["Glyphe dévorant", "Eau", "aoe"],
      ["Bastion éternel", "Neutre", "shield"],
    ],
  ],
  [
    "osamodas",
    "Osamodas",
    "Créatures et soutien",
    "Dresseur : peut maintenir deux invocations à la fois.",
    "summoner",
    [
      ["Griffe spectrale", "Feu", "dmg"],
      ["Tofu de combat", "Air", "summon"],
      ["Cri du dresseur", "Neutre", "buff"],
      ["Bouftou de combat", "Terre", "summon"],
      ["Souffle du dragon", "Feu", "aoe"],
      ["Dragonnet guérisseur", "Soin", "summon"],
      ["Griffe vorace", "Eau", "drain"],
      ["Dragon ancestral", "Feu", "summon"],
    ],
  ],
  [
    "enutrof",
    "Enutrof",
    "Affaiblissement et attaques élémentaires",
    "Érosion : les attaques sur une cible affaiblie infligent 10 % de dégâts supplémentaires.",
    "erosion",
    [
      ["Pièce mordante", "Eau", "dmg"],
      ["Pelle vive", "Terre", "dmg"],
      ["Pelle affaiblissante", "Eau", "weaken"],
      ["Remblai du prospecteur", "Terre", "aoe"],
      ["Sac protecteur", "Neutre", "shield"],
      ["Pelle absorbante", "Eau", "drain"],
      ["Pelle du jugement", "Eau", "mark"],
      ["Trésor explosif", "Terre", "aoe"],
    ],
  ],
  [
    "sram",
    "Sram",
    "Poisons et attaques surprises",
    "Embuscade : +15 % aux dégâts directs quand un bouclier est actif.",
    "ambush",
    [
      ["Coup sournois", "Terre", "dmg"],
      ["Poison insidieux", "Air", "poison"],
      ["Voile de brume", "Neutre", "shield"],
      ["Piège de cendres", "Feu", "aoe"],
      ["Dague vampirique", "Eau", "drain"],
      ["Poison du silence", "Air", "weaken"],
      ["Piège mortel", "Terre", "dmg"],
      ["Brume empoisonnée", "Air", "poison"],
    ],
  ],
  [
    "xelor",
    "Xélor",
    "PA et contrôle du rythme",
    "Horloger : les sorts de récupération de PA rendent un PA supplémentaire.",
    "time",
    [
      ["Aiguille du temps", "Feu", "dmg"],
      ["Sablier électrique", "Air", "dmg"],
      ["Dévouement temporel", "Neutre", "ap"],
      ["Ralentissement", "Eau", "weaken"],
      ["Poussière temporelle", "Feu", "aoe"],
      ["Bouclier du cadran", "Neutre", "shield"],
      ["Horloge vorace", "Eau", "drain"],
      ["Fracture du temps", "Terre", "aoe"],
    ],
  ],
  [
    "ecaflip",
    "Ecaflip",
    "Chance, soins et coups critiques",
    "Chance : chaque attaque a 10 % de chances de faire 50 % de dégâts supplémentaires.",
    "luck",
    [
      ["Griffe joueuse", "Terre", "dmg"],
      ["Léchouille chanceuse", "Soin", "heal"],
      ["Roue de la fortune", "Neutre", "buff"],
      ["Cartes flamboyantes", "Feu", "aoe"],
      ["Trèfle protecteur", "Neutre", "shield"],
      ["Griffe absorbante", "Eau", "drain"],
      ["Pari gagnant", "Air", "dmg"],
      ["Destin de l’Ecaflip", "Terre", "aoe"],
    ],
  ],
  [
    "sacrieur",
    "Sacrieur",
    "Vol de vie et riposte",
    "Furie : +20 % aux dégâts quand les PV sont sous 50 %.",
    "fury",
    [
      ["Pied sanguin", "Terre", "drain"],
      ["Assaut sanglant", "Air", "dmg"],
      ["Transfusion", "Soin", "heal"],
      ["Dissolution", "Eau", "drain"],
      ["Châtiment du sang", "Neutre", "buff"],
      ["Sang brûlant", "Feu", "aoe"],
      ["Égide sanguine", "Neutre", "shield"],
      ["Punition", "Neutre", "dmg"],
    ],
  ],
  [
    "pandawa",
    "Pandawa",
    "Vulnérabilité et attaques de groupe",
    "Ivresse : +10 % aux dégâts contre les cibles marquées.",
    "brew",
    [
      ["Poing enflammé", "Feu", "dmg"],
      ["Jet de bambou", "Eau", "dmg"],
      ["Vulnérabilité", "Neutre", "mark"],
      ["Vague de bambou", "Eau", "aoe"],
      ["Bambou protecteur", "Neutre", "shield"],
      ["Lait de bambou", "Soin", "heal"],
      ["Pandattaque", "Terre", "dmg"],
      ["Festin du Pandawa", "Eau", "aoe"],
    ],
  ],
  [
    "roublard",
    "Roublard",
    "Bombes et explosions différées",
    "Artificier : peut poser trois bombes ; elles explosent après deux tours.",
    "bombs",
    [
      ["Tir roublard", "Feu", "dmg"],
      ["Bombe ardente", "Feu", "bomb"],
      ["Détonateur", "Neutre", "detonate"],
      ["Bombe électrique", "Air", "bomb"],
      ["Poudre protectrice", "Neutre", "shield"],
      ["Tir perforant", "Terre", "mark"],
      ["Bombe aquatique", "Eau", "bomb"],
      ["Salve du roublard", "Air", "aoe"],
    ],
  ],
  [
    "zobal",
    "Zobal",
    "Masques offensifs et boucliers",
    "Masque : les boucliers gagnent 20 % de points supplémentaires.",
    "masks",
    [
      ["Frappe masquée", "Terre", "dmg"],
      ["Plastron léger", "Neutre", "shield"],
      ["Masque furieux", "Neutre", "buff"],
      ["Cabriole", "Air", "aoe"],
      ["Appui du masque", "Eau", "drain"],
      ["Tortoruga", "Neutre", "shield"],
      ["Transe protectrice", "Neutre", "shield"],
      ["Furie du Zobal", "Terre", "aoe"],
    ],
  ],
  [
    "steamer",
    "Steamer",
    "Tourelles et réparations",
    "Ingénieur : une tourelle à la fois, avec 25 % de dégâts ou soins supplémentaires.",
    "engineer",
    [
      ["Ancrage", "Terre", "dmg"],
      ["Harponneuse", "Terre", "summon"],
      ["Gardienne", "Soin", "summon"],
      ["Écume", "Eau", "aoe"],
      ["Blindage", "Neutre", "shield"],
      ["Réparation", "Soin", "heal"],
      ["Surcharge", "Neutre", "buff"],
      ["Torpille", "Eau", "dmg"],
    ],
  ],
  [
    "eliotrope",
    "Eliotrope",
    "Portails et attaques renforcées",
    "Portail : les sorts de concentration renforcent la prochaine attaque de 15 % supplémentaires.",
    "portal",
    [
      ["Rayon wakfu", "Air", "dmg"],
      ["Onde wakfu", "Eau", "dmg"],
      ["Portail amplificateur", "Neutre", "focus"],
      ["Distribution wakfu", "Soin", "heal"],
      ["Rayon multiple", "Feu", "aoe"],
      ["Égide wakfu", "Neutre", "shield"],
      ["Portail stabilisé", "Neutre", "focus"],
      ["Déferlement wakfu", "Air", "aoe"],
    ],
  ],
  [
    "huppermage",
    "Huppermage",
    "Combinaisons de quatre éléments",
    "Combinaison : changer d’élément augmente les dégâts de 15 %.",
    "combo",
    [
      ["Rune de feu", "Feu", "dmg"],
      ["Rune d’eau", "Eau", "dmg"],
      ["Rune de terre", "Terre", "dmg"],
      ["Rune d’air", "Air", "dmg"],
      ["Armure runique", "Neutre", "shield"],
      ["Onde élémentaire", "Feu", "aoe"],
      ["Runification", "Neutre", "buff"],
      ["Convergence élémentaire", "Eau", "aoe"],
    ],
  ],
  [
    "ouginak",
    "Ouginak",
    "Rage et chasse à la proie",
    "Rage : chaque attaque ajoute 5 % de dégâts, jusqu’à 15 %.",
    "rage",
    [
      ["Morsure", "Terre", "dmg"],
      ["Croc vif", "Air", "dmg"],
      ["Proie", "Neutre", "mark"],
      ["Léchage", "Soin", "heal"],
      ["Pelage protecteur", "Neutre", "shield"],
      ["Croc vorace", "Eau", "drain"],
      ["Rugissement", "Neutre", "buff"],
      ["Traque sauvage", "Terre", "drain"],
    ],
  ],
  [
    "forgelance",
    "Forgelance",
    "Lances et dégâts de groupe",
    "Percée : +10 % aux dégâts sur tous les ennemis.",
    "lancer",
    [
      ["Pointe vive", "Air", "dmg"],
      ["Lance fluide", "Eau", "dmg"],
      ["Garde de la lance", "Neutre", "shield"],
      ["Lance incendiaire", "Feu", "aoe"],
      ["Pointe vulnérante", "Terre", "mark"],
      ["Lance réparatrice", "Soin", "heal"],
      ["Déluge de lances", "Eau", "aoe"],
      ["Lance légendaire", "Air", "aoe"],
    ],
  ],
];
const CLASSES = CLASS_CATALOG.map(
  ([id, name, style, passive, trait, rows]) => ({
    id,
    name,
    style,
    passive,
    trait,
    spells: rows.map(([n, e, kind], i) => {
      const level = CLASS_UNLOCKS[i];
      const power = [6, 6, 9, 12, 15, 18, 23, 30][i];
      let pa = i < 2 ? 3 : i < 5 ? 4 : i < 7 ? 5 : 6,
        lo = power,
        hi = power + 2 + i,
        cd = i < 2 ? 0 : 2,
        turns = 2;
      if (kind === "heal" || kind === "regen") {
        lo = power + 4;
        hi = power + 8;
        pa = 3;
        cd = kind === "regen" ? 3 : 1;
        turns = 3;
      }
      if (kind === "shield") {
        lo = power + 3;
        hi = power + 7;
        pa = 3;
        cd = 3;
      }
      if (kind === "poison") {
        lo = Math.max(3, Math.round(power * 0.45));
        hi = lo + 2;
        pa = 3;
        cd = 2;
      }
      if (kind === "summon") {
        lo = Math.max(2, Math.round(power * 0.45));
        hi = lo + 1;
        pa = 3;
        cd = 3;
        turns = 3;
      }
      if (kind === "aoe") {
        lo = Math.round(power * 0.7);
        hi = lo + 3;
      }
      if (
        kind === "buff" ||
        kind === "mark" ||
        kind === "weaken" ||
        kind === "focus"
      ) {
        lo = kind === "focus" ? 30 : 15;
        hi = lo;
        pa = 2;
        cd = 3;
      }
      if (kind === "ap") {
        lo = 1;
        hi = 1;
        pa = 2;
        cd = 3;
      }
      if (kind === "bomb") {
        lo = Math.max(4, Math.round(power * 0.7));
        hi = lo + 2;
        pa = 3;
        cd = 1;
      }
      if (kind === "detonate") {
        lo = hi = 0;
        pa = 2;
        cd = 1;
      }
      // Keep all level-one direct hits below the original Tofu's 17 HP.
      if (i < 2 && ["dmg", "drain"].includes(kind)) {
        lo = 6;
        hi = 8;
      }
      return { id: id + ":" + i, n, e, pa, lo, hi, kind, level, cd, turns };
    }),
  }),
);
function playerClass() {
  return CLASSES.find((c) => c.id === D.classId);
}
function spellBook() {
  return (
    playerClass()?.spells ||
    BASE.map((b, i) => ({
      id: "legacy:" + i,
      n: b[0],
      e: b[1],
      pa: b[2],
      lo: b[3],
      hi: b[4],
      kind: b[5],
      level: 1,
      cd: 0,
      turns: 2,
    }))
  );
}
function spellRank(i) {
  return playerClass()
    ? D.spellRanks?.[spellBook()[i]?.id] || 1
    : D.spellLv[i] || 1;
}
function spellUnlocked(i) {
  return !!playerClass() && !!spellBook()[i] && D.lv >= spellBook()[i].level;
}
function migrateClassSave(state) {
  if (!state.classMigration) {
    state.legacySpellLv = [...(state.spellLv || [])];
    state.spellPts =
      (state.spellPts || 0) +
      state.legacySpellLv.reduce(
        (n, r) => n + Math.max(0, (Number(r) || 1) - 1),
        0,
      );
    state.classMigration = 1;
  }
  state.spellRanks = state.spellRanks || {};
  if (!CLASSES.some((c) => c.id === state.classId)) state.classId = null;
}
