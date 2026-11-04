import { supabase } from "./supabaseClient.js";
import { requireAuth, logout } from "./guards.js";

const $ = (id) => document.getElementById(id);
let profile = null;
let allOrders = [];
let selectedOrderId = null;
let toastTimer = null;
let activeModalSubmit = null;
let modalPreviousFocus = null;
let modalPreviousOverflow = "";
let modalCloseTimer = null;
let detailRequestToken = 0;
let listRenderScheduled = false;

const icons = {
  refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.55-2.6L20 12M4 12l2.85 5.6A7 7 0 0 0 18.4 15"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
  transfer: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  receipt: '<path d="M4 3h16v18l-3-2-3 2-3-2-3 2-4-2Z"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  printer: '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/><path d="M18 12h.01"/>'
};

function icon(name, size = 16) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.info}</svg>`;
}
function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function showToast(message, error = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = `toast${error ? " error" : " success"}`;
  toast.setAttribute("role", error ? "alert" : "status");
  toast.setAttribute("aria-live", error ? "assertive" : "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}
function statusLabel(status) {
  return ({ open: "Aberta", closed: "Encerrada", cancelled: "Cancelada" })[status] || status;
}
function statusClass(status) {
  return status === "closed" ? "closed" : status === "cancelled" ? "cancelled" : "open";
}
function statusLabelPayment(status) {
  return ({ pending: "Pendente", partially_paid: "Parcialmente pago", paid: "Pago", cancelled: "Cancelado" })[status] || status;
}
function paymentMethodLabel(method) {
  return ({ pix: "PIX", dinheiro: "Dinheiro", credito: "Cartão de crédito", debito: "Cartão de débito", outro: "Recebimento", other: "Recebimento" })[method] || method || "—";
}
function orderTotal(order) {
  return (order.order_items || [])
    .filter(item => item.payment_status !== "cancelled")
    .reduce((sum, item) => sum + Number(item.subtotal ?? Number(item.quantity) * Number(item.unit_price)), 0);
}
function paidTotal(order) {
  return Number(order.paid_total || 0);
}
function filteredOrders() {
  const query = $("searchText").value.trim().toLocaleLowerCase("pt-BR");
  const status = $("statusFilter").value;
  return allOrders.filter(order => {
    if (status !== "all" && order.status !== status) return false;
    if (!query) return true;
    const matchesName = String(order.customer_name || "").toLocaleLowerCase("pt-BR").includes(query);
    const matchesNumber = String(order.order_number).includes(query.replace(/^#/, ""));
    return matchesName || matchesNumber;
  });
}
function renderOpenCount() {
  const count = allOrders.reduce((total, order) => total + (order.status === "open" ? 1 : 0), 0);
  $("openCount").textContent = String(count);
  const card = document.querySelector(".comandas-open-kpi");
  if (card) card.setAttribute("aria-label", `${count} ${count === 1 ? "comanda aberta" : "comandas abertas"}`);
}
function clearSelectedDetail() {
  detailRequestToken += 1;
  selectedOrderId = null;
  $("orderDetail").innerHTML = renderEmptyDetail();
}
function renderEmptyDetail() {
  return `<div class="comandas-detail-empty">
    <span class="comandas-empty-icon">${icon("receipt", 25)}</span>
    <strong>Selecione uma comanda</strong>
    <p>Os itens consumidos, os pagamentos e o saldo serão exibidos aqui.</p>
  </div>`;
}
function renderList() {
  const rows = filteredOrders();
  $("resultCount").textContent = `${rows.length} ${rows.length === 1 ? "comanda encontrada" : "comandas encontradas"}`;
  if (selectedOrderId && !rows.some(order => order.id === selectedOrderId)) clearSelectedDetail();
  if (!rows.length) {
    $("ordersList").innerHTML = `<div class="empty-state">Nenhuma comanda encontrada. Revise a busca ou ajuste os filtros.</div>`;
    return;
  }
  $("ordersList").innerHTML = rows.map(order => {
    const total = orderTotal(order);
    const paid = paidTotal(order);
    const balance = Math.max(0, total - paid);
    const itemsCount = (order.order_items || [])
      .filter(item => item.payment_status !== "cancelled")
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const selected = selectedOrderId === order.id;
    return `
      <button class="admin-order-card ${selected ? "selected" : ""}" type="button" data-order-id="${escapeHtml(order.id)}" aria-pressed="${selected}" aria-label="Consultar comanda número ${escapeHtml(order.order_number)}, cliente ${escapeHtml(order.customer_name)}">
        <div class="admin-order-card-heading">
          <div class="admin-order-identity">
            <span class="admin-order-number">#${escapeHtml(order.order_number)}</span>
            <span class="admin-order-customer">${escapeHtml(order.customer_name)}</span>
          </div>
          <span class="admin-status ${statusClass(order.status)}">${statusLabel(order.status)}</span>
        </div>
        <div class="admin-order-card-date">${icon("clock", 14)}<span>${dateTime(order.opened_at)}${order.closed_at ? ` · Encerrada ${dateTime(order.closed_at)}` : ""}</span></div>
        <div class="admin-order-card-footer">
          <span class="admin-order-items-count">${itemsCount} ${itemsCount === 1 ? "unidade" : "unidades"}</span>
          <span class="admin-order-financial"><strong>${money(total)}</strong><small>Recebido ${money(paid)}</small>${order.status === "open" && balance > 0 ? `<small class="admin-order-balance">Pendente ${money(balance)}</small>` : ""}</span>
        </div>
      </button>`;
  }).join("");
}
async function loadOrders() {
  $("ordersList").innerHTML = `<div class="loading"><span class="spinner"></span>Carregando comandas...</div>`;
  try {
    const { data, error } = await supabase.rpc("get_admin_order_history");
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    allOrders = rows.map(order => ({
      ...order,
      order_items: order.items || [],
      paid_total: Number(order.paid_amount || 0)
    }));
    renderOpenCount();
    renderList();
    if (selectedOrderId) {
      const selected = allOrders.find(order => order.id === selectedOrderId);
      if (selected) await renderDetail(selected);
      else clearSelectedDetail();
    }
  } catch (error) {
    $("ordersList").innerHTML = `<div class="empty-state">Não foi possível carregar as comandas: ${escapeHtml(error.message)}</div>`;
    showToast("Falha ao consultar comandas. Confira se a migration 007 foi executada.", true);
  }
}
function receiptPaymentStatus(status) {
  if (status === "paid") return "paid";
  if (status === "partially_paid") return "partial";
  if (status === "cancelled") return "cancelled";
  return "pending";
}
function buildAdminReceipt(order, orderItems, paymentHistory, paymentByItem) {
  const activeItems = orderItems.filter(item => item.payment_status !== "cancelled");
  const quantity = activeItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const total = orderTotal(order);
  const paid = paidTotal(order);
  const balance = Math.max(0, total - paid);
  const itemRows = orderItems.map(item => {
    const summary = paymentByItem.get(item.id) || {};
    const status = summary.payment_status || item.payment_status || "pending";
    const statusClass = receiptPaymentStatus(status);
    const subtotal = Number(item.subtotal ?? Number(item.quantity) * Number(item.unit_price));
    return `
      <div class="receipt-item ${status === "cancelled" ? "is-cancelled" : ""}">
        <div class="receipt-item-description">
          <strong>${escapeHtml(item.product_name || "Produto")}</strong>
          ${item.notes ? `<small>Obs.: ${escapeHtml(item.notes)}</small>` : ""}
          <small>${escapeHtml(dateTime(item.created_at))} · <span class="payment-state ${statusClass}">${escapeHtml(statusLabelPayment(status))}</span></small>
        </div>
        <span class="receipt-quantity">${Number(item.quantity)}x</span>
        <span class="receipt-unit">${money(item.unit_price)}</span>
        <strong class="receipt-subtotal">${money(subtotal)}</strong>
      </div>`;
  }).join("");
  const paymentRows = paymentHistory.map(payment => `
    <div class="admin-receipt-payment-row">
      <div>
        <strong>${escapeHtml(payment.payer_name || "Pagador não identificado")}</strong>
        <small>${escapeHtml(paymentMethodLabel(payment.payment_method))} · ${escapeHtml(dateTime(payment.paid_at))}</small>
        <small>${escapeHtml((payment.items || []).map(item => item.product_name).filter(Boolean).join(", ") || "Itens da comanda")}</small>
      </div>
      <strong>${money(payment.amount)}</strong>
    </div>`).join("");

  return `
    <div class="receipt-paper admin-receipt-paper">
      <div class="receipt-brand">
        <img class="receipt-brand-logo" src="assets/logo-varanda-do-tempo.webp" alt="Logo Varanda do Tempo">
        <div><strong>VARANDA DO TEMPO</strong><small>Comprovante de consumo</small></div>
      </div>
      <div class="receipt-title"><span>COMANDA DE CONSUMO</span><strong>#${escapeHtml(order.order_number)}</strong></div>
      <div class="receipt-meta">
        <div><span>Cliente</span><strong>${escapeHtml(order.customer_name || "—")}</strong></div>
        <div><span>Abertura</span><strong>${escapeHtml(dateTime(order.opened_at))}</strong></div>
        <div><span>Situação</span><strong>${escapeHtml(statusLabel(order.status))}</strong></div>
        ${order.closed_at ? `<div><span>Encerramento</span><strong>${escapeHtml(dateTime(order.closed_at))}</strong></div>` : ""}
      </div>
      <div class="receipt-items-heading"><span>DESCRIÇÃO</span><span>QTD.</span><span>UNIT.</span><span>TOTAL</span></div>
      ${itemRows || `<div class="receipt-empty">Nenhum produto lançado nesta comanda.</div>`}
      <div class="receipt-divider"></div>
      <div class="receipt-financial-row"><span>Quantidade de itens</span><strong>${quantity}</strong></div>
      <div class="receipt-financial-row"><span>Total consumido</span><strong>${money(total)}</strong></div>
      <div class="receipt-financial-row"><span>Total recebido</span><strong>${money(paid)}</strong></div>
      <div class="receipt-balance"><span>SALDO PENDENTE</span><strong>${money(balance)}</strong></div>
      ${paymentHistory.length ? `
        <section class="admin-receipt-payments">
          <h2>Histórico de recebimentos</h2>
          ${paymentRows}
        </section>` : ""}
      <div class="receipt-footer">Obrigado pela preferência!<br>Guarde este comprovante para conferência.</div>
    </div>`;
}
let adminReceiptPrinting = false;
async function printAdminReceipt(order, orderItems, paymentHistory, paymentByItem) {
  const printRoot = $("adminReceiptPrint");
  if (!printRoot || adminReceiptPrinting) {
    if (!printRoot) showToast("Não foi possível preparar a impressão desta comanda.", true);
    return;
  }

  adminReceiptPrinting = true;
  const originalParent = printRoot.parentNode;
  const originalNextSibling = printRoot.nextSibling;
  printRoot.innerHTML = buildAdminReceipt(order, orderItems, paymentHistory, paymentByItem);

  // The global navigation wraps page content in .app-layout. The print stylesheet
  // intentionally hides the application shell, so the receipt must be a body child.
  document.body.appendChild(printRoot);
  printRoot.hidden = false;
  printRoot.setAttribute("aria-hidden", "false");
  document.body.classList.add("printing-admin-receipt");

  let cleaned = false;
  let fallbackTimer = null;
  const printMedia = window.matchMedia("print");
  let printStarted = false;
  const restoreToOriginalPosition = () => {
    if (!originalParent?.isConnected) return;
    if (originalNextSibling?.parentNode === originalParent) originalParent.insertBefore(printRoot, originalNextSibling);
    else originalParent.appendChild(printRoot);
  };
  const onPrintMediaChange = event => {
    if (printStarted && !event.matches) cleanup();
  };
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    printRoot.hidden = true;
    printRoot.setAttribute("aria-hidden", "true");
    printRoot.innerHTML = "";
    document.body.classList.remove("printing-admin-receipt");
    restoreToOriginalPosition();
    window.removeEventListener("afterprint", cleanup);
    printMedia.removeEventListener?.("change", onPrintMediaChange);
    adminReceiptPrinting = false;
  };

  window.addEventListener("afterprint", cleanup, { once: true });
  printMedia.addEventListener?.("change", onPrintMediaChange);
  try {
    // Wait for the supplied logo asset and force layout before opening the print dialog.
    const logo = printRoot.querySelector(".receipt-brand-logo");
    if (logo && !logo.complete) {
      await new Promise(resolve => {
        logo.addEventListener("load", resolve, { once: true });
        logo.addEventListener("error", resolve, { once: true });
        window.setTimeout(resolve, 2500);
      });
    }
    if (logo?.decode) await logo.decode().catch(() => {});
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    printStarted = true;
    window.print();
    // Fallback for browsers that do not dispatch afterprint consistently.
    if (!cleaned) {
      fallbackTimer = window.setTimeout(() => {
        if (!printMedia.matches) cleanup();
      }, 30000);
    }
  } catch (error) {
    cleanup();
    showToast("O navegador não conseguiu abrir a impressão. Tente novamente.", true);
  }
}

function openAdminModal({ title, description, content = "", confirmLabel = "Confirmar", tone = "primary", iconName = "info", onConfirm }) {
  const overlay = $("adminActionModal");
  clearTimeout(modalCloseTimer);
  activeModalSubmit = onConfirm;
  modalPreviousFocus = document.activeElement;
  $("adminModalTitle").textContent = title;
  $("adminModalDescription").textContent = description;
  $("adminModalContent").innerHTML = content;
  $("adminModalIcon").innerHTML = icon(iconName, 22);
  $("adminModalError").hidden = true;
  $("adminModalError").textContent = "";
  const confirm = $("adminModalConfirm");
  confirm.className = `btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`;
  confirm.textContent = confirmLabel;
  confirm.disabled = false;
  $("adminModalCancel").textContent = "Voltar";
  modalPreviousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    overlay.classList.add("is-open");
    const firstField = overlay.querySelector("input, select, textarea");
    (firstField || confirm).focus();
  });
}
function closeAdminModal() {
  const overlay = $("adminActionModal");
  if (overlay.hidden) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  clearTimeout(modalCloseTimer);
  modalCloseTimer = setTimeout(() => {
    if (!overlay.classList.contains("is-open")) overlay.hidden = true;
  }, 170);
  document.body.style.overflow = modalPreviousOverflow;
  activeModalSubmit = null;
  if (modalPreviousFocus?.isConnected) modalPreviousFocus.focus();
  modalPreviousFocus = null;
}
async function submitAdminModal() {
  const form = $("adminModalContent").querySelector("form");
  if (form && !form.reportValidity()) return;
  const values = form ? Object.fromEntries(new FormData(form).entries()) : {};
  const confirm = $("adminModalConfirm");
  const originalLabel = confirm.textContent;
  confirm.disabled = true;
  confirm.innerHTML = `<span class="button-loading-spinner" aria-hidden="true"></span>Processando...`;
  $("adminModalCancel").disabled = true;
  $("adminModalError").hidden = true;
  try {
    if (typeof activeModalSubmit === "function") await activeModalSubmit(values);
    closeAdminModal();
  } catch (error) {
    $("adminModalError").textContent = error?.message || "Não foi possível concluir a ação. Tente novamente.";
    $("adminModalError").hidden = false;
    confirm.disabled = false;
    confirm.textContent = originalLabel;
    $("adminModalCancel").disabled = false;
  }
}
async function renderDetail(order) {
  const requestToken = ++detailRequestToken;
  selectedOrderId = order.id;
  renderList();
  const panel = $("orderDetail");
  panel.innerHTML = `<div class="loading"><span class="spinner"></span>Carregando detalhes da comanda...</div>`;
  try {
    const [{ data: items, error: itemsError }, { data: paymentHistory, error: paymentError }] = await Promise.all([
      supabase.rpc("get_order_payment_summary", { p_order_id: order.id }),
      supabase.rpc("get_order_payment_history", { p_order_id: order.id })
    ]);
    if (itemsError) throw itemsError;
    if (paymentError) throw paymentError;
    if (requestToken !== detailRequestToken || selectedOrderId !== order.id) return;

    const orderItems = order.order_items || [];
    const paymentByItem = new Map((items || []).map(item => [item.order_item_id, item]));
    const total = orderTotal(order);
    const paid = paidTotal(order);
    const balance = Math.max(0, total - paid);
    const activeItemCount = orderItems.filter(item => item.payment_status !== "cancelled").length;
    const productRows = orderItems.map(item => {
      const summary = paymentByItem.get(item.id) || {};
      const status = summary.payment_status || item.payment_status || "pending";
      const canManage = order.status === "open" && status === "pending";
      const isCancelled = status === "cancelled";
      return `
        <div class="admin-detail-row admin-managed-item ${isCancelled ? "is-cancelled" : ""}">
          <div class="admin-managed-item-info">
            <strong>${escapeHtml(item.product_name || "Produto")}</strong>
            <small>${Number(item.quantity)} × ${money(item.unit_price)} <span class="detail-item-status ${isCancelled ? "cancelled" : status}">${statusLabelPayment(status)}</span></small>
            ${item.notes ? `<small>Observação: ${escapeHtml(item.notes)}</small>` : ""}
          </div>
          <div class="admin-managed-item-actions">
            <strong>${money(item.subtotal ?? Number(item.quantity) * Number(item.unit_price))}</strong>
            ${canManage ? `<div class="inline-actions">
              <button class="btn btn-danger-soft btn-small" data-remove-item="${escapeHtml(item.id)}" type="button">${icon("trash", 14)} Remover</button>
              <button class="btn btn-secondary btn-small" data-transfer-item="${escapeHtml(item.id)}" type="button">${icon("transfer", 14)} Transferir</button>
            </div>` : ""}
            ${!canManage && !isCancelled ? `<small class="item-action-locked">${status === "partially_paid" || status === "paid" ? "Item com pagamento associado" : "Ação indisponível"}</small>` : ""}
          </div>
        </div>`;
    }).join("");

    const paymentRows = (paymentHistory || []).map(payment => `
      <div class="admin-payment-row">
        <div class="admin-payment-info">
          <strong>${escapeHtml(payment.payer_name || "Pagador não identificado")}</strong>
          <small>${escapeHtml(paymentMethodLabel(payment.payment_method))} · ${dateTime(payment.paid_at)}${Number(payment.split_count) > 1 ? ` · Dividido em ${payment.split_count} pessoas` : ""}</small>
          <small>${escapeHtml((payment.items || []).map(item => item.product_name).filter(Boolean).join(", "))}</small>
        </div>
        <strong class="admin-payment-amount">${money(payment.amount)}</strong>
      </div>`).join("");

    panel.innerHTML = `
      <div class="detail-header">
        <div class="detail-heading-main">
          <span class="detail-order-reference">Comanda #${escapeHtml(order.order_number)}</span>
          <h2>${escapeHtml(order.customer_name)}</h2>
          <div class="detail-heading-meta">
            <span class="admin-status ${statusClass(order.status)}">${statusLabel(order.status)}</span>
            ${order.status === "open" ? `<button class="btn btn-ghost btn-small" id="editCustomerNameButton" type="button">${icon("edit", 14)} Editar cliente</button>` : ""}
          </div>
        </div>
        <div class="detail-header-actions">
          <button class="btn btn-secondary btn-small" id="printOrderButton" type="button">${icon("printer", 14)} Imprimir comanda</button>
          <button class="btn btn-ghost btn-small detail-clear-button" id="closeDetailButton" type="button">${icon("close", 14)} Limpar</button>
        </div>
      </div>
      <div class="detail-meta-grid">
        <div><span>Aberta em</span><strong>${dateTime(order.opened_at)}</strong></div>
        <div><span>Encerrada em</span><strong>${dateTime(order.closed_at)}</strong></div>
        <div><span>Aberta por</span><strong>${escapeHtml(order.opened_by_name || "Não identificado")}</strong></div>
        <div><span>Fechada por</span><strong>${escapeHtml(order.closed_by_name || "—")}</strong></div>
      </div>
      <div class="detail-section">
        <div class="detail-section-heading"><h3>Consumo registrado</h3><span>${activeItemCount} ${activeItemCount === 1 ? "item ativo" : "itens ativos"}</span></div>
        ${productRows || `<div class="empty-note">Nenhum item registrado nesta comanda.</div>`}
      </div>
      <div class="detail-section detail-financial-section">
        <h3>Resumo financeiro</h3>
        <div class="detail-total-row"><span>Total consumido</span><strong>${money(total)}</strong></div>
        <div class="detail-total-row"><span>Total recebido</span><strong class="detail-paid-value">${money(paid)}</strong></div>
        <div class="detail-total-row balance-row"><span>Saldo pendente</span><strong>${money(balance)}</strong></div>
      </div>
      <div class="detail-section detail-payment-section">
        <div class="detail-section-heading"><h3>Histórico de pagamentos</h3><span>${(paymentHistory || []).length} ${(paymentHistory || []).length === 1 ? "registro" : "registros"}</span></div>
        ${paymentRows || `<div class="empty-note">Nenhum pagamento registrado.</div>`}
      </div>
      <p class="muted small detail-footnote">Somente itens totalmente pendentes podem ser removidos ou transferidos. Itens com pagamento associado permanecem bloqueados, preservando o histórico financeiro.</p>
    `;

    $("closeDetailButton").addEventListener("click", () => {
      clearSelectedDetail();
      renderList();
    });
    $("printOrderButton").addEventListener("click", () => {
      printAdminReceipt(order, orderItems, paymentHistory || [], paymentByItem);
    });

    const editNameButton = $("editCustomerNameButton");
    if (editNameButton) editNameButton.addEventListener("click", () => {
      openAdminModal({
        title: "Editar nome do cliente",
        description: `Atualize a identificação da comanda #${order.order_number}.`,
        iconName: "edit",
        confirmLabel: "Salvar nome",
        content: `<form id="adminModalForm" class="admin-modal-form">
          <div class="form-group">
            <label for="adminCustomerName">Nome do cliente</label>
            <input class="field-input" id="adminCustomerName" name="customerName" type="text" value="${escapeHtml(order.customer_name)}" minlength="2" maxlength="80" autocomplete="name" required>
            <small>Use pelo menos 2 caracteres para identificar o cliente.</small>
          </div>
        </form>`,
        onConfirm: async ({ customerName }) => {
          const name = String(customerName || "").trim().replace(/\s+/g, " ");
          if (name.length < 2) throw new Error("Informe um nome com pelo menos 2 caracteres.");
          const { error } = await supabase.rpc("admin_rename_customer_order", { p_order_id: order.id, p_customer_name: name });
          if (error) throw error;
          showToast("Nome do cliente atualizado.");
          await loadOrders();
        }
      });
    });

    panel.querySelectorAll("[data-remove-item]").forEach(button => button.addEventListener("click", () => {
      const item = orderItems.find(candidate => candidate.id === button.dataset.removeItem);
      if (!item) return;
      openAdminModal({
        title: "Remover item da comanda?",
        description: "Esta ação será registrada no histórico da operação.",
        iconName: "trash",
        tone: "danger",
        confirmLabel: "Remover item",
        content: `<div class="admin-modal-warning">
          <strong>${escapeHtml(item.product_name || "Produto")}</strong>
          <span>${Number(item.quantity)} unidade(s) · ${money(item.subtotal ?? Number(item.quantity) * Number(item.unit_price))}</span>
          <p>O item deixará de compor o consumo ativo da comanda. Esta ação só é permitida quando não há pagamento associado.</p>
        </div>`,
        onConfirm: async () => {
          const { error } = await supabase.rpc("admin_remove_pending_order_item", { p_order_item_id: button.dataset.removeItem });
          if (error) throw error;
          showToast("Item removido da comanda.");
          await loadOrders();
        }
      });
    }));

    panel.querySelectorAll("[data-transfer-item]").forEach(button => button.addEventListener("click", () => {
      const targets = allOrders.filter(candidate => candidate.status === "open" && candidate.id !== order.id);
      if (!targets.length) {
        showToast("Não há outra comanda aberta para receber este item.", true);
        return;
      }
      const options = targets.map(target => `<option value="${escapeHtml(target.id)}">#${escapeHtml(target.order_number)} · ${escapeHtml(target.customer_name)}</option>`).join("");
      openAdminModal({
        title: "Transferir item",
        description: "Selecione a comanda aberta que receberá este item.",
        iconName: "transfer",
        confirmLabel: "Transferir item",
        content: `<form id="adminModalForm" class="admin-modal-form">
          <div class="admin-transfer-item-summary">
            <strong>${escapeHtml(orderItems.find(item => item.id === button.dataset.transferItem)?.product_name || "Item selecionado")}</strong>
            <small>Origem: comanda #${escapeHtml(order.order_number)} · ${escapeHtml(order.customer_name)}</small>
          </div>
          <div class="form-group">
            <label for="adminTransferTarget">Comanda de destino</label>
            <select class="field-select" id="adminTransferTarget" name="targetOrderId" required>
              <option value="">Selecione uma comanda aberta</option>
              ${options}
            </select>
          </div>
          <p class="admin-modal-helper">Apenas comandas abertas são exibidas. O item precisa estar totalmente pendente.</p>
        </form>`,
        onConfirm: async ({ targetOrderId }) => {
          const target = allOrders.find(candidate => candidate.id === targetOrderId && candidate.status === "open");
          if (!target) throw new Error("Selecione uma comanda de destino que esteja aberta.");
          const { error } = await supabase.rpc("admin_transfer_pending_order_item", { p_order_item_id: button.dataset.transferItem, p_target_order_id: target.id });
          if (error) throw error;
          showToast(`Item transferido para a comanda #${target.order_number}.`);
          selectedOrderId = order.id;
          await loadOrders();
        }
      });
    }));
  } catch (error) {
    if (requestToken === detailRequestToken && selectedOrderId === order.id) {
      panel.innerHTML = `<div class="empty-state">Não foi possível carregar os detalhes: ${escapeHtml(error.message)}</div>`;
    }
  }
}
function bindEvents() {
  $("logoutButton").addEventListener("click", logout);
  $("applyFilters").addEventListener("click", renderList);
  $("clearFilters").addEventListener("click", () => {
    $("searchText").value = "";
    $("statusFilter").value = "all";
    renderList();
    $("searchText").focus();
  });
  $("statusFilter").addEventListener("change", renderList);
  $("refreshButton").addEventListener("click", loadOrders);
  $("searchText").addEventListener("input", () => {
    if (listRenderScheduled) return;
    listRenderScheduled = true;
    requestAnimationFrame(() => {
      listRenderScheduled = false;
      renderList();
    });
  });
  $("searchText").addEventListener("keydown", event => {
    if (event.key === "Enter") renderList();
  });
  $("ordersList").addEventListener("click", event => {
    const button = event.target.closest("[data-order-id]");
    if (!button) return;
    const order = allOrders.find(item => item.id === button.dataset.orderId);
    if (order) renderDetail(order);
  });

  $("adminModalConfirm").addEventListener("click", submitAdminModal);
  $("adminModalCancel").addEventListener("click", closeAdminModal);
  $("adminModalClose").addEventListener("click", closeAdminModal);
  $("adminActionModal").addEventListener("click", event => {
    if (event.target === $("adminActionModal")) closeAdminModal();
  });
  $("adminModalContent").addEventListener("submit", event => {
    if (event.target.matches("form")) {
      event.preventDefault();
      submitAdminModal();
    }
  });
  document.addEventListener("keydown", event => {
    const overlay = $("adminActionModal");
    if (overlay.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeAdminModal();
    }
    if (event.key === "Tab") {
      const focusable = [...overlay.querySelectorAll("button:not(:disabled):not([hidden]), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0].focus();
      }
    }
  });
}

profile = await requireAuth(["admin"]);
if (profile) {
  $("userName").textContent = profile.full_name || "";
  bindEvents();
  await loadOrders();
}
