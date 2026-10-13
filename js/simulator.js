const defaultOpts = () => ({
  dmgPct: 0, hpPct: 0, wPct: 0, rgPct: 0, cdPct: 0, elder: "none", ven: 0,
  traits: [{ type: "", level: 0 }, { type: "", level: 0 }],
  plush: ["", ""],
  buffs: { aggressive: false, scared: false, cleanWater: false, muddy: false, packHealer: false, newborn: false, sin: 0, defensive: 0 },
  actives: {}, breath: true, twoFaced: "tranq",
});
const state = {
  slots: [{ creature: null, opts: defaultOpts() }, { creature: null, opts: defaultOpts() }],
  env: { season: "summer", night: false, blueMoon: false, bloodMoon: false, blizzard: false, heatwave: false },
  first: "auto",
  picking: 0,
  open: [new Set(), new Set()], // seções <details> abertas em cada lado
};
const $ = id => document.getElementById(id);
const byName = n => CREATURES.find(c => c.name.toLowerCase() === String(n).toLowerCase());
const sideName = i => t(i ? "side.b" : "side.a");
const sideSpan = (i, text) => `<span style="color:var(--${i ? "b" : "a"})">${text}</span>`;

// Garante combinações válidas (veneração exige ancião, ascensões ≤ estágio, pelúcias não-acumuláveis)
function normalize(o) {
  if (o.elder === "none") o.ven = 0;
  if (o.traits[1].type && o.traits[1].type === o.traits[0].type) o.traits[1] = { type: "", level: 0 };
  let budget = o.ven;
  for (const tr of o.traits) {
    if (!TRAITS[tr.type]?.base) tr.level = 0;
    tr.level = Math.max(0, Math.min(tr.level, budget));
    budget -= tr.level;
  }
  if (o.plush[0] && o.plush[0] === o.plush[1] && PLUSHIES[o.plush[0]].stack === false) o.plush[1] = "";
}

// ---------- Pelúcias: exibição ----------
const plushInfo = n => (typeof PLUSHIE_INFO !== "undefined" && PLUSHIE_INFO[n]) || {};
const plushImg = n => plushInfo(n).img
  ? `<img src="${plushInfo(n).img}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'pimg-fallback',textContent:'${n[0]}'}))">`
  : `<span class="pimg-fallback">${n[0]}</span>`;
// Nome traduzido de uma passiva da wiki ("Poison Attack" → "veneno ao morder")
function passivePt(k) {
  const ail = Object.values(AILMENTS).find(a => k.includes(a.key)) || (k.includes("Injury") ? { pt: t("ail.injury") } : null);
  const name = ail ? ail.pt.toLowerCase() : k;
  if (/ Attack$/.test(k)) return t("pas.attack", { s: name });
  if (/^Defensive /.test(k)) return t("pas.defensive", { s: name });
  if (/^Block /.test(k)) return t("pas.block", { s: name });
  if (k === "Breath Resistance") return t("pas.breathRes");
  return k;
}
// Efeito de pelúcia em pedacinhos (bom/ruim)
function effectParts(eff) {
  const parts = [];
  for (const [k, v] of Object.entries(eff.mult || {})) {
    const d = v - 1;
    parts.push({ t: fx(d, k), good: k === "cd" ? d < 0 : d > 0 });
  }
  for (const [k, v] of Object.entries(eff.add || {})) {
    if (v === true) parts.push({ t: t("fx.gains", { s: k }), good: true });
    else if (/^Block|Breath Resistance/.test(k)) parts.push({ t: `${P(v)} ${passivePt(k)}`, good: v > 0 });
    else parts.push({ t: `${v > 0 ? "+" : "−"}${fmtD(Math.abs(v), 2)} ${passivePt(k)}`, good: v > 0 });
  }
  return parts;
}
const ncParts = p => (p.nc || []).map(x => Array.isArray(x)
  ? { t: fx(x[1], x[0]), good: x[0] === "hunger" ? x[1] < 0 : x[1] > 0, nc: true }
  : { t: t(x), good: true, nc: true });
function plushParts(name, stubborn) {
  const p = PLUSHIES[name];
  if (stubborn && p.stubborn) return [...effectParts(p.stubborn), ...ncParts(p).map(x => ({ ...x, good: null }))];
  const parts = effectParts(p);
  if (p.night) parts.push(...effectParts({ mult: p.night }).map(x => ({ ...x, t: t("fx.atNight", { s: x.t }) })));
  if (p.knight) parts.unshift({ t: t("fx.knight"), good: true });
  if (p.breathDmg) parts.push({ t: fx(p.breathDmg - 1, "breathDmg"), good: true });
  if (p.breathRegen) parts.push({ t: fx(p.breathRegen - 1, "breathRecharge"), good: true });
  if (p.bear) parts.push({ t: t("fx.bear"), good: true });
  if (p.mud) parts.push({ t: t("fx.oceanwing"), good: true });
  parts.push(...ncParts(p));
  return parts;
}
const chipsHTML = parts => parts.map(x => `<span class="ech ${x.good === true ? "good" : x.good === false ? "bad" : ""} ${x.nc ? "nc" : ""}" ${x.nc ? `title="${t("chip.nc")}"` : ""}>${x.t}</span>`).join("");
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
const rarityTag = n => plushInfo(n).rarity ? `<span class="rar r-${plushInfo(n).rarity}">${plushInfo(n).rarity}</span>` : "";
const offDuelTag = () => `<span class="rar" style="color:var(--muted)">${t("tag.offDuel")}</span>`;

function plushSlotHTML(i, k, name, stubborn) {
  if (!name) return `<button class="pslot empty" data-plush-open="${k}" data-i="${i}"><span class="pplus">+</span><span>${t("plush.choose", { n: k + 1 })}</span></button>`;
  const p = PLUSHIES[name];
  return `<div class="pslot">
      <button class="pimg" data-plush-open="${k}" data-i="${i}" title="${t("btn.change")}">${plushImg(name)}</button>
      <div class="pinfo">
        <div class="pname"><b>${name}</b>${rarityTag(name)}</div>
        <div class="echips">${chipsHTML(plushParts(name, stubborn))}</div>
        ${stubborn && p.stubborn ? `<small class="hint">${t("plush.stubborn")}</small>` : ""}
      </div>
      <div class="pacts"><button data-plush-open="${k}" data-i="${i}">${t("btn.change")}</button><button data-set="plush.${k}" data-v="" data-i="${i}">${t("btn.remove")}</button></div>
    </div>`;
}

// ---------- Traits: exibição ----------
const traitPart = (type, level) => {
  const T = TRAITS[type];
  return { t: fx(T.sign < 0 ? -traitValue(type, level) : traitValue(type, level), T.unit), good: true, nc: !T.combat };
};
function traitSlotHTML(i, k, tr, budgetLeft) {
  if (!tr.type) return `<button class="pslot empty" data-trait-open="${k}" data-i="${i}"><span class="pplus">+</span><span>${t("trait.choose", { n: k + 1 })}</span></button>`;
  const T = TRAITS[tr.type];
  return `<div class="tslot">
    <div class="tslot-main">
      <div class="pname"><b>${T.pt} ${ROMAN[tr.level + 1]}</b>${T.combat ? "" : offDuelTag()}</div>
      <div class="echips">${chipsHTML([traitPart(tr.type, tr.level)])}</div>
      <div class="asc">
        <small>${t("trait.ascensions")}</small>
        <button data-set="trait.${k}.level" data-v="${tr.level - 1}" data-i="${i}" ${tr.level <= 0 ? "disabled" : ""}>−</button>
        <span class="pips">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= tr.level ? "on" : ""}"></i>`).join("")}</span>
        <button data-set="trait.${k}.level" data-v="${tr.level + 1}" data-i="${i}" ${tr.level >= 5 || budgetLeft <= 0 ? "disabled" : ""} title="${budgetLeft <= 0 ? t("trait.needVen") : ""}">+</button>
      </div>
    </div>
    <div class="pacts"><button data-trait-open="${k}" data-i="${i}">${t("btn.change")}</button><button data-set="trait.${k}.type" data-v="" data-i="${i}">${t("btn.remove")}</button></div>
  </div>`;
}

// ---------- Janela genérica de opções (traits) ----------
let opPick = null;
function openOptPicker({ kicker, title, html, onPick }) {
  $("op-kicker").innerHTML = kicker; $("op-title").textContent = title; $("op-list").innerHTML = html;
  opPick = onPick;
  $("opt-picker").classList.add("open"); document.body.style.overflow = "hidden";
}
function closeOptPicker() { $("opt-picker").classList.remove("open"); document.body.style.overflow = ""; }
function openTraitPicker(i, k) {
  const s = state.slots[i], other = s.opts.traits[1 - k].type, cur = s.opts.traits[k].type;
  const card = ([key, T]) => {
    const blocked = key && key === other;
    return `<button class="pcard tcard ${cur === key ? "sel" : ""}" data-opt-key="${key}" ${blocked ? "disabled" : ""}>
      <div class="pcard-body">
        <div class="pname"><b>${T.pt}</b>${T.combat ? "" : offDuelTag()}</div>
        <div class="echips">${chipsHTML([traitPart(key, 0)])}</div>
        <small class="pnote">${t("trait.perAsc", { a: P(T.sign < 0 ? -T.asc : T.asc), b: traitPart(key, 5).t })}</small>
        ${blocked ? `<small class="pnote">${t("trait.blocked")}</small>` : ""}
      </div>${cur === key ? `<span class="pcheck">${t("tag.equipped")}</span>` : ""}</button>`;
  };
  const list = Object.entries(TRAITS).filter(([k2]) => k2);
  openOptPicker({
    kicker: `Trait ${k + 1} · ${sideSpan(i, s.creature.name)}`,
    title: t("trait.pickTitle"),
    html: `<section><h4>${t("trait.combatGroup")}</h4><div class="pp-grid">${list.filter(([, T]) => T.combat).map(card).join("")}</div></section>
           <section><h4>${t("trait.otherGroup")}</h4><div class="pp-grid">${list.filter(([, T]) => !T.combat).map(card).join("")}</div></section>
           <p class="hint">${t("trait.rule")}</p>`,
    onPick: key => { s.opts.traits[k].type = key; hideResult(); renderAll(); },
  });
}

// ---------- Ajuste manual ----------
const MANUAL = [
  { key: "dmgPct", stat: "dmg",    min: -90,  max: 200 },
  { key: "hpPct",  stat: "hpmax",  min: -90,  max: 200 },
  { key: "wPct",   stat: "weight", min: -90,  max: 200 },
  { key: "rgPct",  stat: "regen",  min: -100, max: 300 },
  { key: "cdPct",  stat: "cd",     min: -75,  max: 200, inverse: true },
];

// ---------- Slots ----------
function section(i, key, title, summary, body) {
  return `<details class="sec" data-sec="${key}" data-i="${i}" ${state.open[i].has(key) ? "open" : ""}>
    <summary><span>${title}</span><small>${summary}</small></summary><div class="sec-body">${body}</div></details>`;
}

function renderSlot(i) {
  const el = $("slot" + i), s = state.slots[i], c = s.creature, o = s.opts;
  if (!c) {
    el.innerHTML = `<button class="slot-empty" data-pick="${i}"><div>
      <div class="num">${i ? "B" : "A"}</div><div class="slot-title">${t("slot.choose", { s: sideName(i) })}</div><small>${t("slot.chooseHint")}</small></div></button>`;
    return;
  }
  normalize(o);
  const S = buildStats(s, state.env), p = S.passives;
  const bar = (v, max, col) => `<div class="bar"><i style="width:${Math.min(100, v / max * 100)}%;background:${col}"></i></div>`;
  const delta = (fin, base, inverse = false) => {
    const d = fin / base - 1;
    if (Math.abs(d) < 0.0005) return "";
    return `<em class="${(inverse ? d < 0 : d > 0) ? "up" : "down"}">${P(d)}</em>`;
  };
  const season = state.env.season;
  const tags = [
    ...S.atk.map(a => a.stacks > 0
      ? `${AILMENTS[a.type].pt} ${fmtD(a.stacks, 2)}`
      : t("tag.cureOnBite", { n: fmtD(-a.stacks, 2), s: AILMENTS[a.type].pt.toLowerCase() })),
    ...S.def.map(a => a.stacks > 0
      ? t("tag.defensive", { s: AILMENTS[a.type].pt, n: fmtD(a.stacks, 2) })
      : t("tag.cureAttacker", { n: fmtD(-a.stacks, 2), s: AILMENTS[a.type].pt.toLowerCase() })),
    p["Frosty"] && `Frosty · ${["winter", "famine"].includes(season) ? t("tag.activeRegen", { n: "+25%" }) : t("tag.frostyWhen")}`,
    p["Volcanic"] && `Volcanic · ${["famine", "drought"].includes(season) ? t("tag.activeRegen", { n: "+50%" }) : t("tag.volcanicWhen")}`,
    p["Hunker"] && `Hunker ${p["Hunker"]}${PCT_SIGN}${S.hunker ? ` (${t("tag.active")})` : ""}`,
    p["First Strike"] && `First Strike ${P(p["First Strike"])}`,
    p["Unbreakable"] && `Unbreakable ${p["Unbreakable"]}${PCT_SIGN}`,
    p["Guilt"] && `Guilt (${t("tag.guilt")})`,
    p["Berserk"] && `Berserk`,
    p["Serrated Teeth"] && `Serrated Teeth`,
    p["Breath Resistance"] && `${t("pas.breathRes")} ${pct(p["Breath Resistance"])}`,
  ].filter(Boolean);
  const blocks = Object.entries(AILMENTS).filter(([k]) => S.block[k]).map(([k, a]) => `${a.pt} ${pct(S.block[k])}`);

  // --- Ancião e veneração
  const venUsed = o.traits.reduce((n, tr) => n + tr.level, 0);
  const vb = venBonus(c.tier, o.ven);
  const elderSec = section(i, "elder", t("sec.elder"),
    o.elder === "none" ? t("elder.adult") : `${ELDER[o.elder].pt}${o.ven ? " · " + VEN_STAGES[o.ven] : ""}`, `
    <div class="ocards">${Object.entries(ELDER).map(([v, e]) => `
      <button class="ocard ${o.elder === v ? "sel" : ""}" data-set="elder" data-v="${v}" data-i="${i}">
        <div class="oc-head"><b>${e.pt}</b>${o.elder === v ? `<span class="pcheck">${t("tag.chosen")}</span>` : ""}</div>
        <small>${e.d}</small>
        ${e.parts.length ? `<div class="echips">${chipsHTML(e.parts)}</div>` : ""}
      </button>`).join("")}</div>
    <label style="margin-top:6px">${t("ven.label")} ${o.elder === "none" ? "· " + t("ven.locked") : ""}</label>
    <div class="ven-track ${o.elder === "none" ? "locked" : ""}">${VEN_STAGES.map((n, v) => `
      <button class="ven-step ${v <= o.ven ? "done" : ""} ${v === o.ven ? "cur" : ""}" data-set="ven" data-v="${v}" data-i="${i}" ${o.elder === "none" ? "disabled" : ""}>
        <span class="dot">${v === 0 ? "0" : ROMAN[v]}</span><small>${n}</small></button>`).join("")}</div>
    ${o.ven ? `<div class="echips">${chipsHTML([{ t: `+${fmtN(vb.hp)} ${t("st.hp")}`, good: true }, { t: `+${fmtN(vb.weight)} ${t("st.weight")}`, good: true }, { t: t("ven.ascensions", { n: o.ven }), good: true }])}</div>
      <p class="hint">${t("ven.hint", { hp: fmtN(200 * c.tier), w: fmtN(80 * c.tier), tier: c.tier })}</p>` : ""}`);

  // --- Traits
  const traitSec = section(i, "traits", "Traits",
    o.traits.filter(tr => tr.type).map(tr => `${TRAITS[tr.type].pt} ${ROMAN[tr.level + 1]}`).join(", ") || t("none.m"),
    `<div class="tslots">${o.traits.map((tr, k) => traitSlotHTML(i, k, tr, o.ven - venUsed)).join("")}</div>
     <p class="hint">${t("trait.used", { a: venUsed, b: o.ven })}</p>`);

  // --- Pelúcias
  const plushSec = section(i, "plush", t("sec.plush"), o.plush.filter(Boolean).join(", ") || t("none.f"),
    `<div class="pslots">${o.plush.map((pl, k) => plushSlotHTML(i, k, pl, !!c.passives["Stubborn Stacker"])).join("")}</div>
     <p class="hint">${t("plush.rule")}</p>`);

  // --- Buffs
  const bear = o.plush.some(n => n && PLUSHIES[n].bear);
  const nBuffs = Object.entries(o.buffs).filter(([, v]) => v).length;
  const buffSec = section(i, "buffs", "Buffs", nBuffs ? t("buffs.active", { n: nBuffs }) : t("none.m"),
    `<div class="ocards">${Object.entries(BUFFS).map(([k, b]) => {
      let parts = b.parts;
      if (bear && k === "aggressive") parts = [{ t: `${fx(0.375, "dmg")} (Bear)`, good: true }, ...parts.slice(1)];
      if (bear && k === "scared") parts = [{ t: `${fx(-0.45, "dmg")} (Bear)`, good: false }, ...parts.slice(1)];
      if (b.stacks) {
        const has = !!c.passives[b.needs], n = o.buffs[k] || 0;
        return `<div class="ocard ${n ? "sel" : ""} ${has ? "" : "locked"}">
          <div class="oc-head"><b>${b.pt}</b>
            <span class="stepper">
              <button data-set="buff.${k}" data-v="${n - 1}" data-i="${i}" ${!has || n <= 0 ? "disabled" : ""}>−</button>
              <span>${n}/${b.stacks}</span>
              <button data-set="buff.${k}" data-v="${n + 1}" data-i="${i}" ${!has || n >= b.stacks ? "disabled" : ""}>+</button>
            </span></div>
          <small>${has ? b.how : t("buffs.needs", { s: b.needs })}</small>
          <div class="echips">${chipsHTML(parts)}</div></div>`;
      }
      const on = !!o.buffs[k];
      return `<button class="ocard toggle ${on ? "sel" : ""}" data-set="buff.${k}" data-v="${on ? 0 : 1}" data-i="${i}">
        <div class="oc-head"><b>${b.pt}</b><span class="switch ${on ? "on" : ""}"></span></div>
        <small>${b.how}</small>
        <div class="echips">${chipsHTML(parts)}</div></button>`;
    }).join("")}</div>`);

  // --- Habilidades ativas
  const acts = c.actives.filter(a => ACTIVES[activeName(a)]);
  const others = c.actives.filter(a => !ACTIVES[activeName(a)]);
  const onCount = acts.filter(a => o.actives[activeName(a)] ?? ACTIVES[activeName(a)].def).length;
  const argPt = a => a && (ailKey(a) ? statusPt(ailKey(a)) : a);
  const toggleCard = ({ key, title, sub, parts, on }) => `
    <button class="ocard toggle ${on ? "sel" : ""}" data-set="${key}" data-v="${on ? 0 : 1}" data-i="${i}">
      <div class="oc-head"><b>${title}</b><span class="switch ${on ? "on" : ""}"></span></div>
      <small>${sub}</small>
      <div class="echips">${chipsHTML(parts)}</div></button>`;
  const cdPart = s2 => ({ t: t("fx.cooldown", { n: s2 }), good: null });
  const actCards = acts.map(a => {
    const n = activeName(a), arg = activeArg(a), card = ACTIVE_CARDS[n], on = o.actives[n] ?? ACTIVES[n].def;
    const shown = ["Life Leech", "Spite"].includes(n) ? arg : argPt(arg);
    const parts = [...card.parts(shown), ...(card.cd ? [cdPart(card.cd)] : [])];
    return toggleCard({ key: `active.${n}`, title: a, sub: t(card.how), parts, on }) +
      (n === "Two-Faced" && on ? `<div class="seg" style="grid-column:1/-1">${[["tranq", t("form.tranq")], ["madness", t("form.madness")]].map(([v, label]) => `<button data-set="twoFaced" data-v="${v}" data-i="${i}" class="${o.twoFaced === v ? "on" : ""}">${label}</button>`).join("")}</div>` : "");
  });
  if (c.passives["Hunker"]) actCards.push(toggleCard({ key: "hunker", title: `Hunker (${c.passives["Hunker"]}${PCT_SIGN})`, sub: t("hunker.sub"),
    parts: [{ t: t("hunker.takes", { n: 100 - c.passives["Hunker"] }), good: true }, { t: fx(-0.5, "dmg"), good: false }, { t: fx(-0.25, "speed"), good: false, nc: true }], on: o.hunker !== false }));
  if (c.breath) {
    const B = BREATHS[c.breath], L = lanceOf(c.breath);
    const bp = L ? [{ t: t("breath.lance1"), good: true }, { t: t("breath.lance2", { s: L.type ? AILMENTS[L.type].pt.toLowerCase() : "status" }), good: true }, cdPart(60)]
      : !B ? [{ t: t("breath.noData"), good: null }]
      : [B.mult ? { t: t("breath.dps", { n: fmtD(B.mult * 2, 2) }), good: true } : { t: t("breath.noDamage"), good: null },
         ...(B.ail ? [{ t: t("breath.chance", { p: Math.round(B.ail[1] * 100), n: fmtD(B.ail[2], 2), s: AILMENTS[B.ail[0]]?.pt.toLowerCase() }), good: true }] : []),
         ...(B.selfHeal ? [{ t: t("breath.selfHeal", { n: fmtD(B.selfHeal * 200, 1) }), good: true }] : []),
         ...(B.chain ? [{ t: t("breath.chain"), good: true }] : []),
         ...(B.cap ? [{ t: t("breath.fireTime", { n: B.cap }), good: null }] : []),
         B.cooldown ? cdPart(B.cooldown) : { t: t("fx.cdEstimated"), good: null }];
    actCards.push(toggleCard({ key: "breath", title: c.breath,
      sub: L ? t("breath.subLance") : B?.cooldown ? t("breath.subBeam") : t("breath.subBreath"),
      parts: bp, on: o.breath }));
  }
  const nonCards = others.map(a => `<div class="ocard locked"><div class="oc-head"><b>${a}</b><span class="rar" style="color:var(--muted)">${t("tag.noEffect")}</span></div>
      <small>${noncombatText(activeName(a))}</small></div>`);
  const activeSec = section(i, "actives", t("sec.actives"),
    [acts.length ? t("actives.on", { a: onCount, b: acts.length }) : "", S.hunker ? "Hunker" : "", c.breath && o.breath ? t("lbl.breath") : ""].filter(Boolean).join(" · ") || t("actives.none"),
    (actCards.length ? `<div class="ocards">${actCards.join("")}</div>` : `<p class="hint">${t("actives.noneHint")}</p>`)
    + (nonCards.length ? `<label style="margin-top:6px">${t("actives.noEffectGroup")}</label><div class="ocards">${nonCards.join("")}</div>` : ""));

  // --- Ajuste manual
  const manualActive = MANUAL.filter(m => o[m.key]);
  const manualSec = section(i, "manual", t("sec.manual"),
    manualActive.map(m => `${t("st." + m.stat)} ${o[m.key] > 0 ? "+" : ""}${o[m.key]}${PCT_SIGN}`).join(" · ") || t("none.m"),
    `<div class="ocards">${MANUAL.map(m => {
      const v = o[m.key] || 0, good = m.inverse ? v < 0 : v > 0;
      return `<div class="ocard mcard ${v ? "sel" : ""}">
        <div class="oc-head"><b>${t("manual." + m.key)}</b><span class="mval ${v ? (good ? "up" : "down") : ""}">${v > 0 ? "+" : ""}${v}${PCT_SIGN}</span></div>
        <small>${t("manual." + m.key + ".d")}</small>
        <input type="range" class="mrange" min="${m.min}" max="${m.max}" step="5" value="${v}" data-set="${m.key}" data-i="${i}">
        <div class="mbtns">
          ${[-10, -5, 5, 10].map(st => `<button data-set="${m.key}" data-v="${Math.max(m.min, Math.min(m.max, v + st))}" data-i="${i}">${st > 0 ? "+" : "−"}${Math.abs(st)}</button>`).join("")}
          <button data-set="${m.key}" data-v="0" data-i="${i}" ${v ? "" : "disabled"}>${t("manual.reset")}</button>
        </div></div>`;
    }).join("")}</div>
    <p class="hint">${t("manual.hint")}</p>`);

  el.innerHTML = `
    <div class="plate">
      ${avatarHTML(c)}
      <div class="plate-badges"><span class="badge">Tier ${c.tier}</span><span class="badge">${typePt(c.type)}</span><span class="badge">${dietPt(c.diet)}</span></div>
      <div class="plate-actions"><button data-pick="${i}">${t("btn.change")}</button><button data-remove="${i}">✕</button></div>
      <div class="plate-info">
        <div><span class="side-tag">${t("slot.side", { s: sideName(i) })}</span><h2>${c.name}</h2></div>
        ${firstHitter() === i ? `<span class="first-flag">${t("slot.bitesFirst")}</span>` : ""}
      </div>
    </div>
    <div class="slot-body">
    <div class="stats-list">
      <div class="stat-box"><small>${t("lbl.hp").toUpperCase()}</small><b>${fmtN(S.hp)} ${delta(S.hp, c.hp)}</b><small>(${pct(S.regen)} regen ${delta(S.regen, c.regen || 1)})</small>${bar(S.hp, 20000, `var(--${i ? "b" : "a"})`)}</div>
      <div class="stat-box"><small>${t("lbl.dmg").toUpperCase()}</small><b>${fmtN(S.dmg)} ${delta(S.dmg, c.dmg)}</b>${bar(S.dmg, 600, `var(--${i ? "b" : "a"})`)}</div>
      <div class="stat-box"><small>${t("lbl.weight").toUpperCase()}</small><b>${fmtN(S.weight)} ${delta(S.weight, c.weight)}</b>${bar(S.weight, 30000, `var(--${i ? "b" : "a"})`)}</div>
      <div class="stat-box"><small>${t("lbl.cd").toUpperCase()}</small><b>${fmtD(S.cd, 3)}s ${delta(S.cd, c.cd, true)}</b>${bar(2 - S.cd, 1.6, `var(--${i ? "b" : "a"})`)}</div>
    </div>
    ${tags.length ? `<div class="tags">${tags.map(x => `<span class="badge fx">${x}</span>`).join("")}</div>` : ""}
    ${blocks.length ? `<div class="tags"><small>${t("lbl.blocks")}</small> ${blocks.map(x => `<span class="badge">${x}</span>`).join("")}</div>` : ""}
    <div class="secs">${elderSec}${traitSec}${plushSec}${buffSec}${activeSec}${manualSec}</div>
    <details class="more"><summary>${t("slot.allAbilities")}</summary>
      <p><b>${t("slot.passives")}:</b> ${Object.entries(c.passives).map(([k, v]) => v === true ? k : `${k} (${v})`).join(", ") || "—"}</p>
      <p><b>${t("slot.actives")}:</b> ${c.actives.join(", ") || "—"}</p>
    </details>
    </div>`;
}

function firstHitter() {
  const [a, b] = state.slots;
  if (!a.creature || !b.creature) return -1;
  if (state.first !== "auto") return +state.first;
  return buildStats(a, state.env).weight >= buildStats(b, state.env).weight ? 0 : 1;
}

function renderAll() {
  renderSlot(0); renderSlot(1);
  $("fight").disabled = !state.slots.every(s => s.creature);
  updateProbability();
  const p = new URLSearchParams();
  state.slots.forEach((s, i) => s.creature && p.set("c" + (i + 1), s.creature.name));
  history.replaceState(null, "", "?" + p.toString());
}

function updateProbability() {
  const [a, b] = state.slots.map(s => s.creature);
  $("pn0").textContent = a ? a.name : "—";
  $("pn1").textContent = b ? b.name : "—";
  if (!a || !b) {
    $("pv0").textContent = $("pv1").textContent = "??%";
    $("pb0").style.width = $("pb1").style.width = "50%";
    return;
  }
  const p = winProbability(state.slots, state.env);
  $("pv0").textContent = pct(p);
  $("pv1").textContent = pct(1 - p);
  $("pb0").style.width = p * 100 + "%";
  $("pb1").style.width = (1 - p) * 100 + "%";
}

// ---------- Eventos dos slots ----------
function setOpt(el) {
  const i = +el.dataset.i, o = state.slots[i].opts, key = el.dataset.set;
  const val = el.type === "checkbox" ? el.checked : (el.dataset.v ?? el.value);
  const [a, b, c] = key.split(".");
  if (a === "trait") o.traits[+b][c] = c === "level" ? Math.max(0, +val) : val;
  else if (a === "plush") o.plush[+b] = val;
  else if (a === "buff") o.buffs[b] = BUFFS[b].stacks ? Math.max(0, Math.min(BUFFS[b].stacks, +val)) : (val === true || val === "1");
  else if (a === "active") o.actives[b] = val === true || val === "1";
  else if (a === "hunker" || a === "breath") o[a] = val === true || val === "1";
  else if (MANUAL.some(m => m.key === a)) { const m = MANUAL.find(m => m.key === a); o[a] = Math.max(m.min, Math.min(m.max, Math.round(+val || 0))); }
  else if (a === "ven") o.ven = +val;
  else o[a] = val;
  hideResult(); renderAll();
}
document.querySelector(".arena").addEventListener("click", e => {
  const pick = e.target.closest("[data-pick]");
  const rem = e.target.closest("[data-remove]");
  const btn = e.target.closest("button[data-set]");
  const pp = e.target.closest("[data-plush-open]");
  if (pp) { openPlushPicker(+pp.dataset.i, +pp.dataset.plushOpen); return; }
  const tp = e.target.closest("[data-trait-open]");
  if (tp) { openTraitPicker(+tp.dataset.i, +tp.dataset.traitOpen); return; }
  if (rem) { state.slots[+rem.dataset.remove] = { creature: null, opts: defaultOpts() }; hideResult(); renderAll(); }
  else if (btn) setOpt(btn);
  else if (pick) openPicker(+pick.dataset.pick);
});
document.querySelector(".arena").addEventListener("change", e => {
  const el = e.target.closest("input[data-set], select[data-set]");
  if (el) setOpt(el);
});
document.querySelector(".arena").addEventListener("toggle", e => {
  const d = e.target;
  if (!d.matches?.("details.sec")) return;
  state.open[+d.dataset.i][d.open ? "add" : "delete"](d.dataset.sec);
}, true);

$("first").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  state.first = b.dataset.v;
  [...$("first").children].forEach(x => x.classList.toggle("on", x === b));
  renderAll();
});
$("daynight").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  state.env.night = b.dataset.v === "night";
  [...$("daynight").children].forEach(x => x.classList.toggle("on", x === b));
  hideResult(); renderAll();
});
$("env").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  state.env[b.dataset.k] = !state.env[b.dataset.k];
  b.classList.toggle("on", state.env[b.dataset.k]);
  hideResult(); renderAll();
});
$("swap").addEventListener("click", () => {
  state.slots.reverse(); state.open.reverse();
  if (state.first !== "auto") $("first").querySelector(`[data-v="${1 - state.first}"]`).click();
  else renderAll();
});

// ---------- Seletor de criaturas ----------
$("picker-filters").innerHTML = filterToolbarHTML("p-");
bindFilters("p-", f => renderCards($("picker-grid"), filterCreatures(f)));

function openPicker(i) {
  state.picking = i;
  $("picker-title").innerHTML = t("picker.title", { s: sideSpan(i, sideName(i)) });
  $("picker").classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("p-q").focus(), 50);
}
function closePicker() { $("picker").classList.remove("open"); document.body.style.overflow = ""; }
$("picker-close").addEventListener("click", closePicker);
$("picker").addEventListener("click", e => { if (e.target.id === "picker") closePicker(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closePicker(); });
$("picker-grid").addEventListener("click", e => {
  const card = e.target.closest(".c-card"); if (!card) return;
  state.slots[state.picking].creature = CREATURES[+card.dataset.idx];
  closePicker(); hideResult(); renderAll();
});

// ---------- Seletor de pelúcias ----------
const ppState = { i: 0, k: 0, cat: "all", q: "" };
$("pp-cats").innerHTML = [["all", t("pcat.all")], ...Object.entries(PLUSH_CATS).map(([k, c]) => [k, c.pt])]
  .map(([k, label]) => `<button class="chip ${k === "all" ? "on" : ""}" data-cat="${k}">${label}</button>`).join("");

function openPlushPicker(i, k) {
  Object.assign(ppState, { i, k, q: "" });
  $("pp-q").value = "";
  $("pp-kicker").innerHTML = `${t("plush.slot", { n: k + 1 })} · ${sideSpan(i, state.slots[i].creature.name)}`;
  renderPlushPicker();
  $("plush-picker").classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("pp-q").focus(), 50);
}
function closePlushPicker() { $("plush-picker").classList.remove("open"); document.body.style.overflow = ""; }

function renderPlushPicker() {
  const { i, k, cat, q } = ppState, o = state.slots[i].opts, c = state.slots[i].creature;
  const stubborn = !!c.passives["Stubborn Stacker"];
  const other = o.plush[1 - k], current = o.plush[k];
  const query = q.trim().toLowerCase();
  const match = n => !query || n.toLowerCase().includes(query) || plushParts(n, stubborn).some(x => x.t.toLowerCase().includes(query));
  const cats = cat === "all" ? Object.keys(PLUSH_CATS) : [cat];
  const card = n => {
    const p = PLUSHIES[n];
    const blocked = other === n && p.stack === false;
    return `<button class="pcard ${current === n ? "sel" : ""}" data-plush="${n}" ${blocked ? "disabled" : ""}>
      <div class="pcard-img">${plushImg(n)}</div>
      <div class="pcard-body">
        <div class="pname"><b>${n}</b>${rarityTag(n)}</div>
        <div class="echips">${chipsHTML(plushParts(n, stubborn))}</div>
        <small class="pnote">${blocked ? t("plush.blocked") : p.stack === false ? t("plush.noStack") : t("plush.stacks")}${stubborn && p.stubborn ? " · " + t("plush.stubbornShort") : ""}</small>
      </div>
      ${current === n ? `<span class="pcheck">${t("tag.equippedF")}</span>` : ""}
    </button>`;
  };
  const html = cats.map(ck => {
    const names = PLUSH_CATS[ck].list.filter(n => PLUSHIES[n] && match(n));
    return names.length ? `<section><h4>${PLUSH_CATS[ck].pt}</h4><div class="pp-grid">${names.map(card).join("")}</div></section>` : "";
  }).join("");
  $("pp-list").innerHTML = html || `<p class="empty">${t("plush.notFound", { s: q })}</p>`;
  $("pp-none").style.display = current ? "" : "none";
}
$("pp-q").addEventListener("input", e => { ppState.q = e.target.value; renderPlushPicker(); });
$("pp-cats").addEventListener("click", e => {
  const b = e.target.closest("[data-cat]"); if (!b) return;
  ppState.cat = b.dataset.cat;
  [...$("pp-cats").children].forEach(x => x.classList.toggle("on", x === b));
  renderPlushPicker();
});
$("pp-list").addEventListener("click", e => {
  const b = e.target.closest("[data-plush]"); if (!b || b.disabled) return;
  state.slots[ppState.i].opts.plush[ppState.k] = b.dataset.plush;
  closePlushPicker(); hideResult(); renderAll();
});
$("pp-none").addEventListener("click", () => {
  state.slots[ppState.i].opts.plush[ppState.k] = "";
  closePlushPicker(); hideResult(); renderAll();
});
$("pp-close").addEventListener("click", closePlushPicker);
$("plush-picker").addEventListener("click", e => { if (e.target.id === "plush-picker") closePlushPicker(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closePlushPicker(); });

$("op-list").addEventListener("click", e => {
  const b = e.target.closest("[data-opt-key]"); if (!b || b.disabled) return;
  const fn = opPick; closeOptPicker(); fn && fn(b.dataset.optKey);
});
$("op-close").addEventListener("click", closeOptPicker);
$("opt-picker").addEventListener("click", e => { if (e.target.id === "opt-picker") closeOptPicker(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeOptPicker(); });

// ---------- Estação ----------
$("season").innerHTML = Object.entries(SEASONS).map(([k, v]) => `<option value="${k}">${v.pt}</option>`).join("");
function syncSeason() {
  const s = state.env.season || "summer", cold = s === "winter" || s === "famine";
  const bz = document.querySelector('#env [data-k="blizzard"]');
  bz.disabled = !cold; bz.title = cold ? t("env.blizzard.tip") : t("env.blizzard.off");
  if (!cold && state.env.blizzard) { state.env.blizzard = false; bz.classList.remove("on"); }
  $("season-hint").textContent = SEASONS[s].d || "";
}
$("season").addEventListener("change", e => { state.env.season = e.target.value; syncSeason(); hideResult(); renderAll(); });
syncSeason();

// ---------- Batalha ----------
let lastResult = null;
function hideResult() { $("result").classList.remove("show"); }

$("fight").addEventListener("click", () => {
  lastResult = simulate(state.slots, state.env, firstHitter());
  renderResult(lastResult);
  toast(t("toast.done"));
});

function renderResult(r) {
  const [A, B] = r.fighters, W = r.winner;
  const ails = Object.keys(AILMENTS).filter(k => A.stats[k] > 0 || B.stats[k] > 0);
  const total = f => f.stats.biteDmg + f.stats.breath + f.stats.ability + f.stats.reflected + Object.keys(AILMENTS).reduce((a, k) => a + f.stats[k], 0);
  const rows = [
    [t("rep.bites"), f => f.stats.hits],
    [t("rep.perBite"), f => f.stats.hits ? f.stats.biteDmg / f.stats.hits : 0],
    [t("rep.biteDmg"), f => f.stats.biteDmg],
    ...ails.map(k => [AILMENTS[k].pt, f => f.stats[k]]),
    (A.stats.breath || B.stats.breath) && [t("lbl.breath"), f => f.stats.breath],
    (A.stats.ability || B.stats.ability) && [t("rep.abilities"), f => f.stats.ability],
    (A.stats.reflected || B.stats.reflected) && [t("rep.reflected"), f => f.stats.reflected],
    [t("rep.regen"), f => f.stats.regen],
    [t("rep.minWeight"), f => f.stats.minWeight],
  ].filter(Boolean);
  const row = ([label, get], cls = "") => {
    const va = get(A), vb = get(B);
    return `<tr class="${cls}"><td>${label}</td><td class="${va > vb ? "lead" : ""}">${fmtN(va)}</td><td class="${vb > va ? "lead" : ""}">${fmtN(vb)}</td></tr>`;
  };
  const hpPct = f => Math.round(Math.max(0, f.hp) / f.maxHp * 100);
  const title = r.timeout ? t("rep.draw") : t("rep.wins", { s: `<span class="${W ? "wb" : "wa"}">${r.fighters[W].name}</span>` });
  $("result").innerHTML = `
    <article class="report">
      <div class="report-head">
        <div><span class="kicker">${t("rep.kicker")}</span><h2>${title}</h2></div>
        <div class="report-meta">
          <div><small>${t("rep.duration")}</small><b>${fmtD(r.time, 1)}s</b></div>
          ${r.timeout ? "" : `<div><small>${t("rep.hpLeft")}</small><b>${hpPct(r.fighters[W])}${PCT_SIGN}</b></div>`}
        </div>
      </div>
      <table class="cmp">
        <thead><tr><th>${t("rep.stat")}</th><th class="ca">${A.name}</th><th class="cb">${B.name}</th></tr></thead>
        <tbody>
          ${rows.map(x => row(x)).join("")}
          ${row([t("rep.total"), total], "total")}
          <tr class="total"><td>${t("rep.finalHp")}</td><td>${fmtN(Math.max(0, A.hp))} (${hpPct(A)}${PCT_SIGN})</td><td>${fmtN(Math.max(0, B.hp))} (${hpPct(B)}${PCT_SIGN})</td></tr>
        </tbody>
      </table>
      <div class="report-body">
        <div><h4>${t("rep.chart")}</h4><canvas id="chart"></canvas></div>
        <div><h4>${t("rep.log")}</h4>
          <div class="log">${r.events.map(ev => `<div class="${ev.who === 0 ? "l1" : ev.who === 1 ? "l2" : "lk"}">${fmtD(ev.t, 1)}s · ${ev.text}</div>`).join("")}</div>
        </div>
      </div>
    </article>`;
  $("result").classList.add("show");
  drawChart(r);
  $("result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function drawChart(r) {
  const cv = $("chart"); if (!cv) return;
  const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  const pad = { l: 52, r: 12, t: 12, b: 24 };
  const maxT = Math.max(r.time, 1), maxHp = Math.max(...r.fighters.map(f => f.maxHp));
  const x = tm => pad.l + (tm / maxT) * (w - pad.l - pad.r);
  const y = val => pad.t + (1 - val / maxHp) * (h - pad.t - pad.b);

  ctx.font = "11px Manrope, sans-serif"; ctx.fillStyle = v("--muted"); ctx.strokeStyle = v("--border");
  for (let k = 0; k <= 4; k++) {
    const val = maxHp * k / 4, yy = y(val);
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    ctx.fillText(fmtN(val), 4, yy + 4);
  }
  for (let k = 0; k <= 5; k++) { const tm = maxT * k / 5; ctx.fillText(fmtN(tm) + "s", x(tm) - 8, h - 6); }

  [v("--a"), v("--b")].forEach((col, i) => {
    ctx.beginPath();
    r.timeline.forEach((p, k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, x(p.t), y(p.hp[i])));
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(i ? [6, 4] : []); ctx.stroke();
  });
  ctx.setLineDash([]);
}
document.addEventListener("themechange", () => { if (lastResult && $("result").classList.contains("show")) drawChart(lastResult); });

function toast(msg) {
  const el = $("toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- Inicialização via URL (?c1=Aesmir&c2=Ahri'Tahmuk) ----------
const params = new URLSearchParams(location.search);
["c1", "c2"].forEach((k, i) => {
  const v = params.get(k);
  if (v) state.slots[i].creature = byName(v) || CREATURES[+v] || null;
});
renderAll();
window.addEventListener("resize", () => { if (lastResult && $("result").classList.contains("show")) drawChart(lastResult); });
