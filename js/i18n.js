// Motor de tradução. Os textos ficam em js/lang/<idioma>.js (um arquivo por idioma).
// Para adicionar um idioma: copie js/lang/en.js, traduza, inclua o <script> nas páginas e registre em LANGS.

const LANGS = {
  "pt-BR": { name: "Português (Brasil)", locale: "pt-BR" },
  "pt-PT": { name: "Português (Portugal)", locale: "pt-PT" },
  "en":    { name: "English", locale: "en-US" },
  "es":    { name: "Español", locale: "es-ES" },
  "fr":    { name: "Français", locale: "fr-FR" },
  "de":    { name: "Deutsch", locale: "de-DE" },
};
const I18N = {};

function detectLang() {
  try { const saved = localStorage.getItem("sd-lang"); if (saved && LANGS[saved]) return saved; } catch (e) {}
  for (const l of navigator.languages || [navigator.language || ""]) {
    if (LANGS[l]) return l;
    const base = l.split("-")[0].toLowerCase();
    if (base === "pt") return l.toLowerCase() === "pt-pt" ? "pt-PT" : "pt-BR";
    if (LANGS[base]) return base;
  }
  return "en";
}
const LANG = detectLang();
const LOCALE = LANGS[LANG].locale;
document.documentElement.lang = LANG;

// t("chave", { var: valor }) — cai para inglês e depois português se faltar tradução
function t(key, vars) {
  let s = I18N[LANG]?.[key] ?? I18N.en?.[key] ?? I18N["pt-BR"]?.[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}
function setLang(l) {
  try { localStorage.setItem("sd-lang", l); } catch (e) {}
  location.reload();
}

// Números no formato do idioma
const NF0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const fmtN = n => NF0.format(Math.round(n));
const fmtD = (n, d = 1) => new Intl.NumberFormat(LOCALE, { maximumFractionDigits: d }).format(n);
// Francês e alemão escrevem "20 %" (com espaço fino)
const PCT_SIGN = ["fr", "de"].includes(LANG) ? " %" : "%";
// P(0.075) → "+7,5%"; P(-0.2) → "−20%"
const P = (v, sign = true) => `${sign ? (v > 0 ? "+" : v < 0 ? "−" : "") : ""}${fmtD(Math.abs(v) * 100, 1)}${PCT_SIGN}`;
const pct = v => `${fmtD(v * 100, 1)}${PCT_SIGN}`;
// "+20% peso" — efeito de atributo
const fx = (v, stat) => `${P(v)} ${t("st." + stat)}`;

// Aplica traduções em elementos com data-i18n / data-i18n-ph / data-i18n-title / data-i18n-html
function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
  const titleKey = document.querySelector("meta[name=i18n-title]")?.content;
  if (titleKey) document.title = t(titleKey);
}
// Apelido para usar onde "t" é uma variável local (ex.: o relógio da batalha em sim.js)
const tx = (key, vars) => t(key, vars);
