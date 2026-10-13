// Utilitários de exibição. Os dados das criaturas ficam em js/creatures-data.js
// (gerado por scripts/atualizar_dados.py a partir da wiki oficial).

const TYPE_PT = { "Terrestrial": "Terrestre", "Flier": "Voador", "Aquatic": "Aquático", "Semi-Aquatic": "Semi-Aquático", "Glider": "Planador" };
const DIET_PT = { "Carnivore": "Carnívoro", "Herbivore": "Herbívoro", "Omnivore": "Onívoro", "Photocarnivore": "Fotocarnívoro", "Photovore": "Fotóvoro" };
const TYPE_ICON = { "Terrestrial": "🦶", "Flier": "🪽", "Aquatic": "🌊", "Semi-Aquatic": "💧", "Glider": "🪁" };
const DIET_ICON = { "Carnivore": "🥩", "Herbivore": "🌿", "Omnivore": "🍽️", "Photocarnivore": "☀️", "Photovore": "🌞" };

// Status negativos que importam numa luta parada
const AILMENTS = {
  bleed:      { pt: "Sangramento", icon: "🩸", key: "Bleed" },
  poison:     { pt: "Veneno",      icon: "🧪", key: "Poison" },
  burn:       { pt: "Queimadura",  icon: "🔥", key: "Burn" },
  frostbite:  { pt: "Congelamento",icon: "❄️", key: "Frostbite" },
  corrosion:  { pt: "Corrosão",    icon: "🟢", key: "Corrosion" },
  radiation:  { pt: "Radiação",    icon: "☢️", key: "Radiation" },
  disease:    { pt: "Doença",      icon: "🦠", key: "Disease" },
  necropoison:{ pt: "Necroveneno", icon: "💜", key: "Necropoison" },
};

const typePt = t => TYPE_PT[t] || t;
const dietPt = d => DIET_PT[d] || d;
const fmtN = n => Math.round(n).toLocaleString("pt-BR");
const pct = v => `${Math.round(v * 1000) / 10}%`;

// Criaturas "novas" = as 12 adicionadas mais recentemente
const NEW_SET = new Set([...CREATURES].sort((a, b) => b.added.localeCompare(a.added)).slice(0, 12).map(c => c.name));
const isNew = c => NEW_SET.has(c.name);

// Ataques com status (ofensivos) de uma criatura: [{type, stacks}]
function attackAilments(c) {
  return Object.entries(AILMENTS)
    .map(([type, a]) => ({ type, stacks: +c.passives[`${a.key} Attack`] || 0 }))
    .filter(x => x.stacks > 0);
}
function defensiveAilments(c) {
  return Object.entries(AILMENTS)
    .map(([type, a]) => ({ type, stacks: +c.passives[`Defensive ${a.key}`] || 0 }))
    .filter(x => x.stacks > 0);
}

// "Poder" aproximado só para ordenar/exibir (não usado na simulação)
function powerScore(c) {
  const ail = attackAilments(c).reduce((s, a) => s + a.stacks, 0);
  const dps = (c.dmg / c.cd) * (1 + ail * 0.08) * (1 + (+c.passives["First Strike"] || 0) / 2);
  const ehp = c.hp * (1 + c.regen * 2) * Math.sqrt(c.weight / Math.max(c.hp, 1));
  return Math.round(Math.sqrt(dps * ehp) / 6);
}
function powerLabel(p) {
  // Faixas aproximadas pelos percentis da base (95%, 80%, 50%, 20%)
  if (p >= 400) return { t: "S", c: "#e8b04a" };
  if (p >= 270) return { t: "A", c: "#6cc56f" };
  if (p >= 180) return { t: "B", c: "#59b6d6" };
  if (p >= 110) return { t: "C", c: "#b591e0" };
  return { t: "D", c: "#9aa39b" };
}

function hue(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
function avatarHTML(c, style = "") {
  const h = hue(c.name);
  const initials = c.name.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const img = c.img
    ? `<img class="av-img" src="${c.img}" alt="${c.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : "";
  return `<div class="avatar" style="background:radial-gradient(circle at 50% 65%,hsl(${h} 28% 30%),hsl(${(h + 30) % 360} 25% 13%));${style}">
    <span class="av-initials">${initials}</span>${img}</div>`;
}

function ailmentBadges(c) {
  const out = attackAilments(c).map(a => `<span class="badge fx" title="${AILMENTS[a.type].pt} ao morder">${AILMENTS[a.type].pt} ${a.stacks}</span>`);
  if (c.breath) out.push(`<span class="badge fx" title="${c.breath}">Sopro</span>`);
  if (c.passives["First Strike"]) out.push(`<span class="badge fx">First Strike</span>`);
  return out.join("");
}

function creatureCardHTML(c, idx) {
  const p = powerScore(c), pl = powerLabel(p);
  return `
  <button class="c-card" data-idx="${idx}">
    ${isNew(c) ? `<span class="badge badge-new card-new">Nova</span>` : ""}
    ${avatarHTML(c)}
    <h3><span>${c.name}</span><span class="power" title="Classe estimada (${p})" style="color:${pl.c};border-color:${pl.c}88">${pl.t}</span></h3>
    <div class="badges">
      <span class="badge tier-${c.tier}">T${c.tier}</span>
      <span class="badge type-badge">${typePt(c.type)}</span>
      <span class="badge diet-badge">${dietPt(c.diet)}</span>
      ${ailmentBadges(c)}
    </div>
    <div class="stat-grid">
      <div><small>Vida</small><b>${fmtN(c.hp)}</b></div>
      <div><small>Dano</small><b>${fmtN(c.dmg)}</b></div>
      <div><small>Peso</small><b>${fmtN(c.weight)}</b></div>
      <div><small>Recarga</small><b>${c.cd}s</b></div>
      <div><small>Regen</small><b>${pct(c.regen)}</b></div>
      <div><small>Sopro</small><b>${c.breath ? "Sim" : "—"}</b></div>
    </div>
  </button>`;
}

// Filtros reutilizados na página de criaturas e no seletor do simulador
function filterCreatures({ q = "", tier = "", type = "", diet = "", sort = "name" }) {
  q = q.trim().toLowerCase();
  const list = CREATURES.map((c, i) => ({ c, i })).filter(({ c }) =>
    (!q || c.name.toLowerCase().includes(q)) &&
    (!tier || c.tier == tier) &&
    (!type || c.type === type) &&
    (!diet || c.diet === diet)
  );
  const by = {
    name: (a, b) => a.c.name.localeCompare(b.c.name),
    new: (a, b) => b.c.added.localeCompare(a.c.added),
    tier: (a, b) => b.c.tier - a.c.tier || a.c.name.localeCompare(b.c.name),
    hp: (a, b) => b.c.hp - a.c.hp,
    dmg: (a, b) => b.c.dmg - a.c.dmg,
    weight: (a, b) => b.c.weight - a.c.weight,
    power: (a, b) => powerScore(b.c) - powerScore(a.c),
  };
  return list.sort(by[sort] || by.name);
}

function filterToolbarHTML(prefix) {
  const types = [...new Set(CREATURES.map(c => c.type))].sort();
  const diets = [...new Set(CREATURES.map(c => c.diet))].sort();
  const tiers = [...new Set(CREATURES.map(c => c.tier))].sort();
  return `
  <div class="toolbar">
    <input class="input search" id="${prefix}q" placeholder="Buscar entre ${CREATURES.length} criaturas...">
    <select class="select" id="${prefix}tier"><option value="">Todos os tiers</option>${tiers.map(t => `<option value="${t}">Tier ${t}</option>`).join("")}</select>
    <select class="select" id="${prefix}type"><option value="">Todos os tipos</option>${types.map(t => `<option value="${t}">${typePt(t)}</option>`).join("")}</select>
    <select class="select" id="${prefix}diet"><option value="">Todas as dietas</option>${diets.map(t => `<option value="${t}">${dietPt(t)}</option>`).join("")}</select>
    <select class="select" id="${prefix}sort">
      <option value="name">Ordenar: Nome</option><option value="new">Mais recentes</option><option value="tier">Tier</option>
      <option value="power">Poder</option><option value="hp">Vida</option><option value="dmg">Dano</option><option value="weight">Peso</option>
    </select>
  </div>`;
}

// Renderiza em lotes para não travar com ~500 cards
function renderCards(grid, list, batch = 60) {
  let shown = 0;
  const more = () => {
    const slice = list.slice(shown, shown + batch);
    grid.insertAdjacentHTML("beforeend", slice.map(({ c, i }) => creatureCardHTML(c, i)).join(""));
    shown += slice.length;
    grid.querySelector(".load-more")?.remove();
    if (shown < list.length) {
      grid.insertAdjacentHTML("beforeend", `<button class="btn btn-ghost load-more">Mostrar mais (${list.length - shown})</button>`);
      grid.querySelector(".load-more").onclick = e => { e.stopPropagation(); more(); };
    }
  };
  grid.innerHTML = list.length ? "" : `<p class="empty">Nenhuma criatura encontrada.</p>`;
  if (list.length) more();
}

function bindFilters(prefix, onChange) {
  const get = id => document.getElementById(prefix + id);
  const read = () => ({ q: get("q").value, tier: get("tier").value, type: get("type").value, diet: get("diet").value, sort: get("sort").value });
  ["q", "tier", "type", "diet", "sort"].forEach(id => get(id).addEventListener("input", () => onChange(read())));
  onChange(read());
}
