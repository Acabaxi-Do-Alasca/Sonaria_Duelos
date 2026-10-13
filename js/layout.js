// Cabeçalho, rodapé, tema claro/escuro e seletor de idioma compartilhados por todas as páginas
(function () {
  const page = document.body.dataset.page;
  const link = (href, key, label) => `<a href="${href}" class="${page === key ? "active" : ""}">${label}</a>`;
  const getTheme = () => document.documentElement.dataset.theme || "dark";

  document.body.insertAdjacentHTML("afterbegin", `
    <nav class="nav">
      <div class="container nav-inner">
        <a href="index.html" class="brand"><span class="brand-mark">S</span><span class="brand-name">Sonaria <em>${t("brand.duels")}</em></span></a>
        <button class="nav-toggle" aria-label="Menu">☰</button>
        <div class="nav-links">
          ${link("index.html", "home", t("nav.home"))}
          ${link("simulator.html", "sim", t("nav.sim"))}
          ${link("creatures.html", "creatures", t("nav.bestiary"))}
          <select class="lang-sel" aria-label="${t("nav.language")}" title="${t("nav.language")}">
            ${Object.entries(LANGS).map(([k, l]) => `<option value="${k}" ${k === LANG ? "selected" : ""}>${l.name}</option>`).join("")}
          </select>
          <button class="theme-btn" title="${t("nav.theme")}"></button>
        </div>
      </div>
    </nav>`);

  document.body.insertAdjacentHTML("beforeend", `
    <footer>
      <div class="container">
        <span><b class="serif">Sonaria ${t("brand.duels")}</b> — ${t("footer.fan")}</span>
        <span>${t("footer.credits")} <a href="https://creatures-of-sonaria-official.fandom.com/wiki/Creature_Stats_List" target="_blank" rel="noopener">${t("footer.wiki")}</a> (CC BY-SA)</span>
      </div>
    </footer>`);

  document.querySelector(".lang-sel").addEventListener("change", e => setLang(e.target.value));

  const themeBtn = document.querySelector(".theme-btn");
  const paint = () => { themeBtn.textContent = getTheme() === "dark" ? "☀️" : "🌙"; };
  themeBtn.addEventListener("click", () => {
    const next = getTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("sd-theme", next); } catch (e) {}
    paint();
    document.dispatchEvent(new CustomEvent("themechange"));
  });
  paint();
  document.querySelector(".nav-toggle").addEventListener("click", () => document.querySelector(".nav-links").classList.toggle("open"));

  applyI18n();
})();
