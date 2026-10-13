// Motor de batalha "Face Tank" — mecânicas da wiki oficial (Combat / Creature Abilities / Elder / Traits / Plushies).
// As duas criaturas ficam paradas mordendo uma à outra.
//
// Mordida:     dano * (1 + min(peso/pesoAlvo, 3)) / 2, arredondado para cima
// Tick:        a cada 3s (1 "stack-segundo") os status perdem 1 stack, causam dano e a vida regenera
// Regen:       healthRegen da wiki é recuperado ao longo de 5 ticks (15s, o "tick de vida")
// Sangramento: 2 de dano por stack/tick e bloqueia a regeneração
// Veneno:      vidaMax * (0.2% + 0.05% * stacks) por tick
// Queimadura:  vidaMax * (0.025% + 0.1% * stacks) por tick; -10% regen por stack
// Sopro:       vidaMax do alvo * 1% * multiplicador * fator de peso, 2 acertos/s

// Parâmetros calibrados contra 24 duelos reais enviados por jogadores (a wiki não documenta esses valores com precisão):
// - Reflect dura 1 stack (≈3s), não 2
// - Chain dos sopros: cada ponto de "Chain" da wiki vale +0,1% por acerto acumulado (Energy Breath: 100 → +10%/acerto)
// - Status defensivos (Defensive Poison etc.) aplicam 2,5× os stacks e não escalam com o peso
// - Veneno causa 1,5× o dano da fórmula da wiki
// - Harden dá +65% de peso (wiki: +35%) — calibrado quase só com o Eldervaine, confirmar com outras criaturas
// - Cause Fear dura 5 stacks (≈15s), não 10
// - Nas lutas aleatórias, o tempo entre mordidas varia ±10%
const TUNE = {
  reflectStacks: 1, reflectAt: 0.1, breathWeight: true, selfBuffPersist: "none", defScale: false, regenMode: "split", decay: 1,
  breathMult: 1, hardenW: 1.65, bleedBlocksRegen: true, poisonK: 1.5, bleedK: 1, defK: 2.5, burnK: 1,
  fearMult: 0.55, fearStacks: 5, regularBreath: true,
  jitter: 0.1, // variação de ±10% no tempo entre mordidas (latência/animação) nas lutas aleatórias
};

const DT = 0.1;
const TICK = 3;
const REGEN_TICKS = 5;
const MAX_TIME = 900;

// mult = multiplicador por acerto (2 acertos/s), cap = segundos de disparo,
// regen = segundos de recarga por unidade de capacidade (≈), delay/cooldown para feixes
const BREATHS = {
  "Acid Breath":      { mult: 0.5,  cap: 10, regen: 1.8,  ail: ["corrosion", 1, 0.5] },
  "Ash Breath":       { mult: 0.1,  cap: 20, regen: 1.5,  ail: ["burn", 0.2, 1] },
  "Crystal Breath":   { mult: 0.5,  cap: 10, regen: 1.8,  ail: ["bleed", 0.75, 0.5] },
  "Energy Breath":    { mult: 0.225,cap: 8,  regen: 5,    chain: [0.1, 10] },
  "Fire Breath":      { mult: 0.5,  cap: 20, regen: 1.5,  ail: ["burn", 0.75, 0.5] },
  "Green Fire Breath":{ mult: 0.5,  cap: 20, regen: 1.5,  ail: ["burn", 0.75, 0.5] },
  "Glacier Breath":   { mult: 1,    cap: 10, regen: 4.5,  chain: [0.005, 10] },
  "Gold Breath":      { mult: 0.25, cap: 20, regen: 0.75 },
  "Haunt Breath":     { mult: 0.75, cap: 10, regen: 2.5,  ail: ["poison", 0.75, 1] },
  "Ice Breath":       { mult: 0.5,  cap: 10, regen: 3.75, ail: ["frostbite", 0.75, 0.5] },
  "Lightning Breath": { mult: 1.5,  cap: 5,  regen: 12,   chain: [0.025, 5] },
  "Miasma Breath":    { mult: 0.25, cap: 10, regen: 2.5,  selfHeal: 0.005 },
  "Plague Breath":    { mult: 0.25, cap: 5,  regen: 2,    ail: ["disease", 1, 1] },
  "Radiation Breath": { mult: 0.5,  cap: 10, regen: 1.8,  ail: ["radiation", 0.5, 0.5] },
  "Rock Breath":      { mult: 1,    cap: 10, regen: 3.5 },
  "Sand Breath":      { mult: 0.25, cap: 10, regen: 1.8 },
  "Storm Breath":     { mult: 0.01, cap: 20, regen: 1.75 },
  "Toxin Breath":     { mult: 0.25, cap: 15, regen: 2.5,  ail: ["poison", 0.75, 0.75] },
  "Virus Breath":     { mult: 0.75, cap: 20, regen: 1.5,  ail: ["bleed", 0.75, 1] },
  "Water Breath":     { mult: 0.75, cap: 10, regen: 2.5 },
  "Solar Beam":       { mult: 1.5,  cap: 10, delay: 3, cooldown: 120 },
  "Heliolyth's Judgement": { mult: 1.6, cap: 10, delay: 3, cooldown: 120, pure: true },
  "Spirit Glare":     { mult: 1,    cap: 10, delay: 0, cooldown: 120, ail: ["burn", 1, 1], fear: true },
  "Silly Beam":       { mult: 0.75, cap: 10, delay: 3, cooldown: 300 },
  "Plasma Beam":      { mult: 2,    cap: 1.5,delay: 0, cooldown: 35 },
  "Heal Breath":      { mult: 0,    cap: 10, regen: 5,    selfHeal: 0.015 },
  "Cloud Breath":     { mult: 0,    cap: 15, regen: 1.3,  selfHeal: 0.005 },
  "Heal Beam":        { mult: 0,    cap: 10, regen: 3.5 },
  "Moon Beam":        { mult: 0,    cap: 0 },
  "Scholars Study":   { mult: 0,    cap: 0 },
};
function lanceOf(name) {
  const m = /^Lance \((\w+)\)$/.exec(name || "");
  if (!m) return null;
  return { lance: true, type: ailKey(m[1]) };
}
const ailKey = wikiName => {
  const n = String(wikiName).toLowerCase();
  if (n === "deep wounds") return "deepwounds";
  return Object.keys(AILMENTS).find(k => AILMENTS[k].key.toLowerCase() === n) || (["drowsy", "fear", "aftershock"].includes(n) ? n : undefined);
};

const statusPt = k => AILMENTS[k]?.pt.toLowerCase() || (["drowsy", "fear", "aftershock", "deepwounds"].includes(k) ? tx("status." + k) : k);

const weightFactor = (attW, defW) => (1 + Math.min(attW / defW, 3)) / 2;

// ---------- Monta os atributos finais de uma criatura (antes da luta) ----------
function buildStats(slot, env) {
  const c = slot.creature, o = slot.opts;
  const passives = { ...c.passives };
  const stubborn = !!passives["Stubborn Stacker"];
  const m = { hp: 1, dmg: 1, weight: 1, cd: 1, regen: 1 };
  const mul = (k, v) => { if (v) m[k] *= v; };
  const addP = (k, v) => { passives[k] = v === true ? true : (+passives[k] || 0) + v; };
  let hp = c.hp, weight = c.weight;

  // Ancião + veneração
  const e = ELDER[o.elder] || {};
  if (o.elder !== "none" && o.ven > 0) { const vb = venBonus(c.tier, o.ven); hp += vb.hp; weight += vb.weight; }
  mul("weight", e.weight); mul("dmg", e.dmg); mul("regen", e.regen); mul("cd", e.cd);

  // Traits
  for (const t of o.traits) {
    const v = traitValue(t.type, t.level);
    if (t.type === "bite") mul("cd", 1 - v);
    if (t.type === "damage") mul("dmg", 1 + v);
    if (t.type === "health") mul("regen", 1 + v);
    if (t.type === "weight") mul("weight", 1 + v);
  }

  // Pelúcias
  const plush = o.plush.filter(Boolean).map(n => ({ n, p: PLUSHIES[n] }));
  const bear = plush.some(x => x.p.bear);
  let mudMult = 1, breathDmg = 1, breathRegen = 1, knight = false;
  for (const { p } of plush) {
    const eff = stubborn && p.stubborn ? p.stubborn : p;
    for (const [k, v] of Object.entries(eff.mult || {})) mul(k, v);
    for (const [k, v] of Object.entries(eff.add || {})) addP(k, v);
    if (p.night && env.night) for (const [k, v] of Object.entries(p.night)) mul(k, v);
    if (p.mud) mudMult *= p.mud;
    if (p.breathDmg) breathDmg *= p.breathDmg;
    if (p.breathRegen) breathRegen *= p.breathRegen;
    if (p.knight) knight = true;
  }

  // Buffs
  const b = o.buffs;
  if (b.aggressive) mul("dmg", 1 + (bear ? 0.25 * 1.1 + 0.10 : 0.25));
  if (b.scared) mul("dmg", 1 + (bear ? -0.5 * 1.1 + 0.10 : -0.5));
  if (b.cleanWater) mul("regen", 1.2);
  if (b.muddy) mul("regen", 1 + 0.25 * mudMult);
  if (b.packHealer) mul("regen", 1.25);
  if (b.newborn) mul("regen", 1.5);
  if (b.sin > 0 && c.passives["Strength In Numbers"]) {
    const n = Math.min(4, b.sin);
    mul("hp", 1 + 0.05 * n); mul("dmg", 1 + 0.05 * n); mul("weight", 1 + 0.05 * n);
    if (+passives["Bleed Attack"] > 0) addP("Bleed Attack", 0.5 * n);
    if (+passives["Poison Attack"] > 0) addP("Poison Attack", 0.25 * n);
  }
  if (b.defensive > 0 && c.passives["Broodwatcher"]) mul("weight", 1 + 0.1 * Math.min(5, b.defensive));

  // Bônus manual
  mul("dmg", 1 + (o.dmgPct || 0) / 100); mul("hp", 1 + (o.hpPct || 0) / 100);
  mul("weight", 1 + (o.wPct || 0) / 100); mul("regen", 1 + (o.rgPct || 0) / 100); mul("cd", 1 + (o.cdPct || 0) / 100);

  // Hunker (de lado/strafe): recebe só (100 − X)% do dano direto e causa −50% de dano
  const hunker = passives["Hunker"] && o.hunker !== false ? +passives["Hunker"] / 100 : 0;
  if (hunker) mul("dmg", 0.5);

  // Ambiente
  const photo = c.diet === "Photovore" || c.diet === "Photocarnivore";
  if (env.bloodMoon) { mul("dmg", 1.5); mul("cd", 1 / 1.5); }
  if (env.blueMoon) { mul("dmg", 0.5); mul("regen", 1.5); }
  if (photo) { mul("dmg", env.night ? 0.95 : 1.05); mul("regen", env.night ? 0.85 : 1.15); }
  // Estação: Frosty (+25% regen no Inverno/Fome), Volcanic (+50% regen na Fome/Seca)
  const season = env.season || "summer";
  if (passives["Frosty"] && (season === "winter" || season === "famine")) mul("regen", 1.25);
  if (passives["Volcanic"] && (season === "famine" || season === "drought")) mul("regen", 1.5);

  const block = {};
  for (const [k, a] of Object.entries(AILMENTS)) block[k] = Math.min(1, (+passives[`Block ${a.key}`] || 0) + (e.block || 0));
  // Inverno: frostbite da estação deixa a mordida 8% mais lenta (≈ reduzido pelo bloqueio de congelamento)
  if (season === "winter") mul("cd", 1 + 0.08 * (1 - Math.max(0, block.frostbite)));
  const fromP = suffixFn => Object.entries(AILMENTS).map(([type, a]) => ({ type, stacks: +passives[suffixFn(a.key)] || 0 })).filter(x => x.stacks !== 0); // negativos curam o status

  return {
    hunker,
    hp: hp * m.hp, weight: weight * m.weight, dmg: c.dmg * m.dmg, cd: c.cd * m.cd, regen: c.regen * m.regen,
    passives, block,
    atk: fromP(k => `${k} Attack`), def: fromP(k => `Defensive ${k}`),
    breathDmg, breathRegen, knight: knight && !hunker,
  };
}

function buildFighter(slot, env) {
  const c = slot.creature, o = slot.opts, S = buildStats(slot, env), P = S.passives;
  const breath = !o.breath ? null : (lanceOf(c.breath) || (c.breath && BREATHS[c.breath]) || null);
  const actives = {};
  for (const a of c.actives) {
    const n = activeName(a);
    if (ACTIVES[n] && (o.actives[n] ?? ACTIVES[n].def)) actives[n] = { arg: activeArg(a), ready: 0 };
  }
  const st = Object.fromEntries(Object.keys(AILMENTS).map(k => [k, 0]));
  Object.assign(st, { drowsy: 0, sleep: 0, fear: 0, aftershock: 0, deepwounds: 0 });
  return {
    c, name: c.name, S, maxHp: S.hp, hp: S.hp,
    baseWeight: S.weight, dmg: S.dmg, cd: S.cd,
    regenTick: S.hp * S.regen / REGEN_TICKS,
    firstStrike: +P["First Strike"] || 0,
    guilt: !!P["Guilt"], unbreakable: +P["Unbreakable"] || 0,
    berserk: !!P["Berserk"], serrated: !!P["Serrated Teeth"],
    breathRes: Math.min(1, +P["Breath Resistance"] || 0),
    frostyImmune: !!P["Frosty"], volcanic: !!P["Volcanic"], muddy: !!o.buffs.muddy,
    atk: S.atk, def: S.def, block: S.block, breath, actives,
    twoFaced: actives["Two-Faced"] ? (o.twoFaced === "madness" ? { dmg: 0.625, cd: 0.625 } : { dmg: 1.6, cd: 1.6 }) : null,
    nextBite: 0, lastBite: 0,
    br: breath ? { fireFrom: breath.lance ? 3 : (breath.delay || 0), fireUntil: 0, nextHit: 0, chain: 0, ready: 0, lanceTicks: 0 } : null,
    st,
    buff: { harden: 0, rage: 0, adrenaline: 0, curse: 0, leech: 0, reflect: 0, fortify: 0, cocooned: 0, cocoonRage: 0, healing: 0 },
    spite: null, barrage: null, divCharms: 0, divReadyAt: 0, lichMarked: false, frostNova: 0, totem: 0,
    stats: { minWeight: S.weight, hits: 0, biteDmg: 0, breath: 0, regen: 0, ability: 0, reflected: 0, ...Object.fromEntries(Object.keys(AILMENTS).map(k => [k, 0])) },
  };
}

const effWeight = f => {
  let w = f.baseWeight;
  if (f.buff.harden > 0) w *= TUNE.hardenW;
  if (f.buff.fortify > 0) w *= 1.05;
  if (f.st.corrosion > 0) w *= Math.max(0.025, 1 - (0.075 + 0.01 * f.st.corrosion));
  return w;
};
const effBlock = (f, type) => {
  const b = f.block[type];
  return b > 0 ? b * (1 - Math.min(99, f.st.radiation) / 100) : b;
};
const immune = f => f.buff.fortify > 0 || f.buff.cocooned > 0;
function applyAil(target, type, stacks, useBlock = true) {
  if (immune(target) || !type) return;
  if (stacks < 0) { if (type in target.st) target.st[type] = Math.max(0, target.st[type] + stacks); return; } // valor negativo cura
  if (!(type in target.block)) { if (type in target.st) target.st[type] = Math.min(type === "deepwounds" ? 10 : 99, target.st[type] + stacks); return; } // drowsy, fear, aftershock, deep wounds…
  const s = stacks * (useBlock ? 1 - effBlock(target, type) : 1);
  if (s > 0) target.st[type] = Math.min(99, target.st[type] + s);
}
// Corrosão e doença: stacks por mordida escalam com o peso, como o dano (wiki: Corrosion/Disease Status)
const WEIGHT_SCALED = new Set(["corrosion", "disease"]);
const ailScale = (type, src, target) => WEIGHT_SCALED.has(type) ? weightFactor(effWeight(src), effWeight(target)) : 1;

function dmgMult(f) {
  let m = 1;
  if (f.buff.rage > 0) m *= 1.3;
  if (f.buff.adrenaline > 0) m *= 1.2;
  if (f.buff.curse > 0) m *= 2;
  if (f.buff.cocoonRage > 0) m *= 1.15;
  if (f.st.fear > 0) m *= TUNE.fearMult;
  if (f.st.aftershock > 0) m *= 0.8; // Aftershock: −20% dano
  if (f.st.drowsy > 0) m *= Math.max(0, 1 - 0.025 * f.st.drowsy);
  if (f.twoFaced) m *= f.twoFaced.dmg;
  if (f.actives["Warden's Rage"]) {
    const ws = Math.min(1, Math.max(0, (1 - f.hp / f.maxHp) / 0.5));
    m *= Math.max(1, 8.5 * ws);
  }
  if (f.firstStrike && f.hp > f.maxHp * 0.75) m *= 1 + f.firstStrike;
  return m;
}
function biteCd(f) {
  let cd = f.cd * (1 + 0.025 * f.st.frostbite);
  if (f.st.drowsy > 0) cd *= 1.25;
  if (f.twoFaced) cd *= f.twoFaced.cd;
  if (f.berserk && f.hp < f.maxHp * 0.2) cd *= 0.5;
  return cd;
}

// slots: [{creature, opts}, ...]; first: 0|1
// rand: liga as variações reais de uma luta (usado no cálculo da chance de vitória):
// fase do tick de 3s do servidor, pequenas variações no tempo entre mordidas e chance real dos status de sopro
function simulate(slots, env, first, { log = true, offsets = [0, 0], rand = false, seed = 1 } = {}) {
  const R = rand ? mulberry32(seed) : null;
  const F = slots.map(s => buildFighter(s, env));
  F[0].nextBite = offsets[0]; F[1].nextBite = offsets[1];
  const order = first === 1 ? [1, 0] : [0, 1];
  const events = [];
  const timeline = [{ t: 0, hp: [F[0].hp, F[1].hp] }];
  const ev = (t, who, text) => log && events.push({ t, who, text });
  let t = 0, winner = -1, nextTick = rand ? Math.max(DT, Math.round(R() * TICK * 10) / 10) : TICK;

  const hurt = (target, amt, kind, src) => {
    if (target.buff.cocooned > 0 || amt <= 0) return 0;
    target.hp -= amt;
    src.stats[kind] += amt;
    return amt;
  };
  const heal = (f, amt) => {
    const r = Math.max(0, Math.min(amt, f.maxHp - f.hp));
    f.hp += r; f.stats.regen += r;
  };
  const dead = () => F[0].hp <= 0 || F[1].hp <= 0;
  const negStacks = f => Object.keys(AILMENTS).reduce((s, k) => s + f.st[k], 0) + f.st.drowsy + f.st.fear;

  // Mordida (também usada pelo Shadow Barrage)
  function bite(me, foe, i, { mult = 1, ailMult = 1, noReflect = false } = {}) {
    let d = me.dmg * dmgMult(me) * mult * weightFactor(effWeight(me), effWeight(foe));
    let bonus = 0;
    if (me.spite && t >= me.spite.at) { bonus += me.dmg * me.spite.x * weightFactor(effWeight(me), effWeight(foe)); ailMult *= 2; me.spite = null; }
    if (me.divCharms > 0 && t >= me.divReadyAt + 30) me.divCharms = 0; // cargas duram 30s
    if (me.divCharms > 0 && t >= me.divReadyAt) { bonus += 50; me.divCharms--; applyAil(foe, "burn", 2, false); }
    if (me.expunge && foe.st.bleed > 0) {
      const extra = d * 0.05 * foe.st.bleed;
      ev(t, i, tx("log.expunge", { a: me.name, n: fmtD(foe.st.bleed, 1) }));
      foe.st.bleed = 0; bonus += extra; heal(me, extra / 2); me.expunge = false;
    }
    if (foe.guilt) { d *= 0.5; bonus *= 0.5; }
    if (foe.S.hunker) { d *= 1 - foe.S.hunker; bonus *= 1 - foe.S.hunker; }
    let total = d + bonus;
    if (foe.unbreakable) total = Math.min(total, foe.maxHp * foe.unbreakable / 100);
    total = Math.ceil(total);

    if (foe.buff.reflect > 0 && !noReflect) {
      const back = Math.ceil(Math.min(d, total));
      hurt(me, back, "reflected", foe);
      ev(t, i, tx("log.reflect", { a: foe.name, b: me.name, n: `<b>${fmtN(back)}</b>` }));
      total -= back;
    }
    const done = hurt(foe, total, "biteDmg", me);
    if (foe.S.knight && done > 0) hurt(me, done * 0.25 * 0.2, "reflected", foe); // valor esperado
    if (me.buff.leech > 0 && done > 0) heal(me, done * me.leechPct);
    for (const a of me.atk) applyAil(foe, a.type, a.stacks * ailMult * ailScale(a.type, me, foe));
    for (const a of foe.def) applyAil(me, a.type, a.stacks * TUNE.defK * (TUNE.defScale ? ailScale(a.type, foe, me) : 1));
    if (me.serrated) foe.st.deepwounds = 10; // Serrated Teeth: 10 stacks de Deep Wounds
    if (me.lichMarked === "armed") { foe.lichMarkedBy = me; me.lichMarked = false; }
    else if (foe.lichMarkedBy === me && me.lichType) { applyAil(foe, me.lichType, 5, false); foe.lichMarkedBy = null; ev(t, i, tx("log.lich", { s: statusPt(me.lichType) })); }
    me.lastBite = done;
    me.stats.hits++;
    ev(t, i, tx("log.bite", { a: me.name, b: foe.name, n: `<b>${fmtN(done)}</b>` }));
    return done;
  }

  // Uso automático das habilidades ativas
  function useActives(me, foe, i) {
    const A = me.actives, ready = n => A[n] && t + 1e-9 >= A[n].ready;
    const go = (n, cd, msg) => { A[n].ready = t + cd; ev(t, i, tx("log.uses", { a: me.name, s: n }) + (msg ? ": " + tx(msg) : "")); };
    if (ready("Harden")) { me.buff.harden = 10; go("Harden", 120); }
    if (ready("Earthquake")) { me.st.aftershock = Math.max(me.st.aftershock, 4); go("Earthquake", 150, "log.m.earthquake"); }
    if (ready("Unbridled Rage")) { me.buff.rage = 10; go("Unbridled Rage", 120); }
    if (ready("Adrenaline")) { me.buff.adrenaline = 10; go("Adrenaline", 90); }
    if (ready("Hunters Curse") && me.hp > me.maxHp * 0.5) { me.hp -= me.maxHp * 0.5; me.buff.curse = 10; go("Hunters Curse", 120, "log.m.curse"); }
    if (ready("Life Leech") && me.hp < me.maxHp * 0.95) { me.buff.leech = 4; me.leechPct = +A["Life Leech"].arg || 0; go("Life Leech", 60); }
    if (ready("Spite") && !me.spite) { me.spite = { at: t + 5, x: +A["Spite"].arg || 0 }; go("Spite", 20); }
    if (ready("Reflect") && t + 1e-9 >= TUNE.reflectAt) { me.buff.reflect = TUNE.reflectStacks; go("Reflect", 45); }
    if (ready("Fortify") && negStacks(me) >= 5) {
      for (const k of [...Object.keys(AILMENTS), "drowsy", "fear", "aftershock", "deepwounds"]) me.st[k] = 0;
      me.buff.fortify = 3; go("Fortify", 90, "log.m.fortify");
    }
    if (ready("Cocoon") && me.hp < me.maxHp * 0.4) { me.cocoonAt = t + 5; go("Cocoon", 120); }
    if (me.cocoonAt && t + 1e-9 >= me.cocoonAt) { me.cocoonAt = 0; me.buff.cocooned = 2; me.cocoonHeal = me.maxHp * 0.3 / 2; ev(t, i, tx("log.cocoon", { a: me.name })); }
    if (ready("Healing Pulse") && me.hp < me.maxHp * 0.9) { me.buff.healing = 10; go("Healing Pulse", 90); }
    if (ready("Expunge") && foe.st.bleed >= 5) { me.expunge = true; go("Expunge", 45); }
    if (ready("Divination")) { me.divCharms = 3; me.divReadyAt = t + 15; go("Divination", 60, "log.m.divination"); }
    if (ready("Lich Mark")) { me.lichMarked = "armed"; me.lichType = ailKey(A["Lich Mark"].arg); go("Lich Mark", 30); }
    if (ready("Poison Area")) { applyAil(foe, "poison", 5, false); go("Poison Area", 15); }
    if (ready("Frost Nova")) { me.frostNova = 5; go("Frost Nova", 60); }
    if (ready("Totem")) { me.totem = 40; me.totemType = ailKey(A["Totem"].arg); go("Totem", 120); }
    if (ready("Cause Fear")) { if (!immune(foe)) foe.st.fear = TUNE.fearStacks; go("Cause Fear", 120); }
    if (ready("Drowsy Area")) { if (!immune(foe)) foe.st.drowsy += 5; go("Drowsy Area", 60); }
    if (ready("Shadow Barrage") && me.lastBite > 0) { me.barrage = { n: +A["Shadow Barrage"].arg || 0, k: 0, base: me.lastBite, next: t }; go("Shadow Barrage", 30); }
  }

  while (t < MAX_TIME) {
    // ---- Tick de 3s: status, regen e buffs (antes das mordidas do mesmo instante)
    if (t + 1e-9 >= nextTick) {
      nextTick += TICK;
      for (let i = 0; i < 2; i++) {
        const me = F[i], src = F[1 - i], st = me.st;
        const wasCocooned = me.buff.cocooned > 0;
        for (const k of Object.keys(st)) {
          if (k === "bleed" && st.deepwounds > 0) continue; // Deep Wounds: sangramento não diminui
          st[k] = Math.max(0, st[k] - (me.muddy && (k === "poison" || k === "bleed") ? 2 : 1) * (Object.keys(AILMENTS).includes(k) ? TUNE.decay : 1)); // Lamacento cura 2×
        }
        for (const k of Object.keys(me.buff)) {
          // buffs próprios parados não perdem stacks (como o Aggressive da wiki)
          if (TUNE.selfBuffPersist === "harden" && k === "harden") continue;
          if (TUNE.selfBuffPersist === "all" && ["harden", "rage", "adrenaline", "curse"].includes(k)) continue;
          me.buff[k] = Math.max(0, me.buff[k] - 1);
        }
        if (st.drowsy >= 10) { st.drowsy = 0; st.sleep = 2; }
        // status aplicados por área do oponente
        if (src.frostNova > 0) { applyAil(me, "frostbite", 3, false); src.frostNova--; }
        if (src.totem > 0) { applyAil(me, src.totemType, 2, false); src.totem--; }
        if (src.actives["Aura"]) applyAil(me, ailKey(src.actives["Aura"].arg), 3, false);
        // dano de status
        if (st.bleed > 0) hurt(me, 2 * st.bleed * TUNE.bleedK, "bleed", src);
        if (st.poison > 0) hurt(me, me.maxHp * (0.002 + 0.0005 * st.poison) * TUNE.poisonK, "poison", src);
        if (st.burn > 0) hurt(me, me.maxHp * (0.00025 + 0.001 * st.burn) * TUNE.burnK, "burn", src);
        if (st.corrosion > 0) hurt(me, me.maxHp * 0.005, "corrosion", src);
        if (st.radiation > 0) hurt(me, me.maxHp * 0.005, "radiation", src);
        if (env.heatwave && !me.volcanic && me.buff.cocooned <= 0) { me.hp -= me.maxHp * 0.01; applyAil(me, "burn", 2, false); }
        if (env.blizzard && !me.frostyImmune && me.buff.cocooned <= 0) me.hp -= me.maxHp * 0.0075;
        // regeneração
        if (me.hp > 0) {
          me.regenCount = (me.regenCount || 0) + 1;
          const regenNow = TUNE.regenMode === "split" || me.regenCount % REGEN_TICKS === 0;
          if (regenNow && (st.bleed <= 0 || !TUNE.bleedBlocksRegen) && !me.actives["Warden's Rage"]) {
            let r = me.regenTick * (TUNE.regenMode === "split" ? 1 : REGEN_TICKS) * Math.max(0, 1 - 0.1 * st.burn) * (st.disease > 0 ? 0.75 : 1) * (me.buff.harden > 0 ? 1.25 : 1);
            heal(me, r);
          }
          if (me.buff.healing > 0) heal(me, me.maxHp * 0.07 / REGEN_TICKS);
          if (wasCocooned) heal(me, me.cocoonHeal);
          if (wasCocooned && me.buff.cocooned === 0) { me.cocoonHeal = 0; me.buff.cocoonRage = 6.66; }
        }
      }
      if (dead()) break;
    }

    for (const i of order) {
      const me = F[i], foe = F[1 - i];
      if (dead()) break;
      useActives(me, foe, i);

      // ---- Mordida
      if (t + 1e-9 >= me.nextBite) {
        if (me.buff.cocooned > 0 || me.st.sleep > 0) { me.nextBite = t + DT; }
        else {
          bite(me, foe, i);
          me.nextBite += biteCd(me) * (rand ? 1 + (R() * 2 - 1) * TUNE.jitter : 1);
          if (foe.hp <= 0) break;
        }
      }

      // ---- Shadow Barrage (um acerto a cada 0,5s)
      const sb = me.barrage;
      if (sb && t + 1e-9 >= sb.next && sb.k < sb.n) {
        sb.k++; sb.next = t + 0.5;
        const d = Math.ceil(sb.base * Math.pow(0.9, sb.k));
        if (foe.buff.reflect > 0) { hurt(me, sb.base, "reflected", foe); ev(t, i, tx("log.barrageReflected", { n: `<b>${fmtN(sb.base)}</b>` })); }
        else { hurt(foe, d, "ability", me); for (const a of me.atk) applyAil(foe, a.type, a.stacks * ailScale(a.type, me, foe)); ev(t, i, `Shadow Barrage ${sb.k}/${sb.n}: <b>${d}</b>`); }
        if (sb.k >= sb.n) me.barrage = null;
        if (dead()) break;
      }

      // ---- Sopro / feixe / lança
      const B = me.breath, s = me.br;
      if (!B || !s) continue;
      // Sopros comuns (segurar C) competem com a mordida; feixes automáticos e lanças não
      if (!TUNE.regularBreath && !B.lance && !B.cooldown) continue;
      if (B.lance) {
        if (t + 1e-9 >= s.fireFrom) {
          s.wf = Math.min(1, weightFactor(effWeight(me), effWeight(foe)));
          hurt(foe, foe.maxHp * 0.05 * s.wf * me.S.breathDmg, "breath", me);
          s.lanceTicks = 5; s.nextHit = t + 1; s.fireFrom = t + 60;
          ev(t, i, tx("log.fires", { a: me.name, s: me.c.breath }));
        } else if (s.lanceTicks > 0 && t + 1e-9 >= s.nextHit) {
          hurt(foe, foe.maxHp * 0.01 * s.wf * me.S.breathDmg, "breath", me);
          applyAil(foe, B.type, 1, false);
          s.lanceTicks--; s.nextHit = t + 1;
        }
      } else if (B.cap > 0) {
        if (s.fireUntil <= t && t + 1e-9 >= Math.max(s.fireFrom, s.ready)) {
          s.fireUntil = t + B.cap; s.nextHit = t; s.chain = 0;
          s.ready = B.cooldown ? t + B.cooldown : s.fireUntil + B.cap * B.regen / me.S.breathRegen;
          ev(t, i, tx("log.usesBreath", { a: me.name, s: me.c.breath }));
          if (B.fear && !immune(foe)) foe.st.fear = Math.max(foe.st.fear, 1);
        }
        if (t < s.fireUntil - 1e-9 && t + 1e-9 >= s.nextHit) {
          s.nextHit = t + 0.5;
          if (B.mult > 0) {
            const wf = B.pure || !TUNE.breathWeight ? 1 : weightFactor(effWeight(me), effWeight(foe));
            const chain = B.chain ? 1 + Math.min(s.chain, B.chain[1]) * B.chain[0] : 1;
            const res = B.pure ? 1 : (1 - foe.breathRes) * (1 - foe.S.hunker);
            hurt(foe, foe.maxHp * 0.01 * B.mult * wf * chain * res * me.S.breathDmg * TUNE.breathMult, "breath", me);
            s.chain++;
          }
          if (B.ail) { // simulação única: valor esperado; chance de vitória: sorteio real
            if (!rand) applyAil(foe, B.ail[0], B.ail[1] * B.ail[2], false);
            else if (R() < B.ail[1]) applyAil(foe, B.ail[0], B.ail[2], false);
          }
          if (B.selfHeal) heal(me, me.maxHp * B.selfHeal);
        }
      }
    }
    if (dead()) break;

    t = Math.round((t + DT) * 1000) / 1000;
    if (Math.abs(t * 2 - Math.round(t * 2)) < 1e-6) {
      timeline.push({ t, hp: [Math.max(0, F[0].hp), Math.max(0, F[1].hp)] });
      for (const f of F) f.stats.minWeight = Math.min(f.stats.minWeight, effWeight(f));
    }
  }

  if (dead()) winner = F[0].hp > 0 ? 0 : F[1].hp > 0 ? 1 : (F[0].hp >= F[1].hp ? 0 : 1);
  timeline.push({ t, hp: [Math.max(0, F[0].hp), Math.max(0, F[1].hp)] });
  if (winner >= 0) ev(t, -1, tx("log.defeated", { a: F[1 - winner].name }));
  return { winner, time: t, fighters: F, timeline, events, timeout: winner < 0 };
}

// Gerador pseudoaleatório com semente (mesma semente → mesma luta, resultados reproduzíveis)
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let x = Math.imul(a ^ a >>> 15, 1 | a);
    x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x;
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

// Uma luta "real": quem morde primeiro (se não for fixo), atraso da 1ª mordida, fase do tick do servidor etc.
function sampleRun(slots, env, seed, { first = null, log = false } = {}) {
  const R = mulberry32(seed * 7919 + 13);
  const f = first ?? (R() < 0.5 ? 0 : 1);
  const offsets = slots.map(s => Math.round(R() * s.creature.cd * 10) / 10);
  return simulate(slots, env, f, { log, offsets, rand: true, seed });
}

// Chance de vitória e a luta "típica" (a mediana das simulações), para o relatório bater com a chance
function winProbability(slots, env, runs = 120, { first = null } = {}) {
  let w0 = 0;
  const margins = [];
  for (let k = 1; k <= runs; k++) {
    const r = sampleRun(slots, env, k, { first });
    if (r.winner === 0) w0++;
    else if (r.winner < 0) w0 += 0.5;
    const W = r.fighters[r.winner];
    const m = r.winner < 0 ? 0 : (r.winner === 0 ? 1 : -1) * Math.max(0, W.hp) / W.maxHp;
    margins.push({ seed: k, m });
  }
  margins.sort((a, b) => a.m - b.m);
  const p = w0 / runs;
  winProbability.last = { p, medianSeed: margins[Math.floor(runs / 2)].seed };
  return p;
}
