import { createRouter } from "./router.js";
import { renderLayout, resolveMainHtml } from "./views.js";
import { initHeroCarousel } from "./hero-carousel.js";

let siteData = null;

async function loadData() {
  if (siteData) return siteData;
  const res = await fetch(`${import.meta.env.BASE_URL}data/site-content.json`);
  if (!res.ok) throw new Error("Failed to load site content");
  siteData = await res.json();
  return siteData;
}

function bindInteractions(root, navigate) {
  root.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (event) => {
      const path = el.getAttribute("data-nav");
      if (!path) return;
      event.preventDefault();
      navigate(path);
    });
  });

  const header = root.querySelector(".site-header");
  const toggle = root.querySelector(".nav-toggle");
  const nav = root.querySelector("#site-nav");
  toggle?.addEventListener("click", () => {
    const open = header?.classList.toggle("site-header--nav-open");
    nav?.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  root.querySelectorAll("[data-contact-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const note = form.querySelector("[data-form-success]");
      if (note) {
        note.hidden = false;
        form.reset();
      }
    });
  });

  initHeroCarousel(root);
}

async function renderRoute(path) {
  const data = await loadData();
  const app = document.getElementById("app");
  const { html, title } = resolveMainHtml(data, path);
  app.innerHTML = renderLayout({
    site: data.site,
    navigation: data.navigation,
    mainHtml: html,
    title,
  });
  bindInteractions(app, router.navigate);
  highlightActiveNav(app, path);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function highlightActiveNav(root, path) {
  const normalized = path === "/" ? "/" : path.replace(/\/$/, "");
  root.querySelectorAll("[data-nav]").forEach((el) => {
    const target = el.getAttribute("data-nav");
    const isActive =
      target === normalized ||
      (normalized !== "/" && target !== "/" && normalized.startsWith(target));
    el.classList.toggle("is-active", Boolean(isActive));
  });
}

const router = createRouter({ onRoute: renderRoute });

renderRoute("/").catch((error) => {
  console.error(error);
  document.getElementById("app").innerHTML =
    "<p style='padding:2rem;font-family:sans-serif'>שגיאה בטעינת האתר. הריצו npm run import:content ואז npm run dev.</p>";
});

export { router };
