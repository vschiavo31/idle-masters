/* Transient encounter effects: never restored from a save or reused by another fight. */
let effects;
function resetEffects() {
  effects = {
    shield: 0,
    shieldTurns: 0,
    buff: 0,
    buffTurns: 0,
    focus: 0,
    focusTurns: 0,
    regen: 0,
    regenTurns: 0,
    summons: [],
    bombs: [],
    poisons: {},
    marks: {},
    weakens: {},
    cooldowns: {},
    casts: {},
    lastElement: null,
    rage: 0,
    weaponCasts: 0,
  };
}
resetEffects();
function canCast(i) {
  if (
    !Number.isInteger(i) ||
    !spellUnlocked(i) ||
    !D.tr ||
    D.end ||
    mode !== "fight"
  )
    return false;
  const s = spellBook()[i],
    p = spell(i);
  if (
    PA < p[2] ||
    D.rd < (effects.cooldowns[i] || 0) ||
    (effects.casts[i] || 0) >= (["dmg", "drain"].includes(s.kind) ? 3 : 2)
  )
    return false;
  if (
    s.kind === "summon" &&
    effects.summons.length >= (playerClass().trait === "summoner" ? 2 : 1)
  )
    return false;
  if (s.kind === "bomb" && effects.bombs.length >= 3) return false;
  if (s.kind === "detonate" && !effects.bombs.length) return false;
  return true;
}
function spellEffectText(s, p, trait = playerClass()?.trait) {
  const amount = p[3] + "–" + p[4];
  switch (s.kind) {
    case "poison":
      return amount + " dégâts/tour · " + s.turns + " tours";
    case "summon":
      return (
        amount +
        (s.e === "Soin" ? " PV" : " dégâts") +
        "/tour · " +
        s.turns +
        " tours"
      );
    case "regen":
      return amount + " PV/tour · " + s.turns + " tours";
    case "shield":
      return amount + " bouclier · " + s.turns + " tours";
    case "buff":
      return "+" + amount + " % dégâts · " + s.turns + " tours";
    case "focus":
      return (
        "+" + amount + " % sur la prochaine attaque · " + s.turns + " tours"
      );
    case "mark":
      return (
        "+" + amount + " % dégâts reçus par la cible · " + s.turns + " tours"
      );
    case "weaken":
      return "−" + amount + " % dégâts de la cible · " + s.turns + " tours";
    case "ap":
      return "+" + (p[3] + (trait === "time" ? 1 : 0)) + " PA";
    case "bomb":
      return amount + " dégâts de groupe · explosion dans 2 tours";
    case "detonate":
      return (
        "Explosion immédiate de toutes les bombes" +
        (p[3] ? " · +" + p[3] * 5 + " % dégâts" : "")
      );
    case "heal":
      return amount + " PV";
    case "drain":
      return amount + " dégâts · récupère 50 % des dégâts en PV";
    case "aoe":
      return amount + " dégâts sur tous les ennemis";
    default:
      return amount + " dégâts sur la cible";
  }
}
function healValue(p) {
  return Math.max(
    0,
    Math.floor(
      R(p[3], p[4]) *
        (1 + st("Intelligence") / 100) *
        (playerClass()?.trait === "healer" ? 1.2 : 1),
    ) + st("Soins"),
  );
}
function restoreHp(h) {
  const gain = Math.min(Math.max(0, h), mh() - D.hp);
  D.hp += gain;
  return gain;
}
function attackValue(p, kind, options = {}) {
  const trait = playerClass()?.trait;
  let boost = 1 + effects.buff / 100;
  if (["dmg", "drain", "aoe", "weapon"].includes(kind)) boost += effects.focus / 100;
  if (trait === "precision" && ["dmg", "drain"].includes(kind)) boost += 0.1;
  if (trait === "ambush" && effects.shield > 0) boost += 0.15;
  if (trait === "fury" && D.hp < mh() * 0.5) boost += 0.2;
  if (trait === "combo" && effects.lastElement && effects.lastElement !== p[1])
    boost += 0.15;
  if (trait === "rage") boost += effects.rage * 0.05;
  if (trait === "lancer" && kind === "aoe") boost += 0.1;
  if (trait === "poison" && kind === "poison") boost += 0.2;
  if (trait === "engineer" && kind === "summon") boost += 0.25;
  if (trait === "luck" && Math.random() < 0.1) {
    boost *= 1.5;
    lg("Coup chanceux !");
  }
  let damage = Math.max(
    0,
    Math.floor(R(p[3], p[4]) * (1 + bonus(p[1]) / 100) * boost) +
      st("Dommages") + st(p[1]),
  );
  const percent = kind === "weapon" ? st("% Dommages d'armes") : st("% Dommages aux sorts");
  damage = Math.max(0, Math.floor(damage * Math.max(0, 1 + percent / 100)));
  const criticalChance = Math.max(0, Math.min(100, 5 + st("Critique")));
  if (options.critical ?? (Math.random() * 100 < criticalChance)) {
    damage = Math.max(0, Math.floor(damage * 1.5) + (options.criticalDamage === false ? 0 : st("DommagesCritiques")));
    if (!options.quiet) lg("Coup critique !");
  }
  return damage;
}
function livingTargets() {
  return encounter
    ? encounter.members.map((e, i) => (e.hp > 0 ? i : -1)).filter((i) => i >= 0)
    : D.eh > 0
      ? [0]
      : [];
}
function hurtTarget(index, amount, applyMark = true) {
  const enemy = encounter?.members[index];
  const before = enemy ? enemy.hp : D.eh;
  if (before <= 0) return 0;
  let boost = applyMark ? (effects.marks[index]?.value || 0) / 100 : 0;
  if (applyMark && playerClass()?.trait === "brew" && effects.marks[index])
    boost += 0.1;
  if (applyMark && playerClass()?.trait === "erosion" && effects.weakens[index])
    boost += 0.1;
  const hp = Math.max(0, before - Math.floor(amount * (1 + boost)));
  if (enemy) enemy.hp = hp;
  if (index === targetIndex) D.eh = hp;
  if (hp === 0)
    lg((enemy ? M.find((m) => m.id === enemy.id) : mob()).n + " est vaincu.");
  return before - hp;
}
function settleTargets() {
  if (!livingTargets().length) {
    victory();
    return true;
  }
  if (encounter?.members[targetIndex]?.hp <= 0)
    selectTarget(livingTargets()[0], true);
  return false;
}
function explodeBombs(boost = 1) {
  for (const bomb of effects.bombs)
    for (const index of livingTargets())
      hurtTarget(index, Math.floor(bomb.damage * boost));
  if (effects.bombs.length) lg("Explosion des bombes !");
  effects.bombs = [];
}
function castClassSpell(i) {
  if (!canCast(i)) return;
  const s = spellBook()[i],
    p = spell(i),
    kind = s.kind;
  PA -= p[2];
  effects.casts[i] = (effects.casts[i] || 0) + 1;
  if (s.cd) effects.cooldowns[i] = D.rd + s.cd;
  switch (kind) {
    case "heal":
      lg(s.n + " : +" + restoreHp(healValue(p)) + " PV");
      break;
    case "regen":
      effects.regen = healValue(p);
      effects.regenTurns = s.turns;
      lg(s.n + " : régénération activée.");
      break;
    case "shield":
      effects.shield = Math.min(
        mh(),
        R(p[3], p[4]) * (playerClass().trait === "masks" ? 1.2 : 1),
      );
      effects.shield = Math.floor(effects.shield);
      effects.shieldTurns = s.turns;
      lg(s.n + " : " + effects.shield + " bouclier.");
      break;
    case "buff":
      effects.buff = Math.min(80, R(p[3], p[4]));
      effects.buffTurns = s.turns;
      lg(s.n + " : puissance renforcée.");
      break;
    case "focus":
      effects.focus = Math.min(
        100,
        R(p[3], p[4]) + (playerClass().trait === "portal" ? 15 : 0),
      );
      effects.focusTurns = s.turns;
      lg(s.n + " : prochaine attaque renforcée.");
      break;
    case "ap":
      PA = Math.min(
        maxpa(),
        PA + p[3] + (playerClass().trait === "time" ? 1 : 0),
      );
      lg(s.n + " : PA récupérés.");
      break;
    case "mark":
      effects.marks[targetIndex] = {
        value: Math.min(60, R(p[3], p[4])),
        turns: s.turns,
      };
      lg(s.n + " : cible vulnérable.");
      break;
    case "weaken":
      effects.weakens[targetIndex] = {
        value: Math.min(60, R(p[3], p[4])),
        turns: s.turns,
      };
      lg(s.n + " : cible affaiblie.");
      break;
    case "poison":
      effects.poisons[targetIndex] = {
        damage: attackValue(p, kind),
        turns: s.turns,
      };
      lg(s.n + " : poison appliqué.");
      break;
    case "summon":
      effects.summons.push({
        name: s.n,
        damage:
          s.e === "Soin"
            ? Math.floor(
                healValue(p) * (playerClass().trait === "engineer" ? 1.25 : 1),
              )
            : attackValue(p, kind),
        heal: s.e === "Soin",
        turns: s.turns,
      });
      lg(s.n + " rejoint le combat.");
      break;
    case "bomb":
      effects.bombs.push({ damage: attackValue(p, kind), turns: 2 });
      lg(s.n + " : bombe posée.");
      break;
    case "detonate":
      explodeBombs(1 + p[3] / 20);
      break;
    default: {
      const amount = attackValue(p, kind);
      const extra = kind !== "aoe" ? livingTargets().filter(index => index !== targetIndex)
        .sort((a, b) => Math.abs(a - targetIndex) - Math.abs(b - targetIndex) || b - a)[0] : undefined;
      let total = 0;
      for (const index of kind === "aoe" ? livingTargets() : [targetIndex])
        total += hurtTarget(index, amount);
      if (extra !== undefined && Math.random() * 100 < Math.max(0, Math.min(100, st("Portee")))) {
        total += hurtTarget(extra, amount);
        lg("Portée : l’attaque touche également " + M.find(m => m.id === encounter.members[extra].id).n + ".");
      }
      lg(
        s.n +
          " : " +
          amount +
          " dégâts" +
          (kind === "aoe" ? " par cible" : "") +
          ".",
      );
      if (kind === "drain")
        lg("Vol de vie : +" + restoreHp(Math.floor(total * 0.5)) + " PV");
      effects.focus = 0;
      effects.focusTurns = 0;
      effects.lastElement = p[1];
      if (playerClass().trait === "rage")
        effects.rage = Math.min(3, effects.rage + 1);
    }
  }
  if (settleTargets()) return;
  render();
}
function tickFriendlyEffects() {
  for (const [key, poison] of Object.entries(effects.poisons)) {
    if (livingTargets().includes(Number(key))) {
      hurtTarget(Number(key), poison.damage, false);
      lg("Poison : " + poison.damage + " dégâts.");
    }
    if (--poison.turns <= 0) delete effects.poisons[key];
  }
  for (const summon of effects.summons) {
    if (summon.heal)
      lg(summon.name + " : +" + restoreHp(summon.damage) + " PV");
    else if (livingTargets().length) {
      hurtTarget(livingTargets()[0], summon.damage);
      lg(summon.name + " : " + summon.damage + " dégâts.");
    }
    summon.turns--;
  }
  effects.summons = effects.summons.filter((s) => s.turns > 0);
  const exploding = effects.bombs.filter((b) => --b.turns <= 0);
  effects.bombs = effects.bombs.filter((b) => b.turns > 0);
  for (const bomb of exploding)
    for (const index of livingTargets()) hurtTarget(index, bomb.damage);
  if (exploding.length) lg("Les bombes explosent !");
  if (effects.regenTurns > 0) {
    lg("Régénération : +" + restoreHp(effects.regen) + " PV");
    effects.regenTurns--;
  }
  return settleTargets();
}
function endEffectRound() {
  if (effects.shieldTurns > 0 && --effects.shieldTurns === 0)
    effects.shield = 0;
  if (effects.buffTurns > 0 && --effects.buffTurns === 0) effects.buff = 0;
  if (effects.focusTurns > 0 && --effects.focusTurns === 0) effects.focus = 0;
  for (const table of [effects.marks, effects.weakens])
    for (const [key, row] of Object.entries(table))
      if (--row.turns <= 0) delete table[key];
  effects.casts = {};
  effects.weaponCasts = 0;
}
function weaponLines(item) {
  const weapon = item && meta(item.id)?.weapon;
  if (!weapon) return [];
  return weapon.lines.map(line => {
    const perfect = Math.max(line.min, line.max);
    const value = item.rayonnant ? Math.ceil(perfect * 1.5) : null;
    return {...line, min: value ?? line.min, max: value ?? line.max};
  });
}
function weaponLineText(item) {
  const lines = weaponLines(item);
  return lines.map(line => line.min + "–" + line.max + " " +
    (line.kind === "heal" ? "soins" : line.kind === "drain" ? "vol de vie" : "dégâts") + " " +
    (line.element === "Best" ? "du meilleur élément" : line.element)).join(" · ") || "Aucune attaque compatible";
}
function canUseWeapon() {
  const weapon = D.w.Arme && meta(D.w.Arme.id)?.weapon;
  return !!(weapon && weapon.ap > 0 && weapon.lines.length && D.tr && !D.end && mode === "fight" &&
    PA >= weapon.ap && effects.weaponCasts < Math.max(1, weapon.casts || 1));
}
function weaponElement(element) {
  return element === "Best" ? ["Terre", "Feu", "Eau", "Air"].sort((a, b) => bonus(b) - bonus(a))[0] : element;
}
function weaponAutoScore() {
  if (!canUseWeapon()) return 0;
  const weapon = meta(D.w.Arme.id).weapon;
  if (weapon.lines.some(line => line.kind === "heal") && D.hp < mh() * 0.4) return 100;
  return weaponLines(D.w.Arme).filter(line => line.kind !== "heal").reduce((sum, line) =>
    sum + ((line.min + line.max) / 2) * (1 + bonus(weaponElement(line.element)) / 100) + st("Dommages") + st(weaponElement(line.element)), 0) / weapon.ap;
}
function useWeapon() {
  if (!canUseWeapon()) return false;
  const item = D.w.Arme, weapon = meta(item.id).weapon;
  PA -= weapon.ap;
  effects.weaponCasts++;
  const critical = Math.random() * 100 < Math.max(0, Math.min(100, weapon.criticalChance + st("Critique")));
  if (critical) lg("Corps à corps : coup critique !");
  const primary = targetIndex;
  const hasDamage = weapon.lines.some(line => line.kind !== "heal");
  const extra = hasDamage ? livingTargets().filter(index => index !== primary)
    .sort((a, b) => Math.abs(a - primary) - Math.abs(b - primary) || b - a)[0] : undefined;
  const targets = [primary];
  if (extra !== undefined && Math.random() * 100 < Math.max(0, Math.min(100, st("Portee")))) {
    targets.push(extra);
    lg("Portée : le corps à corps touche également un second monstre.");
  }
  let criticalAdded = false;
  for (const line of weaponLines(item)) {
    const element = weaponElement(line.element);
    const extraBase = critical ? weapon.criticalBonus : 0;
    const p = ["Arme", element, weapon.ap, line.min + extraBase, line.max + extraBase];
    if (line.kind === "heal") {
      let amount = healValue(p);
      if (critical) amount = Math.floor(amount * 1.5);
      lg("Corps à corps : +" + restoreHp(amount) + " PV");
      continue;
    }
    let amount = attackValue(p, "weapon", {critical, quiet: true, criticalDamage: false});
    if (critical && !criticalAdded) {
      amount = Math.max(0, amount + st("DommagesCritiques"));
      criticalAdded = true;
    }
    let dealt = 0;
    for (const index of targets) dealt += hurtTarget(index, amount);
    lg("Corps à corps : " + amount + " dégâts " + element + (targets.length > 1 ? " par cible" : "") + ".");
    if (line.kind === "drain") lg("Vol de vie de l’arme : +" + restoreHp(dealt) + " PV");
  }
  effects.focus = 0;
  effects.focusTurns = 0;
  if (settleTargets()) return true;
  render();
  return true;
}
function incomingDamage(m, index) {
  let value = R(m.a[0], m.a[1]);
  const critical = Math.random() * 100 < Math.max(0, Math.min(100, m.criticalChance ?? 5));
  if (critical) {
    value = Math.floor(value * 1.5);
    lg(m.n + " : coup critique !");
  }
  if (m.boss && D.rd % 3 === 0) value = Math.floor(value * 1.5);
  value = Math.floor(
    value *
      (playerClass()?.trait === "armor" ? 0.85 : 1) *
      (1 - (effects.weakens[index]?.value || 0) / 100),
  );
  const resistance = Math.min(100, st("% Résistance " + (m.e || "Neutre")));
  value = Math.max(0, Math.floor(value * (1 - resistance / 100)));
  value = Math.max(0, value - st("Résistance " + (m.e || "Neutre")) - (critical ? st("ResistanceCritiques") : 0));
  const absorbed = Math.min(effects.shield, value);
  effects.shield -= absorbed;
  if (absorbed) lg("Bouclier : " + absorbed + " dégâts absorbés.");
  return value - absorbed;
}
