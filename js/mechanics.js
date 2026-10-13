// Tabelas de mecânicas do jogo (fonte: wiki oficial — páginas Elder, Traits, Plushies e Creature Abilities).
// Valores marcados com "≈" não são documentados na wiki e foram estimados.

// ---------- Ancião e veneração ----------
// parts: efeitos para exibir; nc = não afeta o face tank (só informativo)
const ELDER = {
  none:     { pt: "Nenhum", d: "Adulto comum, sem arquétipo.", parts: [] },
  gentle:   { pt: "Gentil", d: "Regeneração e resistência a status, sem desvantagens.", regen: 1.15, block: 0.10,
              parts: [{ t: "+15% regen", good: true }, { t: "+10% bloqueio de status", good: true }, { t: "+10% estamina", good: true, nc: true }] },
  powerful: { pt: "Poderoso", d: "Força bruta e peso, mas recupera e age mais devagar.", weight: 1.2, dmg: 1.15, regen: 0.8, cd: 1.05,
              parts: [{ t: "+20% peso", good: true }, { t: "+15% dano", good: true }, { t: "−20% regen", good: false }, { t: "+5% recarga", good: false },
                      { t: "−20% estamina", good: false, nc: true }, { t: "−5% velocidade", good: false, nc: true }] },
  devious:  { pt: "Ardiloso", d: "Agilidade e fôlego, sacrificando poder.", weight: 0.8, dmg: 0.85, cd: 0.925,
              parts: [{ t: "−7,5% recarga", good: true }, { t: "−20% peso", good: false }, { t: "−15% dano", good: false },
                      { t: "+7,5% velocidade", good: true, nc: true }, { t: "+25% regen estamina", good: true, nc: true }] },
};
const VEN_STAGES = ["Sem veneração", "Elder", "Sage", "Master", "Venerated", "Ancient"];
// No estágio V: +200 vida e +80 peso por tier (≈ distribuído igualmente pelos 5 estágios)
const venBonus = (tier, stage) => ({ hp: 40 * tier * stage, weight: 16 * tier * stage });

// ---------- Traits (base + por ascensão) ----------
const TRAITS = {
  "":       { pt: "Nenhum" },
  bite:     { pt: "Mordida",            unit: "recarga",        sign: -1, base: 0.10,  asc: 0.01,  combat: true },
  damage:   { pt: "Dano",               unit: "dano",           base: 0.05,  asc: 0.02,  combat: true },
  health:   { pt: "Vida",               unit: "regen de vida",  base: 0.125, asc: 0.04,  combat: true },
  weight:   { pt: "Peso",               unit: "peso",           base: 0.05,  asc: 0.02,  combat: true },
  speed:    { pt: "Velocidade",         unit: "velocidade",     base: 0.035, asc: 0.015 },
  stamina:  { pt: "Estamina máx.",      unit: "estamina máx.",  base: 0.15,  asc: 0.025 },
  stamregen:{ pt: "Regen. de estamina", unit: "regen de estamina", base: 0.20, asc: 0.035 },
  healing:  { pt: "Cura",               unit: "cura (Healing Hunter)", base: 0.05, asc: 0.02 },
};
const traitValue = (type, level) => TRAITS[type]?.base ? TRAITS[type].base + TRAITS[type].asc * level : 0;

// ---------- Pelúcias com efeito em combate ----------
// mult: multiplicadores de atributo; add: soma em passivas (ataques/defensivos/bloqueios); flags extras.
// stack:false = não pode equipar duas iguais.
const PLUSHIES = {
  "": { pt: "Nenhuma" },
  "Magichorn Prongbug": { d: "+10% regen", mult: { regen: 1.10 } },
  "Heart":          { d: "+30% regen, −5% peso", mult: { regen: 1.30, weight: 0.95 } },
  "Rod":            { nc: ["Pulo duplo"], d: "+10% regen", mult: { regen: 1.10 }, stack: false },
  "Ice Wolf":       { d: "+5% dano", mult: { dmg: 1.05 } },
  "Void":           { nc: ["−2,5% velocidade de movimento"], d: "+7,5% dano", mult: { dmg: 1.075 } },
  "Mo":             { nc: ["Pulo duplo"], d: "+2,5% dano", mult: { dmg: 1.025 }, stack: false },
  "Eclipse":        { nc: ["+25% regen de estamina à noite"], d: "À noite: +5% dano, +15% regen", night: { dmg: 1.05, regen: 1.15 } },
  "Coal":           { d: "+3,5% peso", mult: { weight: 1.035 } },
  "Cow":            { d: "+10% peso, −5% dano", mult: { weight: 1.10, dmg: 0.95 } },
  "Hum":            { nc: ["Pulo duplo"], d: "+2,5% peso", mult: { weight: 1.025 }, stack: false },
  "Chick":          { nc: ["+5% velocidade de movimento"], d: "−7,5% peso", mult: { weight: 0.925 } },
  "Sky":            { nc: ["+2 velocidade de voo"], d: "−10% peso", mult: { weight: 0.90 } },
  "Serpent":        { nc: ["+1 giro"], d: "−10% dano", mult: { dmg: 0.90 }, stack: false },
  "Knight":         { d: "25% de chance de refletir 20% do dano recebido; −5% dano", mult: { dmg: 0.95 }, knight: true, stack: false },
  "Cat":            { d: "+1 Bleed Attack, −2,5% dano", add: { "Bleed Attack": 1 }, mult: { dmg: 0.975 }, stubborn: { mult: { regen: 1.10 }, add: { "Block Bleed": 0.05 } } },
  "Pig-Lantern":    { d: "+0,5 Burn Attack, −2,5% dano", add: { "Burn Attack": 0.5 }, mult: { dmg: 0.975 }, stubborn: { mult: { dmg: 1.05 }, add: { "Block Burn": 0.05 } } },
  "Haunt Dragon":   { d: "+0,5 Poison Attack", add: { "Poison Attack": 0.5 }, stubborn: { add: { "Block Poison": 0.05 } } },
  "Tannenbaum":     { d: "+0,5 Frostbite Attack, +5% recarga", add: { "Frostbite Attack": 0.5 }, mult: { cd: 1.05 }, stack: false, stubborn: { mult: { cd: 0.95 }, add: { "Block Frostbite": 0.05 } } },
  "Heartsnake":     { d: "+0,75 Defensive Poison", add: { "Defensive Poison": 0.75 } },
  "Vampire Bat":    { d: "+1 Defensive Bleed, −2,5% dano", add: { "Defensive Bleed": 1 }, mult: { dmg: 0.975 } },
  "Jammy Slug":     { d: "+0,5 Defensive Necropoison, −5% dano", add: { "Defensive Necropoison": 0.5 }, mult: { dmg: 0.95 } },
  "Ember Spirit":   { d: "+0,5 Defensive Burn, −7,5% Block Frostbite", add: { "Defensive Burn": 0.5, "Block Frostbite": -0.075 } },
  "Ginger Snapper": { d: "+0,5 Defensive Frostbite, −5% Block Burn", add: { "Defensive Frostbite": 0.5, "Block Burn": -0.05 }, stack: false },
  "Ghost":          { d: "+7,5% Block Bleed", add: { "Block Bleed": 0.075 } },
  "Frost Dragon":   { nc: ["−5% fome e sede"], d: "+25% Block Frostbite", add: { "Block Frostbite": 0.25 } },
  "Sparkler":       { d: "+15% Block Poison/Frostbite/Burn, −20% Block Bleed", add: { "Block Poison": 0.15, "Block Frostbite": 0.15, "Block Burn": 0.15, "Block Bleed": -0.20 }, stack: false },
  "Maple Leaflet":  { nc: ["Ferimento só reduz velocidade"], d: "+22,5% Block Injury", add: { "Block Injury": 0.225 } },
  "Astral Quetzal": { nc: ["−5% velocidade de movimento"], d: "50% resistência a sopro e sangramento, −25% regen", add: { "Breath Resistance": 0.5, "Block Bleed": 0.5 }, mult: { regen: 0.75 }, stack: false },
  "Pie Chomper":    { d: "Ganha Serrated Teeth, −25% regen", add: { "Serrated Teeth": true }, mult: { regen: 0.75 }, stack: false },
  "Minty Wiggler":  { nc: ["Inverno/Fome: +25% regen de estamina, −25% fome e sede"], d: "Ganha Frosty (+25% regen no Inverno/Fome, imune a hipotermia)", add: { "Frosty": true }, stack: false },
  "Springbok":      { nc: ["Corre sem gastar estamina (Will To Live)"], d: "Ganha Will To Live (sem efeito na luta)", stack: false },
  "Arcane":         { nc: ["Exige criatura com sopro"], d: "+12,5% dano de sopro", breathDmg: 1.125, stack: false },
  "Baby Dragon":    { d: "+20% velocidade de recarga do sopro", breathRegen: 1.2, stack: false },
  "Bear":           { d: "Melhora Agressivo/Acuado: ×1,1 e +10 pontos", bear: true, stack: false },
  "Oceanwing":      { d: "Efeito do Lamacento ×1,5", mud: 1.5 },
};

// ---------- Estações (wiki: Environment) ----------
const SEASONS = {
  summer: { pt: "Verão" }, fall: { pt: "Outono" }, winter: { pt: "Inverno", d: "Frostbite: +8% recarga de mordida; Frosty +25% regen" },
  spring: { pt: "Primavera" }, famine: { pt: "Fome", d: "Frosty +25% regen; Volcanic +50% regen" }, sakura: { pt: "Sakura" },
  drought: { pt: "Seca", d: "Volcanic +50% regen" }, mythic: { pt: "Mítica" },
};

// Categorias para o seletor de pelúcias
const PLUSH_CATS = {
  dmg:    { pt: "Dano",            list: ["Ice Wolf", "Void", "Mo", "Eclipse", "Serpent"] },
  weight: { pt: "Peso",            list: ["Coal", "Cow", "Hum", "Chick", "Sky"] },
  regen:  { pt: "Regeneração",     list: ["Magichorn Prongbug", "Heart", "Rod", "Oceanwing"] },
  atk:    { pt: "Status ao morder",list: ["Cat", "Pig-Lantern", "Haunt Dragon", "Tannenbaum", "Pie Chomper"] },
  def:    { pt: "Status defensivo",list: ["Heartsnake", "Vampire Bat", "Jammy Slug", "Ember Spirit", "Ginger Snapper", "Knight"] },
  block:  { pt: "Bloqueios",       list: ["Ghost", "Frost Dragon", "Sparkler", "Maple Leaflet", "Astral Quetzal"] },
  breath: { pt: "Sopro",           list: ["Arcane", "Baby Dragon"] },
  other:  { pt: "Especiais",       list: ["Bear", "Minty Wiggler", "Springbok"] },
};
const plushCat = name => Object.keys(PLUSH_CATS).find(k => PLUSH_CATS[k].list.includes(name)) || "other";

// ---------- Buffs de status (ligados manualmente) ----------
const BUFFS = {
  aggressive: { pt: "Agressivo", how: "Pose de agressão por 10s", parts: [{ t: "+25% dano", good: true }, { t: "−50% regen de estamina", good: false, nc: true }] },
  scared:     { pt: "Acuado", how: "Pose de acuado por 10s", parts: [{ t: "−50% dano", good: false }, { t: "+25% velocidade", good: true, nc: true }] },
  cleanWater: { pt: "Água Limpa", how: "Beber água acima de 90%", parts: [{ t: "+20% regen", good: true }, { t: "+20% regen de estamina", good: true, nc: true }, { t: "−20% fome e sede", good: true, nc: true }] },
  muddy:      { pt: "Lamacento", how: "Rolar na lama", parts: [{ t: "+25% regen", good: true }, { t: "cura veneno e sangramento 2× mais rápido", good: true }, { t: "esconde o cheiro", good: true, nc: true }] },
  packHealer: { pt: "Pack Healer por perto", how: "Criatura com Pack Healer a até 150 studs", parts: [{ t: "+25% regen", good: true }] },
  newborn:    { pt: "Recém-mãe", how: "Após chocar um ovo", parts: [{ t: "+50% regen", good: true }, { t: "−25% fome e sede", good: true, nc: true }] },
  sin:        { pt: "Strength In Numbers", how: "Membros da mesma espécie por perto", needs: "Strength In Numbers", stacks: 4,
                parts: [{ t: "+5% vida, dano e peso por membro", good: true }, { t: "+0,5 sangramento / +0,25 veneno ao morder por membro", good: true }] },
  defensive:  { pt: "Defensivo", how: "Perto do próprio ninho (Broodwatcher)", needs: "Broodwatcher", stacks: 5, parts: [{ t: "+10% peso por stack", good: true }] },
};

// ---------- Habilidades ativas simuladas ----------
// def: ligada por padrão; when: como a IA usa.
const ACTIVES = {
  "Harden":         { d: "+35% peso, +25% regen por 30s (recarga 120s)", def: true },
  "Unbridled Rage": { d: "+30% dano por 30s (recarga 120s)", def: true },
  "Adrenaline":     { d: "+20% dano por 30s (recarga 90s)", def: true },
  "Hunters Curse":  { d: "Gasta metade da vida máx.: +100% dano por 30s (recarga 120s)", def: false },
  "Life Leech":     { d: "Cura X% do dano da mordida por 12s (recarga 60s)", def: true },
  "Spite":          { d: "Próxima mordida (após 5s) +X% de dano e status em dobro (recarga 20s)", def: true },
  "Shadow Barrage": { d: "Repete a última mordida N vezes (90%, 81%…) com status (recarga 30s)", def: true },
  "Warden's Rage":  { d: "Dano ×até 8,5 conforme perde vida; sem regen", def: true },
  "Two-Faced":      { d: "Forma: Tranquilidade (+60% dano e recarga) ou Loucura (−37,5%)", def: true },
  "Reflect":        { d: "Reflete as mordidas recebidas por 6s (recarga 45s)", def: true },
  "Fortify":        { d: "Limpa status negativos, imune a status e +5% peso por 9s (recarga 90s)", def: true },
  "Cocoon":         { d: "Abaixo de 40% vida: invulnerável ≈6s, cura 30%, depois +15% dano por 20s (recarga 120s)", def: true },
  "Healing Pulse":  { d: "+7% vida máx. por tick de vida por 30s (recarga 90s)", def: true },
  "Expunge":        { d: "Limpa o sangramento do alvo: +5% dano por stack, cura metade (recarga 45s)", def: true },
  "Divination":     { d: "Canaliza 15s; 3 cargas: +50 dano e 2 queimaduras (recarga ≈60s)", def: true },
  "Lich Mark":      { d: "Marca o alvo; a mordida seguinte aplica 5 stacks do status (recarga 30s)", def: true },
  "Poison Area":    { d: "5 stacks de veneno no alvo (recarga 15s)", def: true },
  "Frost Nova":     { d: "3 stacks de congelamento a cada 3s por 15s (recarga 60s)", def: true },
  "Aura":           { d: "3 stacks do status a cada 3s (contínuo)", def: true },
  "Totem":          { d: "2 stacks do status a cada 3s por 2 min", def: true },
  "Cause Fear":     { d: "Medo no alvo: −45% dano por 30s (recarga 120s)", def: true },
  "Drowsy Area":    { d: "5 stacks de sonolência no alvo (recarga 60s)", def: true },
};
const activeName = a => a.replace(/\s*\(.*\)$/, "");
const activeArg = a => (/\((.*)\)$/.exec(a) || [])[1];

// ---------- Cartões das habilidades ativas ----------
// cd = recarga (s); parts(arg) = efeitos exibidos; how = quando o simulador usa
const pctArg = a => `${String(+(+a * 100).toFixed(1)).replace(".", ",")}%`;
const ACTIVE_CARDS = {
  "Harden":         { cd: 120, how: "Usa no início", parts: () => [{ t: "+35% peso", good: true }, { t: "+25% regen", good: true }, { t: "30s", good: null }, { t: "−20% velocidade", good: false, nc: true }] },
  "Unbridled Rage": { cd: 120, how: "Usa no início", parts: () => [{ t: "+30% dano", good: true }, { t: "30s", good: null }, { t: "gasta metade da estamina", good: false, nc: true }] },
  "Adrenaline":     { cd: 90,  how: "Usa no início", parts: () => [{ t: "+20% dano", good: true }, { t: "30s", good: null }, { t: "+20% velocidade", good: true, nc: true }] },
  "Hunters Curse":  { cd: 120, how: "Usa no início (se tiver mais de 50% de vida)", parts: () => [{ t: "+100% dano", good: true }, { t: "30s", good: null }, { t: "perde 50% da vida máx.", good: false }] },
  "Life Leech":     { cd: 60,  how: "Usa quando já tomou dano", parts: a => [{ t: `cura ${pctArg(a)} do dano da mordida`, good: true }, { t: "12s", good: null }] },
  "Spite":          { cd: 20,  how: "Carrega 5s e solta na próxima mordida", parts: a => [{ t: `+${pctArg(a)} do dano na mordida`, good: true }, { t: "status em dobro", good: true }] },
  "Shadow Barrage": { cd: 30,  how: "Usa depois da primeira mordida", parts: a => [{ t: `repete a mordida ${a}×`, good: true }, { t: "90%, 81%, 73%…", good: null }, { t: "aplica os status", good: true }] },
  "Warden's Rage":  { cd: 30,  how: "Fica ligada a luta toda", parts: () => [{ t: "dano até ×8,5 abaixo de 50% de vida", good: true }, { t: "sem regeneração", good: false }] },
  "Two-Faced":      { cd: 15,  how: "Fica na forma escolhida", parts: () => [{ t: "Tranquilidade: +60% dano e +60% recarga", good: null }, { t: "Loucura: −37,5% dano e recarga", good: null }] },
  "Reflect":        { cd: 45,  how: "Usa assim que possível", parts: () => [{ t: "reflete as mordidas recebidas", good: true }, { t: "6s", good: null }] },
  "Fortify":        { cd: 90,  how: "Usa quando acumula 5 stacks de status", parts: () => [{ t: "limpa status negativos", good: true }, { t: "imune a status 9s", good: true }, { t: "+5% peso", good: true }] },
  "Cocoon":         { cd: 120, how: "Usa abaixo de 40% de vida", parts: () => [{ t: "invulnerável ≈6s", good: true }, { t: "cura 30% da vida", good: true }, { t: "+15% dano por 20s depois", good: true }, { t: "não morde no casulo", good: false }] },
  "Healing Pulse":  { cd: 90,  how: "Usa abaixo de 90% de vida", parts: () => [{ t: "+7% vida máx. por tick de vida", good: true }, { t: "30s", good: null }, { t: "cura mesmo sangrando", good: true }] },
  "Expunge":        { cd: 45,  how: "Usa quando o alvo tem 5+ de sangramento", parts: () => [{ t: "limpa o sangramento do alvo", good: null }, { t: "+5% dano por stack limpo", good: true }, { t: "cura metade do bônus", good: true }] },
  "Divination":     { cd: 60,  how: "Canaliza no início", parts: () => [{ t: "canaliza 15s", good: null }, { t: "3 cargas: +50 dano e 2 queimaduras", good: true }, { t: "recarga ≈", good: null }] },
  "Lich Mark":      { cd: 30,  how: "Marca numa mordida e ativa na seguinte", parts: a => [{ t: `5 stacks de ${a}`, good: true }] },
  "Poison Area":    { cd: 15,  how: "Usa sempre que recarrega", parts: () => [{ t: "5 stacks de veneno no alvo", good: true }] },
  "Frost Nova":     { cd: 60,  how: "Usa sempre que recarrega", parts: () => [{ t: "3 congelamento a cada 3s", good: true }, { t: "15s", good: null }] },
  "Aura":           { cd: 0,   how: "Fica ligada a luta toda", parts: a => [{ t: `3 stacks de ${a} a cada 3s`, good: true }] },
  "Totem":          { cd: 120, how: "Coloca no início", parts: a => [{ t: `2 stacks de ${a} a cada 3s`, good: true }, { t: "2 min", good: null }] },
  "Cause Fear":     { cd: 120, how: "Usa no início", parts: () => [{ t: "alvo com −45% de dano", good: true }, { t: "30s", good: null }] },
  "Drowsy Area":    { cd: 60,  how: "Usa sempre que recarrega", parts: () => [{ t: "5 sonolência no alvo", good: true }, { t: "+25% recarga e −2,5% dano por stack", good: true }, { t: "10 stacks = dorme", good: true }] },
};
// Ativas que não mudam um face tank (as duas criaturas paradas mordendo)
const NONCOMBAT_ACTIVES = {
  "Grab": "Agarra criaturas de tier menor e pelo menos 20% mais leves; o alvo escapa quase na hora.",
  "Latch": "Gruda em criaturas de tier maior por 5s; serve para perseguir, não muda o dano.",
  "Burrower": "Cava tocas para se esconder.",
  "Invisibility": "Fica invisível; numa luta parada não muda nada.",
  "Vanish": "Some de vista por alguns segundos.",
  "Egg Stealer": "Rouba ovos de ninhos.",
  "Dazzling Flash": "Cega e confunde quem está perto (controle, sem dano).",
  "Mud Pile": "Cria lama que dá o buff Lamacento — ligue o buff se for usar.",
  "Speed Blitz": "Aumenta a velocidade por 18s.",
  "Thorn Trap": "Armadilha de espinhos no chão.",
  "Heal Aura": "Cura os outros por perto, não a si mesmo.",
  "Yolk Bomb": "Arremessa e empurra, aplicando efeitos de visão.",
  "Cursed Sigil": "Bad Omen: ao sumir, aplica um status aleatório.",
  "Escape Area": "+75% velocidade e −50% dano para fugir.",
  "Area Food Restore": "Recupera fome de quem está perto.",
  "Area Water Restore": "Recupera sede de quem está perto.",
  "Shock Area": "Choque, pernas quebradas e voo mais lento por 30s.",
  "Change Weather": "Muda o clima — escolha o clima na barra de condições.",
  "Gale": "−20% de velocidade em quem está perto.",
  "Stamina Puddle": "Poça que recupera estamina.",
  "Speed Steal": "Rouba velocidade do alvo.",
  "Sticky Trap": "Armadilha que prende.",
  "Earthquake": "Deixa todos mais lentos e dá Aftershock (−20% dano) em si mesmo.",
  "Frost Snare": "Armadilha de gelo que prende.",
  "Tail Drop": "Solta a cauda para fugir.",
  "Toxic Trap": "Poça tóxica no chão (o alvo precisaria ficar em cima).",
  "Area Wind Blast": "Empurra quem está perto.",
  "Ink Cloud": "Nuvem de tinta que tapa a visão.",
  "Snow Shield": "Cúpula de proteção que quebra com mordidas.",
};
