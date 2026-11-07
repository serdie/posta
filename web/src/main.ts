import { safeGet, safeSet } from "./storage";

const THEME_KEY = "posta.theme";

function applyTheme(theme: string | null): void {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function currentTheme(): "light" | "dark" {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initChrome(): void {
  applyTheme(safeGet(THEME_KEY));
  document.querySelector<HTMLButtonElement>(".theme-toggle")?.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    safeSet(THEME_KEY, next);
  });

  const menu = document.querySelector<HTMLButtonElement>(".menu-toggle");
  const nav = document.getElementById("nav");
  menu?.addEventListener("click", () => {
    const open = nav?.classList.toggle("open") ?? false;
    menu.setAttribute("aria-expanded", String(open));
  });
}

let toastTimer: number | undefined;
export function toast(message: string): void {
  const el = document.querySelector<HTMLElement>(".toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 3200);
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* Sin service worker la web sigue funcionando, solo que no sin conexión. */
    });
  });
}

initChrome();
registerServiceWorker();

if (document.querySelector("[data-sim]")) {
  void import("./sim/view").then((m) => m.mountSimulator(document.querySelector<HTMLElement>("[data-sim]")!));
}
if (document.querySelector("[data-plan]")) {
  void import("./plan/ui").then((m) => m.mountPlan(document.querySelector<HTMLElement>("[data-plan]")!));
}
