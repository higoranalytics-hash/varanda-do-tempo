export const money = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dateTime = (value) =>
  new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  const variant = ["success", "error", "warning"].includes(type) ? type : "success";
  toast.className = `toast ${variant}`;
  toast.setAttribute("role", variant === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", variant === "error" ? "assertive" : "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.textContent = String(message ?? "");
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

export function setButtonLoading(button, loading, loadingText = "Aguarde...") {
  if (!button) return;
  if (loading) {
    if (button.dataset.loading === "true") return;
    button.dataset.originalHtml = button.innerHTML;
    button.dataset.loading = "true";
    const measuredWidth = Math.ceil(button.getBoundingClientRect().width);
    if (measuredWidth > 0) button.style.setProperty("--button-loading-width", `${measuredWidth}px`);
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.classList.add("is-loading");
    button.innerHTML = `<span class="button-loading-spinner" aria-hidden="true"></span><span>${escapeHtml(loadingText)}</span>`;
    return;
  }
  if (button.dataset.loading !== "true") return;
  button.innerHTML = button.dataset.originalHtml || button.innerHTML;
  delete button.dataset.originalHtml;
  delete button.dataset.loading;
  button.style.removeProperty("--button-loading-width");
  button.disabled = false;
  button.removeAttribute("aria-busy");
  button.classList.remove("is-loading");
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}



// Overlay global de processamento: contador compartilhado por todas as chamadas Supabase.
let globalLoadingCount = 0;
let globalLoadingTimer = null;
let globalLoadingVisibleAt = 0;
let globalLoadingBodyOverflow = "";

function ensureGlobalLoadingOverlay() {
  let overlay = document.getElementById("global-loading-overlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "global-loading-overlay";
  overlay.className = "global-loading-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-atomic", "true");
  overlay.setAttribute("aria-label", "Aguarde enquanto o sistema processa sua solicitação");
  overlay.innerHTML = `
    <div class="global-loading-card" role="status">
      <span class="global-loading-spinner" aria-hidden="true"></span>
      <strong>Processando sua solicitação</strong>
      <span>Estamos atualizando as informações. Aguarde...</span>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function showGlobalLoadingNow() {
  if (globalLoadingCount <= 0 || globalLoadingVisibleAt) return;
  const overlay = ensureGlobalLoadingOverlay();
  globalLoadingBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  overlay.hidden = false;
  // Reflow garante a transição sem piscar nem alterar o layout da página.
  void overlay.offsetHeight;
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  globalLoadingVisibleAt = Date.now();
  document.body.classList.add("is-processing");
}

export function beginGlobalLoading() {
  globalLoadingCount += 1;
  if (globalLoadingCount === 1) {
    window.clearTimeout(globalLoadingTimer);
    // Pequeno atraso para não piscar em consultas instantâneas.
    globalLoadingTimer = window.setTimeout(showGlobalLoadingNow, 140);
  }
}

export function endGlobalLoading() {
  globalLoadingCount = Math.max(0, globalLoadingCount - 1);
  if (globalLoadingCount > 0) return;
  window.clearTimeout(globalLoadingTimer);
  if (!globalLoadingVisibleAt) return;

  // Mantém o feedback visível por um tempo mínimo para evitar flashes.
  const elapsed = Date.now() - globalLoadingVisibleAt;
  const remaining = Math.max(0, 260 - elapsed);
  window.setTimeout(() => {
    if (globalLoadingCount > 0) return;
    const overlay = document.getElementById("global-loading-overlay");
    if (overlay) {
      overlay.classList.remove("is-visible");
      window.setTimeout(() => {
        if (globalLoadingCount === 0) overlay.hidden = true;
      }, 180);
    }
    globalLoadingVisibleAt = 0;
    document.body.classList.remove("is-processing");
    document.body.style.overflow = globalLoadingBodyOverflow;
  }, remaining);
}

let activeModalResolve = null;
let modalPreviousFocus = null;
let previousBodyOverflow = "";

function ensureModal() {
  let overlay = document.getElementById("modal-confirm");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "modal-confirm";
  overlay.className = "modal-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-body" tabindex="-1">
      <div class="modal-heading-row">
        <span class="modal-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg>
        </span>
        <div class="modal-heading-copy">
          <h2 class="modal-header" id="modal-title"></h2>
          <p class="modal-body" id="modal-body"></p>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-modal-cancel">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-modal-action">Confirmar</button>
      </div>
    </section>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", event => { if (event.target === overlay) fecharModal(false); });
  overlay.querySelector("#btn-modal-cancel").addEventListener("click", () => fecharModal(false));
  overlay.querySelector("#btn-modal-action").addEventListener("click", async () => {
    const action = overlay.querySelector("#btn-modal-action");
    action.disabled = true;
    action.textContent = "Aguarde...";
    try {
      if (typeof overlay._onConfirm === "function") await overlay._onConfirm();
      fecharModal(true);
    } catch (error) {
      action.disabled = false;
      action.textContent = overlay._confirmLabel || "Confirmar";
      showToast(error?.message || "Não foi possível concluir a ação.", "error");
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && overlay.classList.contains("active")) fecharModal(false);
    if (event.key === "Tab" && overlay.classList.contains("active")) {
      const focusables = [...overlay.querySelectorAll("button:not(:disabled)")];
      if (!focusables.length) return;
      if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusables.at(-1)) { event.preventDefault(); focusables[0].focus(); }
    }
  });
  return overlay;
}

export function fecharModal(result = false) {
  const overlay = document.getElementById("modal-confirm");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
  }
  if (typeof document !== "undefined") document.body.style.overflow = previousBodyOverflow;
  if (activeModalResolve) {
    activeModalResolve(Boolean(result));
    activeModalResolve = null;
  }
  if (modalPreviousFocus?.isConnected) modalPreviousFocus.focus();
  modalPreviousFocus = null;
}

// Abre um modal de confirmação. Sem callback, funciona como uma confirmação informativa.
// Retorna Promise<boolean>; aoConfirmar pode ser síncrono ou assíncrono.
export function mostrarModal(titulo, mensagem, aoConfirmar = null) {
  const overlay = ensureModal();
  if (activeModalResolve) fecharModal(false);
  modalPreviousFocus = document.activeElement;
  overlay.querySelector("#modal-title").textContent = String(titulo ?? "Confirmar ação");
  overlay.querySelector("#modal-body").textContent = String(mensagem ?? "");
  overlay._onConfirm = aoConfirmar;
  overlay._confirmLabel = aoConfirmar ? "Confirmar" : "Entendi";
  const cancel = overlay.querySelector("#btn-modal-cancel");
  const action = overlay.querySelector("#btn-modal-action");
  cancel.hidden = !aoConfirmar;
  action.disabled = false;
  action.textContent = overlay._confirmLabel;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  overlay.classList.add("active");
  overlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    overlay.querySelector(".modal-card")?.focus();
    action.focus();
  });
  return new Promise(resolve => { activeModalResolve = resolve; });
}

if (typeof window !== "undefined") {
  window.mostrarModal = mostrarModal;
  window.fecharModal = fecharModal;
}
