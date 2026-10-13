// Utilitários de exibição. Os dados das criaturas ficam em js/creatures-data.js
// (gerado por scripts/atualizar_dados.py a partir da wiki oficial).

const TYPE_ICON = { "Terrestrial": "🦶", "Flier": "🪽", "Aquatic": "🌊", "Semi-Aquatic": "💧", "Glider": "🪁" };
const DIET_ICON = { "Carnivore": "🥩", "Herbivore": "🌿", "Omnivore": "🍽️", "Photocarnivore": "☀️", "Photovore": "🌞" };

// Status negativos que importam numa luta parada
const AILMENTS = {
  bleed:      { pt: t("ail.bleed"),      key: "Bleed" },
  poison:     { pt: t("ail.poison"),     key: "Poison" },
  burn:       { pt: t("ail.burn"),       key: "Burn" },
  frostbite:  { pt: t("ail.frostbite"),  key: "Frostbite" },
  corrosion:  { pt: t("ail.corrosion"),  key: "Corrosion" },
  radiation:  { pt: t("ail.radiation"),  key: "Radiation" },
  disease:    { pt: t("ail.disease"),    key: "Disease" },
  necropoison:{ pt: t("ail.necropoison"),key: "Necropoison" },
};

const typePt = x => t("type." + x);
const dietPt = d => t("diet." + d);

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
    ? `<img class="av-img" src="${c.img}" alt="${c.name}" loading="lazy" onerror="this.remove()">`
    : "";
  return `<div class="avatar" style="background:radial-gradient(circle at 50% 65%,hsl(${h} 28% 30%),hsl(${(h + 30) % 360} 25% 13%));${style}">
    <span class="av-initials">${initials}</span>${img}</div>`;
}

function ailmentBadges(c) {
  const out = attackAilments(c).map(a => `<span class="badge fx" title="${t("card.onBite", { s: AILMENTS[a.type].pt })}">${AILMENTS[a.type].pt} ${fmtD(a.stacks, 2)}</span>`);
  if (c.breath) out.push(`<span class="badge fx" title="${c.breath}">${t("card.breath")}</span>`);
  if (c.passives["First Strike"]) out.push(`<span class="badge fx">First Strike</span>`);
  return out.join("");
}

function creatureCardHTML(c, idx) {
  const p = powerScore(c), pl = powerLabel(p);
  return `
  <button class="c-card" data-idx="${idx}">
    ${isNew(c) ? `<span class="badge badge-new card-new">${t("card.new")}</span>` : ""}
    ${avatarHTML(c)}
    <h3><span>${c.name}</span><span class="power" title="${t("card.class", { n: p })}" style="color:${pl.c};border-color:${pl.c}88">${pl.t}</span></h3>
    <div class="badges">
      <span class="badge tier-${c.tier}">T${c.tier}</span>
      <span class="badge type-badge">${typePt(c.type)}</span>
      <span class="badge diet-badge">${dietPt(c.diet)}</span>
      ${ailmentBadges(c)}
    </div>
    <div class="stat-grid">
      <div><small>${t("lbl.hp")}</small><b>${fmtN(c.hp)}</b></div>
      <div><small>${t("lbl.dmg")}</small><b>${fmtN(c.dmg)}</b></div>
      <div><small>${t("lbl.weight")}</small><b>${fmtN(c.weight)}</b></div>
      <div><small>${t("lbl.cd")}</small><b>${fmtD(c.cd, 2)}s</b></div>
      <div><small>${t("lbl.regen")}</small><b>${pct(c.regen)}</b></div>
      <div><small>${t("lbl.breath")}</small><b>${c.breath ? t("yes") : "—"}</b></div>
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
    name: (a, b) => a.c.name.localeCompare(b.c.name, LOCALE),
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
    <input class="input search" id="${prefix}q" placeholder="${t("filter.search", { n: CREATURES.length })}">
    <select class="select" id="${prefix}tier"><option value="">${t("filter.allTiers")}</option>${tiers.map(x => `<option value="${x}">Tier ${x}</option>`).join("")}</select>
    <select class="select" id="${prefix}type"><option value="">${t("filter.allTypes")}</option>${types.map(x => `<option value="${x}">${typePt(x)}</option>`).join("")}</select>
    <select class="select" id="${prefix}diet"><option value="">${t("filter.allDiets")}</option>${diets.map(x => `<option value="${x}">${dietPt(x)}</option>`).join("")}</select>
    <select class="select" id="${prefix}sort">
      <option value="name">${t("sort.name")}</option><option value="new">${t("sort.new")}</option><option value="tier">Tier</option>
      <option value="power">${t("sort.power")}</option><option value="hp">${t("lbl.hp")}</option><option value="dmg">${t("lbl.dmg")}</option><option value="weight">${t("lbl.weight")}</option>
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
      grid.insertAdjacentHTML("beforeend", `<button class="btn btn-ghost load-more">${t("list.more", { n: list.length - shown })}</button>`);
      grid.querySelector(".load-more").onclick = e => { e.stopPropagation(); more(); };
    }
  };
  grid.innerHTML = list.length ? "" : `<p class="empty">${t("list.empty")}</p>`;
  if (list.length) more();
}

function bindFilters(prefix, onChange) {
  const get = id => document.getElementById(prefix + id);
  const read = () => ({ q: get("q").value, tier: get("tier").value, type: get("type").value, diet: get("diet").value, sort: get("sort").value });
  ["q", "tier", "type", "diet", "sort"].forEach(id => get(id).addEventListener("input", () => onChange(read())));
  onChange(read());
}
