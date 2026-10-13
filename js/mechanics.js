// Tabelas de mecânicas do jogo (fonte: wiki oficial — páginas Elder, Traits, Plushies e Creature Abilities).
// Valores marcados com "≈" não são documentados na wiki e foram estimados.
// Textos: chaves de tradução em js/lang/*.js (função t()).

// Efeito exibido em um "chip": good = bom/ruim/neutro, nc = não afeta o face tank
const fxp = (text, good, nc) => ({ t: text, good, nc });

// ---------- Ancião e veneração ----------
const ELDER = {
  none:     { pt: t("elder.none"), d: t("elder.none.d"), parts: [] },
  gentle:   { pt: t("elder.gentle"), d: t("elder.gentle.d"), regen: 1.15, block: 0.10,
              parts: [fxp(fx(0.15, "regen"), true), fxp(fx(0.10, "blockStatus"), true), fxp(fx(0.10, "stamina"), true, true)] },
  powerful: { pt: t("elder.powerful"), d: t("elder.powerful.d"), weight: 1.2, dmg: 1.15, regen: 0.8, cd: 1.05,
              parts: [fxp(fx(0.2, "weight"), true), fxp(fx(0.15, "dmg"), true), fxp(fx(-0.2, "regen"), false), fxp(fx(0.05, "cd"), false),
                      fxp(fx(-0.2, "stamina"), false, true), fxp(fx(-0.05, "speed"), false, true)] },
  devious:  { pt: t("elder.devious"), d: t("elder.devious.d"), weight: 0.8, dmg: 0.85, cd: 0.925,
              parts: [fxp(fx(-0.075, "cd"), true), fxp(fx(-0.2, "weight"), false), fxp(fx(-0.15, "dmg"), false),
                      fxp(fx(0.075, "speed"), true, true), fxp(fx(0.25, "stamregen"), true, true)] },
};
const VEN_STAGES = [t("ven.none"), "Elder", "Sage", "Master", "Venerated", "Ancient"];
// No estágio V: +200 vida e +80 peso por tier (≈ distribuído igualmente pelos 5 estágios)
const venBonus = (tier, stage) => ({ hp: 40 * tier * stage, weight: 16 * tier * stage });

// ---------- Traits (base + por ascensão) ----------
const TRAITS = {
  "":       { pt: t("trait.none") },
  bite:     { pt: t("trait.bite"),      unit: "cd",        sign: -1, base: 0.10,  asc: 0.01,  combat: true },
  damage:   { pt: t("trait.damage"),    unit: "dmg",       base: 0.05,  asc: 0.02,  combat: true },
  health:   { pt: t("trait.health"),    unit: "regenhp",   base: 0.125, asc: 0.04,  combat: true },
  weight:   { pt: t("trait.weight"),    unit: "weight",    base: 0.05,  asc: 0.02,  combat: true },
  speed:    { pt: t("trait.speed"),     unit: "speed",     base: 0.035, asc: 0.015 },
  stamina:  { pt: t("trait.stamina"),   unit: "stammax",   base: 0.15,  asc: 0.025 },
  stamregen:{ pt: t("trait.stamregen"), unit: "stamregen", base: 0.20,  asc: 0.035 },
  healing:  { pt: t("trait.healing"),   unit: "healing",   base: 0.05,  asc: 0.02 },
};
const traitValue = (type, level) => TRAITS[type]?.base ? TRAITS[type].base + TRAITS[type].asc * level : 0;

// ---------- Pelúcias com efeito em combate ----------
// mult: multiplicadores de atributo; add: soma em passivas (ataques/defensivos/bloqueios); flags extras.
// stack:false = não pode equipar duas iguais. nc = efeitos fora do duelo (chaves de tradução).
const PLUSHIES = {
  "": {},
  "Magichorn Prongbug": { mult: { regen: 1.10 } },
  "Heart":          { mult: { regen: 1.30, weight: 0.95 } },
  "Rod":            { nc: ["nc.doubleJump"], mult: { regen: 1.10 }, stack: false },
  "Ice Wolf":       { mult: { dmg: 1.05 } },
  "Void":           { nc: [["movespeed", -0.025]], mult: { dmg: 1.075 } },
  "Mo":             { nc: ["nc.doubleJump"], mult: { dmg: 1.025 }, stack: false },
  "Eclipse":        { nc: ["nc.eclipseStam"], night: { dmg: 1.05, regen: 1.15 } },
  "Coal":           { mult: { weight: 1.035 } },
  "Cow":            { mult: { weight: 1.10, dmg: 0.95 } },
  "Hum":            { nc: ["nc.doubleJump"], mult: { weight: 1.025 }, stack: false },
  "Chick":          { nc: [["movespeed", 0.05]], mult: { weight: 0.925 } },
  "Sky":            { nc: ["nc.flySpeed"], mult: { weight: 0.90 } },
  "Serpent":        { nc: ["nc.turn"], mult: { dmg: 0.90 }, stack: false },
  "Knight":         { mult: { dmg: 0.95 }, knight: true, stack: false },
  "Cat":            { add: { "Bleed Attack": 1 }, mult: { dmg: 0.975 }, stubborn: { mult: { regen: 1.10 }, add: { "Block Bleed": 0.05 } } },
  "Pig-Lantern":    { add: { "Burn Attack": 0.5 }, mult: { dmg: 0.975 }, stubborn: { mult: { dmg: 1.05 }, add: { "Block Burn": 0.05 } } },
  "Haunt Dragon":   { add: { "Poison Attack": 0.5 }, stubborn: { add: { "Block Poison": 0.05 } } },
  "Tannenbaum":     { add: { "Frostbite Attack": 0.5 }, mult: { cd: 1.05 }, stack: false, stubborn: { mult: { cd: 0.95 }, add: { "Block Frostbite": 0.05 } } },
  "Heartsnake":     { add: { "Defensive Poison": 0.75 } },
  "Vampire Bat":    { add: { "Defensive Bleed": 1 }, mult: { dmg: 0.975 } },
  "Jammy Slug":     { add: { "Defensive Necropoison": 0.5 }, mult: { dmg: 0.95 } },
  "Ember Spirit":   { add: { "Defensive Burn": 0.5, "Block Frostbite": -0.075 } },
  "Ginger Snapper": { add: { "Defensive Frostbite": 0.5, "Block Burn": -0.05 }, stack: false },
  "Ghost":          { add: { "Block Bleed": 0.075 } },
  "Frost Dragon":   { nc: [["hunger", -0.05]], add: { "Block Frostbite": 0.25 } },
  "Sparkler":       { add: { "Block Poison": 0.15, "Block Frostbite": 0.15, "Block Burn": 0.15, "Block Bleed": -0.20 }, stack: false },
  "Maple Leaflet":  { nc: ["nc.injuryOnlySlows"], add: { "Block Injury": 0.225 } },
  "Astral Quetzal": { nc: [["movespeed", -0.05]], add: { "Breath Resistance": 0.5, "Block Bleed": 0.5 }, mult: { regen: 0.75 }, stack: false },
  "Pie Chomper":    { add: { "Serrated Teeth": true }, mult: { regen: 0.75 }, stack: false },
  "Minty Wiggler":  { nc: ["nc.frostyStam"], add: { "Frosty": true }, stack: false },
  "Springbok":      { nc: ["nc.willToLive"], stack: false },
  "Arcane":         { nc: ["nc.needsBreath"], breathDmg: 1.125, stack: false },
  "Baby Dragon":    { breathRegen: 1.2, stack: false },
  "Bear":           { bear: true, stack: false },
  "Oceanwing":      { mud: 1.5 },
};

// ---------- Estações (wiki: Environment) ----------
const SEASONS = {
  summer: { pt: t("season.summer") }, fall: { pt: t("season.fall") }, winter: { pt: t("season.winter"), d: t("season.winter.d") },
  spring: { pt: t("season.spring") }, famine: { pt: t("season.famine"), d: t("season.famine.d") }, sakura: { pt: t("season.sakura") },
  drought: { pt: t("season.drought"), d: t("season.drought.d") }, mythic: { pt: t("season.mythic") },
};

// Categorias para o seletor de pelúcias
const PLUSH_CATS = {
  dmg:    { pt: t("pcat.dmg"),    list: ["Ice Wolf", "Void", "Mo", "Eclipse", "Serpent"] },
  weight: { pt: t("pcat.weight"), list: ["Coal", "Cow", "Hum", "Chick", "Sky"] },
  regen:  { pt: t("pcat.regen"),  list: ["Magichorn Prongbug", "Heart", "Rod", "Oceanwing"] },
  atk:    { pt: t("pcat.atk"),    list: ["Cat", "Pig-Lantern", "Haunt Dragon", "Tannenbaum", "Pie Chomper"] },
  def:    { pt: t("pcat.def"),    list: ["Heartsnake", "Vampire Bat", "Jammy Slug", "Ember Spirit", "Ginger Snapper", "Knight"] },
  block:  { pt: t("pcat.block"),  list: ["Ghost", "Frost Dragon", "Sparkler", "Maple Leaflet", "Astral Quetzal"] },
  breath: { pt: t("pcat.breath"), list: ["Arcane", "Baby Dragon"] },
  other:  { pt: t("pcat.other"),  list: ["Bear", "Minty Wiggler", "Springbok"] },
};
const plushCat = name => Object.keys(PLUSH_CATS).find(k => PLUSH_CATS[k].list.includes(name)) || "other";

// ---------- Buffs de status (ligados manualmente) ----------
const BUFFS = {
  aggressive: { pt: t("buff.aggressive"), how: t("buff.aggressive.how"), parts: [fxp(fx(0.25, "dmg"), true), fxp(fx(-0.5, "stamregen"), false, true)] },
  scared:     { pt: t("buff.scared"), how: t("buff.scared.how"), parts: [fxp(fx(-0.5, "dmg"), false), fxp(fx(0.25, "speed"), true, true)] },
  cleanWater: { pt: t("buff.cleanWater"), how: t("buff.cleanWater.how"), parts: [fxp(fx(0.2, "regen"), true), fxp(fx(0.2, "stamregen"), true, true), fxp(fx(-0.2, "hunger"), true, true)] },
  muddy:      { pt: t("buff.muddy"), how: t("buff.muddy.how"), parts: [fxp(fx(0.25, "regen"), true), fxp(t("fx.mudCure"), true), fxp(t("fx.hideScent"), true, true)] },
  packHealer: { pt: t("buff.packHealer"), how: t("buff.packHealer.how"), parts: [fxp(fx(0.25, "regen"), true)] },
  newborn:    { pt: t("buff.newborn"), how: t("buff.newborn.how"), parts: [fxp(fx(0.5, "regen"), true), fxp(fx(-0.25, "hunger"), true, true)] },
  sin:        { pt: "Strength In Numbers", how: t("buff.sin.how"), needs: "Strength In Numbers", stacks: 4,
                parts: [fxp(t("fx.sinStats"), true), fxp(t("fx.sinAil"), true)] },
  defensive:  { pt: t("buff.defensive"), how: t("buff.defensive.how"), needs: "Broodwatcher", stacks: 5, parts: [fxp(t("fx.defStack"), true)] },
};

// ---------- Habilidades ativas simuladas ----------
// def: ligada por padrão
const ACTIVES = {
  "Harden": { def: true }, "Unbridled Rage": { def: true }, "Adrenaline": { def: true }, "Hunters Curse": { def: false },
  "Life Leech": { def: true }, "Spite": { def: true }, "Shadow Barrage": { def: true }, "Warden's Rage": { def: true },
  "Two-Faced": { def: true }, "Reflect": { def: true }, "Fortify": { def: true }, "Cocoon": { def: true },
  "Healing Pulse": { def: true }, "Expunge": { def: true }, "Divination": { def: true }, "Lich Mark": { def: false },
  "Poison Area": { def: true }, "Frost Nova": { def: true }, "Aura": { def: true }, "Totem": { def: true },
  "Cause Fear": { def: true }, "Drowsy Area": { def: true }, "Earthquake": { def: true },
};
const activeName = a => a.replace(/\s*\(.*\)$/, "");
const activeArg = a => (/\((.*)\)$/.exec(a) || [])[1];

// ---------- Cartões das habilidades ativas ----------
// cd = recarga (s); how = quando o simulador usa; parts(arg) = efeitos exibidos
const sec = s => `${s}s`;
const ACTIVE_CARDS = {
  "Harden":         { cd: 120, how: "how.start", parts: () => [fxp(fx(0.65, "weight") + " ≈", true), fxp(fx(0.25, "regen"), true), fxp(sec(30), null), fxp(fx(-0.2, "speed"), false, true)] },
  "Unbridled Rage": { cd: 120, how: "how.start", parts: () => [fxp(fx(0.3, "dmg"), true), fxp(sec(30), null), fxp(t("fx.halfStamina"), false, true)] },
  "Adrenaline":     { cd: 90,  how: "how.start", parts: () => [fxp(fx(0.2, "dmg"), true), fxp(sec(30), null), fxp(fx(0.2, "speed"), true, true)] },
  "Hunters Curse":  { cd: 120, how: "how.curse", parts: () => [fxp(fx(1, "dmg"), true), fxp(sec(30), null), fxp(t("fx.loseHalfHp"), false)] },
  "Life Leech":     { cd: 60,  how: "how.hurt",  parts: a => [fxp(t("fx.leech", { n: P(+a, false) }), true), fxp(sec(12), null)] },
  "Spite":          { cd: 20,  how: "how.spite", parts: a => [fxp(t("fx.spite", { n: P(+a) }), true), fxp(t("fx.doubleStatus"), true)] },
  "Shadow Barrage": { cd: 30,  how: "how.afterBite", parts: a => [fxp(t("fx.barrage", { n: a }), true), fxp(t("fx.barrageDrop"), null), fxp(t("fx.appliesStatus"), true)] },
  "Warden's Rage":  { cd: 30,  how: "how.always", parts: () => [fxp(t("fx.warden"), true), fxp(t("fx.noRegen"), false)] },
  "Two-Faced":      { cd: 15,  how: "how.form", parts: () => [fxp(t("fx.tranq"), null), fxp(t("fx.madness"), null)] },
  "Reflect":        { cd: 45,  how: "how.asap", parts: () => [fxp(t("fx.reflect"), true), fxp("≈3s", null)] },
  "Fortify":        { cd: 90,  how: "how.fortify", parts: () => [fxp(t("fx.cleanse"), true), fxp(t("fx.immune9"), true), fxp(fx(0.05, "weight"), true)] },
  "Cocoon":         { cd: 120, how: "how.cocoon", parts: () => [fxp(t("fx.invuln"), true), fxp(t("fx.heal30"), true), fxp(t("fx.cocoonRage"), true), fxp(t("fx.noBiteCocoon"), false)] },
  "Healing Pulse":  { cd: 90,  how: "how.pulse", parts: () => [fxp(t("fx.pulse"), true), fxp(sec(30), null), fxp(t("fx.healBleeding"), true)] },
  "Expunge":        { cd: 45,  how: "how.expunge", parts: () => [fxp(t("fx.expunge1"), null), fxp(t("fx.expunge2"), true), fxp(t("fx.expunge3"), true)] },
  "Divination":     { cd: 60,  how: "how.channel", parts: () => [fxp(t("fx.channel15"), null), fxp(t("fx.charges"), true), fxp(t("fx.cdEstimated"), null)] },
  "Lich Mark":      { cd: 30,  how: "how.lich", parts: a => [fxp(t("fx.stacksOf", { n: 5, s: a }), true)] },
  "Poison Area":    { cd: 15,  how: "how.always2", parts: () => [fxp(t("fx.poisonArea"), true)] },
  "Frost Nova":     { cd: 60,  how: "how.always2", parts: () => [fxp(t("fx.frostNova"), true), fxp(sec(15), null)] },
  "Aura":           { cd: 0,   how: "how.always", parts: a => [fxp(t("fx.every3", { n: 3, s: a }), true)] },
  "Totem":          { cd: 120, how: "how.place", parts: a => [fxp(t("fx.every3", { n: 2, s: a }), true), fxp("2 min", null)] },
  "Cause Fear":     { cd: 120, how: "how.start", parts: () => [fxp(t("fx.fear"), true), fxp("≈15s", null)] },
  "Earthquake":     { cd: 150, how: "how.start", parts: () => [fxp(t("fx.aftershockSelf"), false), fxp(sec(12), null), fxp(t("fx.injury40"), true, true), fxp(t("fx.stamina25"), false, true)] },
  "Drowsy Area":    { cd: 60,  how: "how.always2", parts: () => [fxp(t("fx.drowsy1"), true), fxp(t("fx.drowsy2"), true), fxp(t("fx.drowsy3"), true)] },
};
// Ativas que não mudam um face tank (as duas criaturas paradas mordendo) — texto em "nca.<nome>"
const NONCOMBAT_ACTIVES = ["Grab", "Latch", "Burrower", "Invisibility", "Vanish", "Egg Stealer", "Dazzling Flash", "Mud Pile",
  "Speed Blitz", "Thorn Trap", "Heal Aura", "Yolk Bomb", "Cursed Sigil", "Escape Area", "Area Food Restore", "Area Water Restore",
  "Shock Area", "Change Weather", "Gale", "Stamina Puddle", "Speed Steal", "Sticky Trap", "Frost Snare", "Tail Drop", "Toxic Trap",
  "Area Wind Blast", "Ink Cloud", "Snow Shield"];
const noncombatText = name => NONCOMBAT_ACTIVES.includes(name) ? t("nca." + name) : t("nca.generic");
