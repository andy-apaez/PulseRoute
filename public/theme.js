(() => {
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  const KEY = "pulseroute_theme";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const saved = localStorage.getItem(KEY);
  const initial = saved || (prefersDark.matches ? "night" : "day");

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    if (toggle) {
      toggle.textContent = theme === "night" ? "Day mode" : "Night mode";
      toggle.setAttribute("aria-pressed", theme === "night");
      toggle.setAttribute("aria-label", theme === "night" ? "Switch to day mode" : "Switch to night mode");
    }
    localStorage.setItem(KEY, theme);
  };

  setTheme(initial);

  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = root.dataset.theme === "night" ? "day" : "night";
      setTheme(next);
    });
  }

  prefersDark.addEventListener("change", (event) => {
    if (localStorage.getItem(KEY)) return;
    setTheme(event.matches ? "night" : "day");
  });
})();
