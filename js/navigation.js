import { supabase } from "./supabaseClient.js";

const page = location.pathname.split("/").pop() || "index.html";
const routes = [
  { href: "dashboard.html", label: "Visão geral", icon: "dashboard", pages: ["dashboard.html"], admin: true },
  { href: "atendimento.html", label: "Atendimento", icon: "service", pages: ["atendimento.html"] },
  { href: "comandas.html", label: "Comandas", icon: "orders", pages: ["comandas.html"], admin: true },
  { href: "cardapio.html", label: "Gestão do cardápio", icon: "menu", pages: ["cardapio.html"], admin: true },
  { href: "reports.html", label: "Relatórios", icon: "reports", pages: ["reports.html"], admin: true }
];

const navIcons = {
  dashboard: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
  service: '<path d="M3 7h18l-1.5 13h-15L3 7Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/><path d="M9 13h6"/>',
  orders: '<path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 3v5h5M9 13h6M9 17h6"/>',
  menu: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="7" cy="5" r="1"/><circle cx="7" cy="12" r="1"/><circle cx="7" cy="19" r="1"/>',
  reports: '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M16 6h4v4"/>'
};

function iconSvg(name) {
  const paths = navIcons[name] || navIcons.dashboard;
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${paths}</svg>`;
}

async function getRole() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).maybeSingle();
    return data || null;
  } catch (_) { return null; }
}

function buildShell(role) {
  if (page === "index.html") return;
  const body = document.body;
  if (body.dataset.shellReady === "true") return;
  body.dataset.shellReady = "true";

  const isAdmin = role?.role === "admin";
  const visibleRoutes = routes.filter(route => !route.admin || isAdmin);
  // The brand always returns to an authenticated operational page, never to the login screen.
  const homeHref = isAdmin ? "dashboard.html" : "atendimento.html";
  const firstName = (role?.full_name || "VT").trim().slice(0, 1).toLocaleUpperCase("pt-BR");

  const shell = document.createElement("div");
  shell.className = "app-layout";
  shell.innerHTML = `
    <button class="sidebar-backdrop" id="sidebarBackdrop" type="button" aria-label="Fechar menu" tabindex="-1"></button>
    <aside class="app-sidebar sidebar" id="appSidebar" aria-label="Navegação principal">
      <a class="sidebar-brand logo-container" href="${homeHref}" aria-label="Varanda do Tempo - ${isAdmin ? "visão geral" : "atendimento"}">
        <img class="brand-logo-image" src="assets/logo-varanda-do-tempo.webp" alt="">
        <span class="sidebar-brand-copy"><strong>Varanda do Tempo</strong><small>Gestão do restaurante</small></span>
      </a>
      <div class="sidebar-section-label">MENU PRINCIPAL</div>
      <nav class="sidebar-nav nav-links" aria-label="Menu principal">
        ${visibleRoutes.map(route => `
          <a class="sidebar-link nav-item ${route.pages.includes(page) ? "active" : ""}" href="${route.href}" ${route.pages.includes(page) ? 'aria-current="page"' : ""}>
            <span class="sidebar-icon">${iconSvg(route.icon)}</span><span>${route.label}</span>
          </a>`).join("")}
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-user">
          <span class="sidebar-avatar" aria-hidden="true">${escapeHtml(firstName)}</span>
          <span><strong>${escapeHtml(role?.full_name || "Equipe")}</strong><small>${isAdmin ? "Administrador" : "Atendimento"}</small></span>
        </div>
        <button class="sidebar-logout" id="sidebarLogout" type="button"><span aria-hidden="true">↪</span> Sair do sistema</button>
      </div>
    </aside>
    <div class="app-main" id="appMain">
      <header class="app-mobilebar">
        <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="appSidebar"><span></span><span></span><span></span></button>
        <a href="${homeHref}" class="mobile-brand" aria-label="Ir para ${isAdmin ? "visão geral" : "atendimento"}"><img class="brand-logo-image" src="assets/logo-varanda-do-tempo.webp" alt=""><strong>Varanda do Tempo</strong></a>
        <span class="mobile-role">${isAdmin ? "Administração" : "Equipe"}</span>
      </header>
      <div class="app-content main-content" id="appContent"></div>
    </div>`;

  const content = shell.querySelector("#appContent");
  const existingChildren = [...body.children];
  for (const child of existingChildren) {
    if (child === shell) continue;
    content.appendChild(child);
  }
  body.appendChild(shell);

  // Move the previous page header into the authenticated shell and retain its context label.
  const oldBrand = content.querySelector(".topbar-brand");
  if (oldBrand) {
    const anchor = document.createElement("a");
    anchor.className = "topbar-brand topbar-home-link";
    anchor.href = homeHref;
    anchor.setAttribute("aria-label", "Voltar à página inicial");
    anchor.innerHTML = `<img class="brand-logo-image" src="assets/logo-varanda-do-tempo.webp" alt=""><strong>Varanda do Tempo</strong>`;
    oldBrand.replaceWith(anchor);
  }
  const topbarActions = content.querySelector(".topbar-actions");
  if (topbarActions) topbarActions.classList.add("legacy-topbar-actions");
  const topbar = content.querySelector(".topbar");
  if (topbar && !topbar.querySelector(".topbar-home-link")) {
    const link = document.createElement("a");
    link.className = "topbar-brand topbar-home-link";
    link.href = homeHref;
    link.setAttribute("aria-label", "Voltar à página inicial");
    link.innerHTML = `<img class="brand-logo-image" src="assets/logo-varanda-do-tempo.webp" alt=""><strong>Varanda do Tempo</strong>`;
    topbar.prepend(link);
  }

  const sidebar = shell.querySelector("#appSidebar");
  const toggle = shell.querySelector("#sidebarToggle");
  const backdrop = shell.querySelector("#sidebarBackdrop");
  const mobileMedia = window.matchMedia("(max-width: 900px)");
  let previousBodyOverflow = "";

  const syncDrawerAccessibility = () => {
    const mobile = mobileMedia.matches;
    const open = mobile && sidebar.classList.contains("is-open");
    sidebar.inert = mobile && !open;
    if (mobile && !open) sidebar.setAttribute("aria-hidden", "true");
    else sidebar.removeAttribute("aria-hidden");
    if (!mobile && sidebar.classList.contains("is-open")) {
      sidebar.classList.remove("is-open");
      backdrop.classList.remove("is-visible");
      document.body.style.overflow = previousBodyOverflow;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Abrir menu");
    }
  };

  const closeDrawer = (restoreFocus = false) => {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
    if (mobileMedia.matches) {
      sidebar.inert = true;
      sidebar.setAttribute("aria-hidden", "true");
      document.body.style.overflow = previousBodyOverflow;
    }
    if (restoreFocus) toggle.focus();
  };

  const openDrawer = () => {
    if (!mobileMedia.matches) return;
    previousBodyOverflow = document.body.style.overflow;
    sidebar.classList.add("is-open");
    backdrop.classList.add("is-visible");
    sidebar.inert = false;
    sidebar.removeAttribute("aria-hidden");
    document.body.style.overflow = "hidden";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Fechar menu");
    requestAnimationFrame(() => sidebar.querySelector(".sidebar-brand")?.focus());
  };

  syncDrawerAccessibility();
  if (typeof mobileMedia.addEventListener === "function") mobileMedia.addEventListener("change", syncDrawerAccessibility);
  toggle.addEventListener("click", () => {
    if (sidebar.classList.contains("is-open")) closeDrawer(true);
    else openDrawer();
  });
  backdrop.addEventListener("click", () => closeDrawer(true));
  shell.querySelectorAll(".sidebar-link, .sidebar-brand").forEach(link => link.addEventListener("click", () => closeDrawer(false)));
  shell.querySelector("#sidebarLogout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "index.html";
  });
  document.addEventListener("keydown", event => {
    if (!sidebar.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer(true);
      return;
    }
    if (event.key === "Tab") {
      const focusable = [...sidebar.querySelectorAll('a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

const navigationRole = page !== "index.html" ? await getRole() : null;
if (page !== "index.html") buildShell(navigationRole);

// Preserve the floating back affordance where a valid previous operational destination exists.
const fallbackByPage = {
  "dashboard.html": "atendimento.html",
  "atendimento.html": navigationRole?.role === "admin" ? "dashboard.html" : null,
  "comandas.html": "dashboard.html",
  "cardapio.html": "dashboard.html",
  "reports.html": "dashboard.html"
};
const shouldShowBackButton = page !== "index.html" && !(page === "atendimento.html" && navigationRole?.role !== "admin");
if (shouldShowBackButton) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "floating-back-button";
  button.setAttribute("aria-label", "Voltar à página anterior");
  button.innerHTML = `<span aria-hidden="true">←</span><span>Voltar</span>`;
  button.addEventListener("click", () => {
    let sameSiteReferrer = false;
    try { sameSiteReferrer = Boolean(document.referrer) && new URL(document.referrer).origin === location.origin; } catch (_) {}
    if (sameSiteReferrer && history.length > 1) history.back();
    else location.href = fallbackByPage[page] || "atendimento.html";
  });
  document.body.appendChild(button);
}
