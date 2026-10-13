// Cabeçalho, rodapé e tema claro/escuro compartilhados por todas as páginas
(function () {
  const page = document.body.dataset.page;
  const link = (href, key, label) => `<a href="${href}" class="${page === key ? "active" : ""}">${label}</a>`;
  const getTheme = () => document.documentElement.dataset.theme || "dark";

  document.body.insertAdjacentHTML("afterbegin", `
    <nav class="nav">
      <div class="container nav-inner">
        <a href="index.html" class="brand"><span class="brand-mark">S</span><span class="brand-name">Sonaria <em>Duelos</em></span></a>
        <button class="nav-toggle" aria-label="Menu">☰</button>
        <div class="nav-links">
          ${link("index.html", "home", "Início")}
          ${link("simulator.html", "sim", "Simulador")}
          ${link("creatures.html", "creatures", "Bestiário")}
          <button class="theme-btn" title="Alternar tema claro/escuro"></button>
        </div>
      </div>
    </nav>`);

  document.body.insertAdjacentHTML("beforeend", `
    <footer>
      <div class="container">
        <span><b class="serif">Sonaria Duelos</b> — projeto de fã, sem afiliação com Creatures of Sonaria.</span>
        <span>Atributos e imagens: <a href="https://creatures-of-sonaria-official.fandom.com/wiki/Creature_Stats_List" target="_blank" rel="noopener">wiki oficial</a> (CC BY-SA)</span>
      </div>
    </footer>`);

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
})();
