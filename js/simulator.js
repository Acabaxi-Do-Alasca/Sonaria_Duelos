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
const opt = (v, label, sel) => `<option value="${v}" ${String(v) === String(sel) ? "selected" : ""}>${label}</option>`;

// Garante combinações válidas (veneração exige ancião, ascensões ≤ estágio, pelúcias não-acumuláveis)
function normalize(o) {
  if (o.elder === "none") o.ven = 0;
  if (o.traits[1].type && o.traits[1].type === o.traits[0].type) o.traits[1] = { type: "", level: 0 };
  let budget = o.ven;
  for (const t of o.traits) {
    if (!TRAITS[t.type]?.base) t.level = 0;
    t.level = Math.max(0, Math.min(t.level, budget));
    budget -= t.level;
  }
  if (o.plush[0] && o.plush[0] === o.plush[1] && PLUSHIES[o.plush[0]].stack === false) o.plush[1] = "";
}

// ---------- Pelúcias: exibição ----------
const plushInfo = n => (typeof PLUSHIE_INFO !== "undefined" && PLUSHIE_INFO[n]) || {};
const plushImg = n => plushInfo(n).img
  ? `<img src="${plushInfo(n).img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'pimg-fallback',textContent:'${n[0]}'}))">`
  : `<span class="pimg-fallback">${n[0]}</span>`;
const PCT = v => `${v > 0 ? "+" : "−"}${String(+(Math.abs(v) * 100).toFixed(1)).replace(".", ",")}%`;
const STAT_PT = { dmg: "dano", weight: "peso", regen: "regen", cd: "recarga", hp: "vida" };
// Traduz nomes de passivas da wiki ("Poison Attack" → "veneno ao morder")
function passivePt(k) {
  const ail = Object.values(AILMENTS).find(a => k.includes(a.key)) || (k.includes("Injury") ? { pt: "Ferimento" } : null);
  const name = ail ? ail.pt.toLowerCase() : k;
  if (/ Attack$/.test(k)) return `${name} ao morder`;
  if (/^Defensive /.test(k)) return `${name} em quem morde`;
  if (/^Block /.test(k)) return `bloqueio de ${name}`;
  if (k === "Breath Resistance") return "resistência a sopro";
  return k;
}
// Descreve um efeito de pelúcia em pedacinhos (bom/ruim)
function effectParts(eff) {
  const parts = [];
  for (const [k, v] of Object.entries(eff.mult || {})) {
    const d = v - 1, good = k === "cd" ? d < 0 : d > 0;
    parts.push({ t: `${PCT(d)} ${STAT_PT[k]}`, good });
  }
  for (const [k, v] of Object.entries(eff.add || {})) {
    if (v === true) parts.push({ t: `ganha ${k}`, good: true });
    else if (/^Block|Breath Resistance/.test(k)) parts.push({ t: `${PCT(v)} ${passivePt(k)}`, good: v > 0 });
    else parts.push({ t: `${v > 0 ? "+" : ""}${String(v).replace(".", ",")} ${passivePt(k)}`, good: v > 0 });
  }
  return parts;
}
function plushParts(name, stubborn) {
  const p = PLUSHIES[name];
  if (stubborn && p.stubborn) return [...effectParts(p.stubborn), ...(p.nc || []).map(t => ({ t, good: null, nc: true }))];
  const parts = effectParts(p);
  if (p.night) parts.push(...effectParts({ mult: p.night }).map(x => ({ ...x, t: x.t + " à noite" })));
  if (p.knight) parts.unshift({ t: "25% de chance de refletir 20% do dano", good: true });
  if (p.breathDmg) parts.push({ t: `${PCT(p.breathDmg - 1)} dano de sopro`, good: true });
  if (p.breathRegen) parts.push({ t: `${PCT(p.breathRegen - 1)} recarga do sopro`, good: true });
  if (p.bear) parts.push({ t: "Agressivo/Acuado ×1,1 +10 pontos", good: true });
  if (p.mud) parts.push({ t: "efeito do Lamacento ×1,5", good: true });
  for (const t of p.nc || []) parts.push({ t, good: /^[−-]/.test(t) && !/fome|sede/.test(t) ? false : true, nc: true });
  return parts;
}
const chipsHTML = parts => parts.map(x => `<span class="ech ${x.good === true ? "good" : x.good === false ? "bad" : ""} ${x.nc ? "nc" : ""}" ${x.nc ? 'title="Não afeta o face tank"' : ""}>${x.t}</span>`).join("");
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
const rarityTag = n => plushInfo(n).rarity ? `<span class="rar r-${plushInfo(n).rarity}">${plushInfo(n).rarity}</span>` : "";

function plushSlotHTML(i, k, name, stubborn) {
  if (!name) return `<button class="pslot empty" data-plush-open="${k}" data-i="${i}"><span class="pplus">+</span><span>Escolher pelúcia ${k + 1}</span></button>`;
  const p = PLUSHIES[name];
  return `<div class="pslot">
      <button class="pimg" data-plush-open="${k}" data-i="${i}" title="Trocar">${plushImg(name)}</button>
      <div class="pinfo">
        <div class="pname"><b>${name}</b>${rarityTag(name)}</div>
        <div class="echips">${chipsHTML(plushParts(name, stubborn))}</div>
        ${stubborn && p.stubborn ? `<small class="hint">Efeito alterado por Stubborn Stacker</small>` : ""}
      </div>
      <div class="pacts"><button data-plush-open="${k}" data-i="${i}">Trocar</button><button data-set="plush.${k}" data-v="" data-i="${i}">Tirar</button></div>
    </div>`;
}

// ---------- Traits: exibição ----------
const traitPart = (type, level) => {
  const T = TRAITS[type], v = traitValue(type, level);
  return { t: `${T.sign < 0 ? "−" : "+"}${String(+(v * 100).toFixed(1)).replace(".", ",")}% ${T.unit}`, good: true, nc: !T.combat };
};
function traitSlotHTML(i, k, t, budgetLeft) {
  if (!t.type) return `<button class="pslot empty" data-trait-open="${k}" data-i="${i}"><span class="pplus">+</span><span>Escolher trait ${k + 1}</span></button>`;
  const T = TRAITS[t.type];
  return `<div class="tslot">
    <div class="tslot-main">
      <div class="pname"><b>${T.pt} ${ROMAN[t.level + 1]}</b>${T.combat ? "" : `<span class="rar" style="color:var(--muted)">Fora do duelo</span>`}</div>
      <div class="echips">${chipsHTML([traitPart(t.type, t.level)])}</div>
      <div class="asc">
        <small>Ascensões</small>
        <button data-set="trait.${k}.level" data-v="${t.level - 1}" data-i="${i}" ${t.level <= 0 ? "disabled" : ""}>−</button>
        <span class="pips">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= t.level ? "on" : ""}"></i>`).join("")}</span>
        <button data-set="trait.${k}.level" data-v="${t.level + 1}" data-i="${i}" ${t.level >= 5 || budgetLeft <= 0 ? "disabled" : ""} title="${budgetLeft <= 0 ? "Precisa de mais um estágio de veneração" : ""}">+</button>
      </div>
    </div>
    <div class="pacts"><button data-trait-open="${k}" data-i="${i}">Trocar</button><button data-set="trait.${k}.type" data-v="" data-i="${i}">Tirar</button></div>
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
        <div class="pname"><b>${T.pt}</b>${T.combat ? "" : `<span class="rar" style="color:var(--muted)">Fora do duelo</span>`}</div>
        <div class="echips">${chipsHTML([traitPart(key, 0)])}</div>
        <small class="pnote">Cada ascensão: ${T.sign < 0 ? "−" : "+"}${String(+(T.asc * 100).toFixed(1)).replace(".", ",")}% · no máximo (V): ${traitPart(key, 5).t}</small>
        ${blocked ? `<small class="pnote">Já está na outra vaga (não pode repetir)</small>` : ""}
      </div>${cur === key ? `<span class="pcheck">Equipado</span>` : ""}</button>`;
  };
  const list = Object.entries(TRAITS).filter(([k2]) => k2);
  openOptPicker({
    kicker: `Trait ${k + 1} · <span style="color:var(--${i ? "b" : "a"})">${s.creature.name}</span>`,
    title: "Escolher trait",
    html: `<section><h4>Afetam o duelo</h4><div class="pp-grid">${list.filter(([, T]) => T.combat).map(card).join("")}</div></section>
           <section><h4>Fora do duelo (velocidade, estamina, cura)</h4><div class="pp-grid">${list.filter(([, T]) => !T.combat).map(card).join("")}</div></section>
           <p class="hint">Uma criatura pode ter até 2 traits diferentes. Cada estágio de veneração permite ascender um deles (até V).</p>`,
    onPick: key => { s.opts.traits[k].type = key; hideResult(); renderAll(); },
  });
}

// ---------- Ajuste manual ----------
const MANUAL = [
  { key: "dmgPct", pt: "Dano", short: "dano", d: "Multiplica o dano da mordida.", min: -90, max: 200 },
  { key: "hpPct", pt: "Vida máxima", short: "vida", d: "Multiplica a vida máxima.", min: -90, max: 200 },
  { key: "wPct", pt: "Peso", short: "peso", d: "Muda o fator de peso no dano dado e recebido.", min: -90, max: 200 },
  { key: "rgPct", pt: "Regeneração", short: "regen", d: "Multiplica a vida recuperada por tick.", min: -100, max: 300 },
  { key: "cdPct", pt: "Recarga da mordida", short: "recarga", d: "Valor negativo deixa a mordida mais rápida.", min: -75, max: 200, inverse: true },
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
      <div class="num">${i ? "B" : "A"}</div><div class="slot-title">Escolher criatura do lado ${i ? "jade" : "âmbar"}</div><small>Clique para abrir o bestiário</small></div></button>`;
    return;
  }
  normalize(o);
  const S = buildStats(s, state.env), p = S.passives;
  const bar = (v, max, col) => `<div class="bar"><i style="width:${Math.min(100, v / max * 100)}%;background:${col}"></i></div>`;
  const delta = (fin, base, inverse = false) => {
    const d = fin / base - 1;
    if (Math.abs(d) < 0.0005) return "";
    const good = inverse ? d < 0 : d > 0;
    return `<em class="${good ? "up" : "down"}">${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}%</em>`;
  };
  const tags = [
    ...S.atk.map(a => a.stacks > 0
      ? `${AILMENTS[a.type].pt} ${+a.stacks.toFixed(2)}`
      : `Cura ${+(-a.stacks).toFixed(2)} de ${AILMENTS[a.type].pt.toLowerCase()} ao morder`),
    ...S.def.map(a => a.stacks > 0
      ? `${AILMENTS[a.type].pt} defensivo ${+a.stacks.toFixed(2)}`
      : `Cura ${+(-a.stacks).toFixed(2)} de ${AILMENTS[a.type].pt.toLowerCase()} de quem morde`),
    p["Frosty"] && `Frosty (frio)${["winter", "famine"].includes(state.env.season) ? " · ativo: +25% regen" : " · ativo no Inverno/Fome"}`,
    p["Volcanic"] && `Volcanic${["famine", "drought"].includes(state.env.season) ? " · ativo: +50% regen" : " · ativo na Fome/Seca"}`,
    p["Hunker"] && `Hunker ${p["Hunker"]}%${S.hunker ? " (ativo)" : ""}`,
    p["First Strike"] && `First Strike +${pct(p["First Strike"])}`,
    p["Unbreakable"] && `Unbreakable ${p["Unbreakable"]}%`,
    p["Guilt"] && `Guilt (½ dano recebido)`,
    p["Berserk"] && `Berserk`,
    p["Serrated Teeth"] && `Serrated Teeth`,
    p["Breath Resistance"] && `Resist. a sopro ${pct(p["Breath Resistance"])}`,
  ].filter(Boolean);
  const blocks = Object.entries(AILMENTS).filter(([k]) => S.block[k]).map(([k, a]) => `${a.pt} ${pct(S.block[k])}`);

  // --- Ancião e veneração
  const venUsed = o.traits.reduce((n, t) => n + t.level, 0);
  const vb = venBonus(c.tier, o.ven);
  const elderSec = section(i, "elder", "Ancião e veneração",
    o.elder === "none" ? "Adulto" : `${ELDER[o.elder].pt}${o.ven ? " · " + VEN_STAGES[o.ven] : ""}`, `
    <div class="ocards">${Object.entries(ELDER).map(([v, e]) => `
      <button class="ocard ${o.elder === v ? "sel" : ""}" data-set="elder" data-v="${v}" data-i="${i}">
        <div class="oc-head"><b>${e.pt}</b>${o.elder === v ? `<span class="pcheck">Escolhido</span>` : ""}</div>
        <small>${e.d}</small>
        ${e.parts.length ? `<div class="echips">${chipsHTML(e.parts)}</div>` : ""}
      </button>`).join("")}</div>
    <label style="margin-top:6px">Veneração ${o.elder === "none" ? "· escolha um tipo de ancião para liberar" : ""}</label>
    <div class="ven-track ${o.elder === "none" ? "locked" : ""}">${VEN_STAGES.map((n, v) => `
      <button class="ven-step ${v <= o.ven ? "done" : ""} ${v === o.ven ? "cur" : ""}" data-set="ven" data-v="${v}" data-i="${i}" ${o.elder === "none" ? "disabled" : ""}>
        <span class="dot">${v === 0 ? "0" : ROMAN[v]}</span><small>${n}</small></button>`).join("")}</div>
    ${o.ven ? `<div class="echips">${chipsHTML([{ t: `+${fmtN(vb.hp)} vida`, good: true }, { t: `+${fmtN(vb.weight)} peso`, good: true }, { t: `${o.ven} ascensão(ões) de trait`, good: true }])}</div>
      <p class="hint">Bônus de vida/peso ≈ (a wiki só informa o total no estágio V: +${200 * c.tier} vida e +${80 * c.tier} peso no Tier ${c.tier}).</p>` : ""}`);

  // --- Traits
  const traitSec = section(i, "traits", "Traits",
    o.traits.filter(t => t.type).map(t => `${TRAITS[t.type].pt} ${ROMAN[t.level + 1]}`).join(", ") || "Nenhum",
    `<div class="tslots">${o.traits.map((t, k) => traitSlotHTML(i, k, t, o.ven - venUsed)).join("")}</div>
     <p class="hint">Ascensões usadas: <b>${venUsed}/${o.ven}</b> — cada estágio de veneração libera uma.</p>`);

  // --- Pelúcias
  const plushSec = section(i, "plush", "Pelúcias", o.plush.filter(Boolean).join(", ") || "Nenhuma",
    `<div class="pslots">${o.plush.map((pl, k) => plushSlotHTML(i, k, pl, !!c.passives["Stubborn Stacker"])).join("")}</div>
     <p class="hint">Efeitos iguais se multiplicam. As marcadas como "não acumula" só podem ser equipadas uma vez.</p>`);

  // --- Buffs
  const bear = o.plush.some(n => n && PLUSHIES[n].bear);
  const nBuffs = Object.entries(o.buffs).filter(([, v]) => v).length;
  const buffSec = section(i, "buffs", "Buffs", nBuffs ? `${nBuffs} ativo(s)` : "Nenhum",
    `<div class="ocards">${Object.entries(BUFFS).map(([k, b]) => {
      let parts = b.parts;
      if (bear && k === "aggressive") parts = [{ t: "+37,5% dano (Bear)", good: true }, ...parts.slice(1)];
      if (bear && k === "scared") parts = [{ t: "−45% dano (Bear)", good: false }, ...parts.slice(1)];
      if (b.stacks) {
        const has = !!c.passives[b.needs], n = o.buffs[k] || 0;
        return `<div class="ocard ${n ? "sel" : ""} ${has ? "" : "locked"}">
          <div class="oc-head"><b>${b.pt}</b>
            <span class="stepper">
              <button data-set="buff.${k}" data-v="${n - 1}" data-i="${i}" ${!has || n <= 0 ? "disabled" : ""}>−</button>
              <span>${n}/${b.stacks}</span>
              <button data-set="buff.${k}" data-v="${n + 1}" data-i="${i}" ${!has || n >= b.stacks ? "disabled" : ""}>+</button>
            </span></div>
          <small>${has ? b.how : `Exige a passiva ${b.needs}`}</small>
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
  const actCards = acts.map(a => {
    const n = activeName(a), arg = activeArg(a), card = ACTIVE_CARDS[n], on = o.actives[n] ?? ACTIVES[n].def;
    const shown = ["Life Leech", "Spite"].includes(n) ? arg : argPt(arg);
    const parts = [...card.parts(shown), ...(card.cd ? [{ t: `recarga ${card.cd}s`, good: null }] : [])];
    return toggleCard({ key: `active.${n}`, title: a, sub: card.how, parts, on }) +
      (n === "Two-Faced" && on ? `<div class="seg" style="grid-column:1/-1">${[["tranq", "Tranquilidade"], ["madness", "Loucura"]].map(([v, t]) => `<button data-set="twoFaced" data-v="${v}" data-i="${i}" class="${o.twoFaced === v ? "on" : ""}">${t}</button>`).join("")}</div>` : "");
  });
  if (c.passives["Hunker"]) actCards.push(toggleCard({ key: "hunker", title: `Hunker (${c.passives["Hunker"]}%)`, sub: "Passiva: ficar de lado durante a luta",
    parts: [{ t: `recebe só ${100 - c.passives["Hunker"]}% do dano direto`, good: true }, { t: "−50% dano", good: false }, { t: "−25% velocidade", good: false, nc: true }], on: o.hunker !== false }));
  if (c.breath) {
    const B = BREATHS[c.breath], L = lanceOf(c.breath);
    const bp = L ? [{ t: "5% da vida do alvo + 5× 1%", good: true }, { t: `1 stack de ${AILMENTS[L.type]?.pt.toLowerCase() || "status"} por segundo`, good: true }, { t: "recarga 60s", good: null }]
      : !B ? [{ t: "sem dados de dano", good: null }]
      : [B.mult ? { t: `${String(+(B.mult * 2).toFixed(2)).replace(".", ",")}% da vida do alvo por segundo`, good: true } : { t: "não causa dano", good: null },
         ...(B.ail ? [{ t: `${Math.round(B.ail[1] * 100)}% de chance: ${String(B.ail[2]).replace(".", ",")} ${AILMENTS[B.ail[0]]?.pt.toLowerCase()}`, good: true }] : []),
         ...(B.selfHeal ? [{ t: `cura ${String(+(B.selfHeal * 200).toFixed(1)).replace(".", ",")}% da própria vida por segundo`, good: true }] : []),
         ...(B.chain ? [{ t: "dano cresce em acertos seguidos", good: true }] : []),
         ...(B.cap ? [{ t: `${B.cap}s de disparo`, good: null }] : []),
         B.cooldown ? { t: `recarga ${B.cooldown}s`, good: null } : { t: "recarga ≈", good: null }];
    actCards.push(toggleCard({ key: "breath", title: c.breath,
      sub: L ? "Lança: projétil 3s depois de ativar" : B?.cooldown ? "Feixe: dispara até esvaziar" : "Sopro: dano escala com a vida máx. do alvo e o peso",
      parts: bp, on: o.breath }));
  }
  const nonCards = others.map(a => `<div class="ocard locked"><div class="oc-head"><b>${a}</b><span class="rar" style="color:var(--muted)">Sem efeito</span></div>
      <small>${NONCOMBAT_ACTIVES[activeName(a)] || "Habilidade de movimento ou utilidade — não muda uma luta parada."}</small></div>`);
  const activeSec = section(i, "actives", "Habilidades ativas",
    [acts.length ? `${onCount}/${acts.length} ligadas` : "", S.hunker ? "Hunker" : "", c.breath && o.breath ? "Sopro" : ""].filter(Boolean).join(" · ") || "Nenhuma de combate",
    (actCards.length ? `<div class="ocards">${actCards.join("")}</div>` : `<p class="hint">Esta criatura não tem habilidades ativas que mudam um face tank.</p>`)
    + (nonCards.length ? `<label style="margin-top:6px">Não afetam o face tank</label><div class="ocards">${nonCards.join("")}</div>` : ""));

  // --- Ajuste manual
  const manualActive = MANUAL.filter(m => o[m.key]);
  const manualSec = section(i, "manual", "Ajuste manual",
    manualActive.map(m => `${m.short} ${o[m.key] > 0 ? "+" : ""}${o[m.key]}%`).join(" · ") || "Nenhum",
    `<div class="ocards">${MANUAL.map(m => {
      const v = o[m.key] || 0, good = m.inverse ? v < 0 : v > 0;
      return `<div class="ocard mcard ${v ? "sel" : ""}">
        <div class="oc-head"><b>${m.pt}</b><span class="mval ${v ? (good ? "up" : "down") : ""}">${v > 0 ? "+" : ""}${v}%</span></div>
        <small>${m.d}</small>
        <input type="range" class="mrange" min="${m.min}" max="${m.max}" step="5" value="${v}" data-set="${m.key}" data-i="${i}">
        <div class="mbtns">
          ${[-10, -5, 5, 10].map(st => `<button data-set="${m.key}" data-v="${Math.max(m.min, Math.min(m.max, v + st))}" data-i="${i}">${st > 0 ? "+" : "−"}${Math.abs(st)}</button>`).join("")}
          <button data-set="${m.key}" data-v="0" data-i="${i}" ${v ? "" : "disabled"}>zerar</button>
        </div></div>`;
    }).join("")}</div>
    <p class="hint">Use para efeitos que o simulador não cobre, como eventos, códigos ou testes. Aplicado depois de ancião, traits e buffs, e antes do ambiente.</p>`);

  el.innerHTML = `
    <div class="plate">
      ${avatarHTML(c)}
      <div class="plate-badges"><span class="badge">Tier ${c.tier}</span><span class="badge">${typePt(c.type)}</span><span class="badge">${dietPt(c.diet)}</span></div>
      <div class="plate-actions"><button data-pick="${i}">Trocar</button><button data-remove="${i}">✕</button></div>
      <div class="plate-info">
        <div><span class="side-tag">Lado ${i ? "jade" : "âmbar"}</span><h2>${c.name}</h2></div>
        ${firstHitter() === i ? `<span class="first-flag">morde primeiro</span>` : ""}
      </div>
    </div>
    <div class="slot-body">
    <div class="stats-list">
      <div class="stat-box"><small>VIDA</small><b>${fmtN(S.hp)} ${delta(S.hp, c.hp)}</b><small>(${pct(S.regen)} regen ${delta(S.regen, c.regen || 1)})</small>${bar(S.hp, 20000, `var(--${i ? "b" : "a"})`)}</div>
      <div class="stat-box"><small>DANO</small><b>${fmtN(S.dmg)} ${delta(S.dmg, c.dmg)}</b>${bar(S.dmg, 600, `var(--${i ? "b" : "a"})`)}</div>
      <div class="stat-box"><small>PESO</small><b>${fmtN(S.weight)} ${delta(S.weight, c.weight)}</b>${bar(S.weight, 30000, `var(--${i ? "b" : "a"})`)}</div>
      <div class="stat-box"><small>RECARGA</small><b>${+S.cd.toFixed(3)}s ${delta(S.cd, c.cd, true)}</b>${bar(2 - S.cd, 1.6, `var(--${i ? "b" : "a"})`)}</div>
    </div>
    ${tags.length ? `<div class="tags">${tags.map(t => `<span class="badge fx">${t}</span>`).join("")}</div>` : ""}
    ${blocks.length ? `<div class="tags"><small>Bloqueios</small> ${blocks.map(t => `<span class="badge">${t}</span>`).join("")}</div>` : ""}
    <div class="secs">${elderSec}${traitSec}${plushSec}${buffSec}${activeSec}${manualSec}</div>
    <details class="more"><summary>Todas as habilidades (wiki)</summary>
      <p><b>Passivas:</b> ${Object.entries(c.passives).map(([k, v]) => v === true ? k : `${k} (${v})`).join(", ") || "—"}</p>
      <p><b>Ativas:</b> ${c.actives.join(", ") || "—"}</p>
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
  $("pv0").textContent = (p * 100).toFixed(1) + "%";
  $("pv1").textContent = ((1 - p) * 100).toFixed(1) + "%";
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

// ---------- Seletor ----------
$("picker-filters").innerHTML = filterToolbarHTML("p-");
bindFilters("p-", f => renderCards($("picker-grid"), filterCreatures(f)));

function openPicker(i) {
  state.picking = i;
  $("picker-title").innerHTML = `Criatura do lado <span style="color:var(--${i ? "b" : "a"})">${i ? "jade" : "âmbar"}</span>`;
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
$("pp-cats").innerHTML = [["all", "Todas"], ...Object.entries(PLUSH_CATS).map(([k, c]) => [k, c.pt])]
  .map(([k, t]) => `<button class="chip ${k === "all" ? "on" : ""}" data-cat="${k}">${t}</button>`).join("");

function openPlushPicker(i, k) {
  Object.assign(ppState, { i, k, q: "" });
  $("pp-q").value = "";
  const c = state.slots[i].creature;
  $("pp-kicker").innerHTML = `Pelúcia ${k + 1} · <span style="color:var(--${i ? "b" : "a"})">${c.name}</span>`;
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
  const match = n => !query || n.toLowerCase().includes(query) ||
    plushParts(n, stubborn).some(x => x.t.toLowerCase().includes(query)) || PLUSHIES[n].d.toLowerCase().includes(query);
  const cats = cat === "all" ? Object.keys(PLUSH_CATS) : [cat];
  const card = n => {
    const p = PLUSHIES[n];
    const blocked = other === n && p.stack === false;
    return `<button class="pcard ${current === n ? "sel" : ""}" data-plush="${n}" ${blocked ? "disabled" : ""}>
      <div class="pcard-img">${plushImg(n)}</div>
      <div class="pcard-body">
        <div class="pname"><b>${n}</b>${rarityTag(n)}</div>
        <div class="echips">${chipsHTML(plushParts(n, stubborn))}</div>
        <small class="pnote">${blocked ? "Já equipada na outra vaga (não acumula)" : p.stack === false ? "Não acumula com outra igual" : "Acumula com outra igual"}${stubborn && p.stubborn ? " · efeito de Stubborn Stacker" : ""}</small>
      </div>
      ${current === n ? `<span class="pcheck">Equipada</span>` : ""}
    </button>`;
  };
  const html = cats.map(ck => {
    const names = PLUSH_CATS[ck].list.filter(n => PLUSHIES[n] && match(n));
    return names.length ? `<section><h4>${PLUSH_CATS[ck].pt}</h4><div class="pp-grid">${names.map(card).join("")}</div></section>` : "";
  }).join("");
  $("pp-list").innerHTML = html || `<p class="empty">Nenhuma pelúcia encontrada para "${q}".</p>`;
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
  bz.disabled = !cold; bz.title = cold ? "Hipotermia: −0,75% vida por tick (Frosty é imune)" : "Nevasca só acontece no Inverno ou na Fome";
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
  toast("Duelo simulado");
});

function renderResult(r) {
  const [A, B] = r.fighters, W = r.winner;
  const ails = Object.keys(AILMENTS).filter(k => A.stats[k] > 0 || B.stats[k] > 0);
  const total = f => f.stats.biteDmg + f.stats.breath + f.stats.ability + f.stats.reflected + Object.keys(AILMENTS).reduce((a, k) => a + f.stats[k], 0);
  const rows = [
    ["Mordidas", f => f.stats.hits, "high"],
    ["Dano por mordida", f => f.stats.hits ? f.stats.biteDmg / f.stats.hits : 0, "high"],
    ["Dano de mordidas", f => f.stats.biteDmg, "high"],
    ...ails.map(k => [AILMENTS[k].pt, f => f.stats[k], "high"]),
    (A.stats.breath || B.stats.breath) && ["Sopro", f => f.stats.breath, "high"],
    (A.stats.ability || B.stats.ability) && ["Habilidades", f => f.stats.ability, "high"],
    (A.stats.reflected || B.stats.reflected) && ["Refletido", f => f.stats.reflected, "high"],
    ["Vida regenerada", f => f.stats.regen, "high"],
    ["Menor peso na luta", f => f.stats.minWeight, "high"],
  ].filter(Boolean);
  const tr = ([label, get], cls = "") => {
    const va = get(A), vb = get(B);
    return `<tr class="${cls}"><td>${label}</td><td class="${va > vb ? "lead" : ""}">${fmtN(va)}</td><td class="${vb > va ? "lead" : ""}">${fmtN(vb)}</td></tr>`;
  };
  const hpPct = f => Math.round(Math.max(0, f.hp) / f.maxHp * 100);
  const title = r.timeout ? "Empate por tempo" : `<span class="${W ? "wb" : "wa"}">${r.fighters[W].name}</span> vence`;
  $("result").innerHTML = `
    <article class="report">
      <div class="report-head">
        <div><span class="kicker">Relatório do duelo</span><h2>${title}</h2></div>
        <div class="report-meta">
          <div><small>Duração</small><b>${r.time.toFixed(1)}s</b></div>
          ${r.timeout ? "" : `<div><small>Vida restante</small><b>${hpPct(r.fighters[W])}%</b></div>`}
        </div>
      </div>
      <table class="cmp">
        <thead><tr><th>Estatística</th><th class="ca">${A.name}</th><th class="cb">${B.name}</th></tr></thead>
        <tbody>
          ${rows.map(row => tr(row)).join("")}
          ${tr(["Dano total causado", total], "total")}
          <tr class="total"><td>Vida final</td><td>${fmtN(Math.max(0, A.hp))} (${hpPct(A)}%)</td><td>${fmtN(Math.max(0, B.hp))} (${hpPct(B)}%)</td></tr>
        </tbody>
      </table>
      <div class="report-body">
        <div><h4>Vida ao longo do tempo</h4><canvas id="chart"></canvas></div>
        <div><h4>Registro</h4>
          <div class="log">${r.events.map(ev => `<div class="${ev.who === 0 ? "l1" : ev.who === 1 ? "l2" : "lk"}">${ev.t.toFixed(1)}s · ${ev.text}</div>`).join("")}</div>
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
  const x = t => pad.l + (t / maxT) * (w - pad.l - pad.r);
  const y = val => pad.t + (1 - val / maxHp) * (h - pad.t - pad.b);

  ctx.font = "11px Manrope, sans-serif"; ctx.fillStyle = v("--muted"); ctx.strokeStyle = v("--border");
  for (let k = 0; k <= 4; k++) {
    const val = maxHp * k / 4, yy = y(val);
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    ctx.fillText(fmtN(val), 4, yy + 4);
  }
  for (let k = 0; k <= 5; k++) { const t = maxT * k / 5; ctx.fillText(t.toFixed(0) + "s", x(t) - 8, h - 6); }

  [v("--a"), v("--b")].forEach((c, i) => {
    ctx.beginPath();
    r.timeline.forEach((p, k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, x(p.t), y(p.hp[i])));
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash(i ? [6, 4] : []); ctx.stroke();
  });
  ctx.setLineDash([]);
}
document.addEventListener("themechange", () => { if (lastResult && $("result").classList.contains("show")) drawChart(lastResult); });

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- Inicialização via URL (?c1=Aesmir&c2=Ahri'Tahmuk) ----------
const params = new URLSearchParams(location.search);
["c1", "c2"].forEach((k, i) => {
  const v = params.get(k);
  if (v) state.slots[i].creature = byName(v) || CREATURES[+v] || null;
});
renderAll();
window.addEventListener("resize", () => { if (lastResult && $("result").classList.contains("show")) drawChart(lastResult); });
