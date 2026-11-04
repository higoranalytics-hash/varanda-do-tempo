import { supabase } from "./supabaseClient.js";
import { requireAuth, logout } from "./guards.js";
import { getMenu } from "./products.js";
import { findOpenOrdersByName, getOpenOrderNameSuggestions, getAllOpenOrders, appendItems, getOrderItems, getOrderPaymentSummary, getOrderPaymentHistory, receiveOrderPayment, closeCustomerOrder, cancelEmptyCustomerOrder } from "./orders.js";
import { money, dateTime, showToast, setButtonLoading, escapeHtml, mostrarModal } from "./utils.js";

const $ = (id) => document.getElementById(id);
let profile = null;
let menu = [];
let suggestionTimer = null;
let lastSearchMatches = [];
let cart = [];
let selectedCategory = "all";
let activeOrder = null;
let orderViewMode = "edit";
let selectedExistingOrder = null;
let persistedOrderItems = [];
let paymentSummary = new Map();
let pendingNewCustomerName = "";

function showLoading(target, text = "Carregando...") {
  target.innerHTML = `<div class="loading"><span class="spinner"></span>${escapeHtml(text)}</div>`;
}
function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
function renderCart() {
  const container = $("cartItems");
  if (!cart.length) {
    container.innerHTML = `<div class="empty-state">Seu pedido ainda está vazio.<br>Selecione produtos do cardápio.</div>`;
  } else {
    container.innerHTML = cart.map((item, index) => `
      <div class="cart-line">
        <div>
          <div class="cart-line-name">${escapeHtml(item.name)}</div>
          <div class="cart-line-sub">${money(item.price)} cada · ${money(item.price * item.quantity)}</div>
        </div>
        <div class="qty-controls">
          <button type="button" data-action="minus" data-index="${index}" aria-label="Diminuir">−</button>
          <strong>${item.quantity}</strong>
          <button type="button" data-action="plus" data-index="${index}" aria-label="Aumentar">+</button>
          <button class="qty-remove-button" type="button" data-action="remove" data-index="${index}" aria-label="Remover ${escapeHtml(item.name)} do pedido" title="Remover item">×</button>
        </div>
      </div>`).join("");
  }
  $("cartTotal").textContent = money(cartTotal());
  $("cartCount").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  $("saveOrderButton").disabled = !cart.length || !activeOrder;
}
function addProduct(product) {
  const existing = cart.find(item => item.product_id === product.id);
  if (existing) existing.quantity += 1;
  else cart.push({ product_id: product.id, name: product.name, price: Number(product.price), quantity: 1, notes: "" });
  renderCart();
  if (activeOrder) renderPaymentPanel();
}
function renderCategories() {
  const categories = [{ id: "all", name: "Todos" }, ...menu];
  $("categoryTabs").innerHTML = categories.map(category => `
    <button class="category-tab ${selectedCategory === category.id ? "active" : ""}"
      type="button" data-category="${category.id}">${escapeHtml(category.name)}</button>
  `).join("");
}
function safeProductImageUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value), window.location.href);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderProducts() {
  const products = menu
    .filter(category => selectedCategory === "all" || category.id === selectedCategory)
    .flatMap(category => category.products);
  if (!products.length) {
    $("productGrid").innerHTML = `<div class="empty-state">Nenhum produto disponível nesta categoria.</div>`;
    return;
  }
  $("productGrid").innerHTML = products.map(product => {
    const imageUrl = safeProductImageUrl(product.image_url);
    return `
      <button class="product-card" type="button" data-product="${product.id}"
        aria-label="Adicionar ${escapeHtml(product.name)} ao pedido, ${money(product.price)}">
        <span class="product-card-media ${imageUrl ? "" : "is-empty"}">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async">` : ""}
          <span class="product-card-placeholder" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 17.2h22M7.2 17.2a8.8 8.8 0 0 0 17.6 0M9 12.5c1.2-1.2 1.2-2.7 0-3.9m7 3.9c1.2-1.2 1.2-2.7 0-3.9m7 3.9c1.2-1.2 1.2-2.7 0-3.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Foto indisponível</span>
          </span>
        </span>
        <span class="product-card-info">
          <strong>${escapeHtml(product.name)}</strong>
          <span class="product-card-footer">
            <span class="product-price">${money(product.price)}</span>
            <span class="product-card-add" aria-hidden="true">＋</span>
          </span>
        </span>
      </button>`;
  }).join("");
}
function paymentStatusLabel(status) {
  const labels = {
    pending: "Pendente",
    partially_paid: "Parcialmente pago",
    paid: "Pago",
    cancelled: "Cancelado"
  };
  return labels[status] || "Pendente";
}
function renderOrderHistory() {
  const panel = $("orderHistoryPanel");
  const container = $("orderHistoryItems");
  panel.hidden = !activeOrder;
  const visibleItems = persistedOrderItems.filter(item => item.payment_status !== "cancelled");
  const totalCents = visibleItems.reduce((sum, item) => sum + cents(item.subtotal ?? Number(item.quantity) * Number(item.unit_price)), 0);
  const paidCents = visibleItems.reduce((sum, item) => sum + (paymentSummary.get(item.id)?.paidCents || 0), 0);
  const balanceCents = Math.max(0, totalCents - paidCents);
  const quantity = visibleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  $("orderHistorySummary").textContent = `${quantity} unidade(s) · ${money(totalCents / 100)}`;

  const rows = persistedOrderItems.map(item => {
    const status = item.payment_status || "pending";
    const statusClass = status === "paid" ? "paid" : status === "cancelled" ? "cancelled" : status === "partially_paid" ? "partial" : "pending";
    const time = item.created_at ? new Date(item.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
    return `
      <div class="receipt-item ${status === "cancelled" ? "is-cancelled" : ""}">
        <div class="receipt-item-description">
          <strong>${escapeHtml(item.product_name)}</strong>
          ${item.notes ? `<small>Obs.: ${escapeHtml(item.notes)}</small>` : ""}
          <small>${escapeHtml(time)} · <span class="payment-state ${statusClass}">${paymentStatusLabel(status)}</span></small>
        </div>
        <span class="receipt-quantity">${Number(item.quantity)}x</span>
        <span class="receipt-unit">${money(item.unit_price)}</span>
        <strong class="receipt-subtotal">${money(item.subtotal ?? Number(item.quantity) * Number(item.unit_price))}</strong>
      </div>`;
  }).join("");

  container.innerHTML = `
    <div class="receipt-paper">
      <div class="receipt-brand">
        <div class="receipt-brand-mark">VT</div>
        <div><strong>VARANDA DO TEMPO</strong><small>Comprovante de consumo</small></div>
      </div>
      <div class="receipt-title">
        <span>COMANDA DE CONSUMO</span>
        <strong>#${activeOrder?.order_number ?? "—"}</strong>
      </div>
      <div class="receipt-meta">
        <div><span>Cliente</span><strong>${escapeHtml(activeOrder?.customer_name || "—")}</strong></div>
        <div><span>Abertura</span><strong>${escapeHtml(dateTime(activeOrder?.opened_at))}</strong></div>
        <div><span>Situação</span><strong>${activeOrder?.status === "closed" ? "Encerrada" : "Aberta"}</strong></div>
      </div>
      <div class="receipt-items-heading">
        <span>DESCRIÇÃO</span><span>QTD.</span><span>UNIT.</span><span>TOTAL</span>
      </div>
      ${rows || `<div class="receipt-empty">Nenhum produto lançado nesta comanda.</div>`}
      <div class="receipt-divider"></div>
      <div class="receipt-financial-row"><span>Quantidade de itens</span><strong>${quantity}</strong></div>
      <div class="receipt-financial-row"><span>Total consumido</span><strong>${money(totalCents / 100)}</strong></div>
      <div class="receipt-financial-row"><span>Total recebido</span><strong>${money(paidCents / 100)}</strong></div>
      <div class="receipt-balance"><span>SALDO PENDENTE</span><strong>${money(balanceCents / 100)}</strong></div>
      <div class="receipt-footer">Obrigado pela preferência!<br>Guarde este comprovante para conferência.</div>
    </div>`;
}
function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

async function enrichOrderPaymentSummary(order) {
  const activeItems = (order.order_items || []).filter(item => item.payment_status !== "cancelled");
  const totalCents = activeItems.reduce((sum, item) =>
    sum + cents(item.subtotal ?? Number(item.quantity) * Number(item.unit_price)), 0);
  const activeItemCount = activeItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  try {
    const rows = await getOrderPaymentSummary(order.id);
    const summaryByItem = new Map(rows.map(row => [row.order_item_id, row]));
    const paidCents = activeItems.reduce((sum, item) => {
      const summary = summaryByItem.get(item.id);
      if (summary) return sum + cents(summary.paid_amount);
      // Protege registros antigos já marcados como pagos mesmo se a RPC não retornar a linha.
      return sum + (item.payment_status === "paid"
        ? cents(item.subtotal ?? Number(item.quantity) * Number(item.unit_price))
        : 0);
    }, 0);

    return {
      ...order,
      totalCents,
      paidCents: Math.min(totalCents, paidCents),
      balanceCents: Math.max(0, totalCents - paidCents),
      activeItemCount,
      paymentSummaryAvailable: true
    };
  } catch (error) {
    console.warn(`Não foi possível carregar o resumo financeiro da comanda #${order.order_number}:`, error);
    return {
      ...order,
      totalCents,
      activeItemCount,
      paymentSummaryAvailable: false
    };
  }
}

function renderOrderFinancialSummary(order) {
  if (order.paymentSummaryLoading) {
    return `
      <div class="order-option-financial is-loading" aria-live="polite">
        <span>Resumo financeiro</span>
        <small>Calculando pagamentos...</small>
      </div>`;
  }
  if (!order.paymentSummaryAvailable) {
    return `
      <div class="order-option-financial is-unavailable" aria-label="Resumo financeiro indisponível">
        <div class="order-option-total"><span>Total da comanda</span><strong>${money(order.totalCents / 100)}</strong></div>
        <small>Não foi possível consultar os pagamentos. Abra a comanda para conferir os valores.</small>
      </div>`;
  }
  return `
    <div class="order-option-financial" aria-label="Resumo financeiro da comanda">
      <div class="order-option-total"><span>Total da comanda</span><strong>${money(order.totalCents / 100)}</strong></div>
      <div class="order-option-paid"><span>Recebido</span><strong>${money(order.paidCents / 100)}</strong></div>
      <div class="order-option-balance ${order.balanceCents > 0 ? "is-pending" : "is-settled"}">
        <span>Pendente</span>
        <strong>${money(order.balanceCents / 100)}</strong>
      </div>
    </div>`;
}

function renderOrderPaymentNote(order) {
  if (order.paymentSummaryLoading || !order.paymentSummaryAvailable) return "";
  if ((order.activeItemCount || 0) === 0) {
    return `<div class="order-option-payment-note">Nenhum consumo ativo nesta comanda.</div>`;
  }
  if (order.balanceCents === 0) {
    return `<div class="order-option-payment-note is-settled"><span aria-hidden="true">✓</span> ${order.totalCents > 0 ? "Quitada · aguardando encerramento" : "Sem valor pendente · pronta para encerramento"}</div>`;
  }
  return "";
}

function renderSearchOrderOption(order) {
  const count = Number(order.activeItemCount || 0);
  const countLabel = `${count} ${count === 1 ? "unidade" : "unidades"}`;
  const paymentAction = order.paymentSummaryAvailable && order.balanceCents > 0 && count > 0
    ? `<button class="btn btn-success btn-compact" type="button" data-pay-order="${escapeHtml(order.id)}"><span aria-hidden="true">R$</span> Receber pagamento</button>`
    : "";
  const closeAction = order.paymentSummaryAvailable && order.balanceCents === 0 && count > 0
    ? `<button class="btn btn-success btn-compact" type="button" data-close-order="${escapeHtml(order.id)}"><span aria-hidden="true">✓</span> Fechar comanda</button>`
    : "";

  return `
    <article class="order-option">
      <div class="order-option-top">
        <span class="order-number">Comanda #${escapeHtml(order.order_number)} · ${escapeHtml(order.customer_name)}</span>
        <span class="status-pill">Aberta</span>
      </div>
      <span class="order-meta">${dateTime(order.opened_at)} · ${countLabel}</span>
      ${renderOrderFinancialSummary(order)}
      ${renderOrderPaymentNote(order)}
      <div class="order-quick-actions">
        <button class="btn btn-secondary btn-compact" type="button" data-order="${escapeHtml(order.id)}"><span aria-hidden="true">▤</span> Consultar</button>
        ${paymentAction}
        ${closeAction}
      </div>
    </article>`;
}

function selectedPaymentItems() {
  return [...document.querySelectorAll("#paymentItemList input[type=checkbox]:checked")]
    .map(input => input.value);
}
function selectedPaymentCents() {
  return selectedPaymentItems().reduce((sum, id) => sum + (paymentSummary.get(id)?.remainingCents || 0), 0);
}
function renderPaymentPanel() {
  const panel = $("paymentPanel");
  panel.hidden = !activeOrder || orderViewMode === "view";
  if (!activeOrder) return;
  const activeItems = persistedOrderItems.filter(item => item.payment_status !== "cancelled");
  const totalCents = activeItems.reduce((sum, item) => sum + cents(item.subtotal ?? Number(item.quantity) * Number(item.unit_price)), 0);
  const paidCents = activeItems.reduce((sum, item) => sum + (paymentSummary.get(item.id)?.paidCents || 0), 0);
  const balanceCents = Math.max(0, totalCents - paidCents);
  $("orderBalance").textContent = money(balanceCents / 100);

  const closePanel = $("closeOrderPanel");
  const canClose = balanceCents === 0 && activeItems.length > 0 && cart.length === 0 && activeOrder.status === "open";
  const canCancelEmpty = activeItems.length === 0 && cart.length === 0 && activeOrder.status === "open";
  // Na consulta, permite encerrar comandas quitadas e cancelar comandas realmente vazias.
  // O backend revalida a ausência de itens ativos e de pagamentos antes de cancelar.
  closePanel.hidden = !activeOrder || (orderViewMode === "view" && !canClose && !canCancelEmpty);
  closePanel.classList.toggle("is-empty-cancel-state", canCancelEmpty);
  $("closeOrderBalance").textContent = money(balanceCents / 100);
  $("closeOrderBalanceBlock").hidden = canCancelEmpty;
  $("closeOrderButton").hidden = canCancelEmpty;
  $("closeOrderButton").disabled = !canClose;
  const cancelEmptyButton = $("cancelEmptyOrderButton");
  if (cancelEmptyButton) cancelEmptyButton.hidden = !canCancelEmpty;
  $("closeOrderTitle").textContent = canCancelEmpty ? "Comanda sem consumo" : "Fechamento da comanda";
  $("closeOrderMessage").textContent = canCancelEmpty
    ? "Esta comanda não possui consumo ativo. Se foi aberta por engano, você pode cancelá-la. O registro ficará preservado no histórico."
    : cart.length
      ? "Salve ou remova os itens que ainda estão no pedido atual antes de fechar."
      : balanceCents > 0
        ? "A comanda poderá ser fechada depois que todos os itens estiverem pagos."
        : activeItems.length === 0
          ? "Adicione e quite ao menos um item antes de fechar a comanda."
          : "Todos os itens estão pagos. Você já pode fechar esta comanda.";

  const eligible = activeItems.filter(item => (paymentSummary.get(item.id)?.remainingCents || 0) > 0);
  const list = $("paymentItemList");
  if (!eligible.length) {
    list.innerHTML = `<div class="empty-state">Esta comanda não possui saldo pendente.</div>`;
  } else {
    const previouslySelected = new Set(selectedPaymentItems());
    list.innerHTML = eligible.map(item => {
      const summary = paymentSummary.get(item.id) || { remainingCents: cents(item.subtotal) };
      const checked = previouslySelected.size ? previouslySelected.has(item.id) : true;
      return `
        <label class="payment-item">
          <input type="checkbox" value="${item.id}" ${checked ? "checked" : ""}>
          <span class="payment-item-name">
            <strong>${escapeHtml(item.product_name)}</strong>
            <small>${Number(item.quantity)} × ${money(item.unit_price)} · Saldo: ${money(summary.remainingCents / 100)}</small>
          </span>
          <strong>${money(summary.remainingCents / 100)}</strong>
        </label>`;
    }).join("");
  }
  updatePaymentPreview();
}
function updatePaymentPreview() {
  const total = selectedPaymentCents();
  const split = Math.min(20, Math.max(1, Number.parseInt($("splitCount").value || "1", 10)));
  $("selectedPaymentTotal").textContent = money(total / 100);
  $("perPersonTotal").textContent = money(Math.floor(total / split) / 100) + (total % split ? " (ajuste de centavos no registro)" : "");
  $("receivePaymentButton").disabled = total <= 0 || !activeOrder;
}

async function refreshPaymentHistory() {
  if (!activeOrder) return;
  const container = $("paymentHistoryList");
  try {
    const payments = await getOrderPaymentHistory(activeOrder.id);
    if (!payments.length) {
      container.innerHTML = `<div class="empty-note">Nenhum pagamento registrado nesta comanda.</div>`;
      return;
    }
    container.innerHTML = payments.map(payment => {
      const methodLabels = { pix: "PIX", dinheiro: "Dinheiro", credito: "Crédito", debito: "Débito", outro: "Recebimento", other: "Recebimento" };
      const products = (payment.items || [])
        .map(link => link.product_name)
        .filter(Boolean);
      const splitLabel = Number(payment.split_count || 1) > 1
        ? ` · Divisão em ${payment.split_count} pessoas` : "";
      return `
        <article class="payment-history-row">
          <div>
            <strong>${escapeHtml(payment.payer_name || "Pagador não identificado")}</strong>
            <div class="muted small">${escapeHtml(methodLabels[payment.payment_method] || payment.payment_method)} · ${dateTime(payment.paid_at)}${splitLabel}</div>
            <div class="muted small">${escapeHtml([...new Set(products)].join(", ") || "Itens da comanda")}</div>
          </div>
          <strong>${money(payment.amount)}</strong>
        </article>`;
    }).join("");
  } catch (error) {
    container.innerHTML = `<div class="empty-note">Não foi possível carregar os pagamentos: ${escapeHtml(error.message)}</div>`;
  }
}

async function refreshPaymentSummary() {
  if (!activeOrder) return;
  const rows = await getOrderPaymentSummary(activeOrder.id);
  paymentSummary = new Map(rows.map(row => [row.order_item_id, {
    paidCents: cents(row.paid_amount),
    remainingCents: cents(row.remaining_amount)
  }]));
  renderPaymentPanel();
  renderOrderHistory();
  await refreshPaymentHistory();
}
async function submitPayment() {
  if (!activeOrder) return;
  const ids = selectedPaymentItems();
  const splitCount = Math.min(20, Math.max(1, Number.parseInt($("splitCount").value || "1", 10)));
  if (!ids.length) {
    showToast("Selecione pelo menos um item para pagamento.", "error");
    return;
  }
  const button = $("receivePaymentButton");
  setButtonLoading(button, true, "Registrando...");
  try {
    const result = await receiveOrderPayment({
      orderId: activeOrder.id,
      orderItemIds: ids,
      // Forma e identificação do pagador ficam temporariamente padronizadas no backend.
      paymentMethod: "outro",
      payerName: "Atendimento",
      splitCount
    });
    await refreshOrderHistory();
    await refreshPaymentSummary();
    $("splitCount").value = "1";
    showToast(`Pagamento registrado: ${money(Number(result.total_paid || 0))}.`);
    const remainingCents = persistedOrderItems
      .filter(item => item.payment_status !== "cancelled")
      .reduce((sum, item) => sum + (paymentSummary.get(item.id)?.remainingCents ?? cents(item.subtotal)), 0);
    if (remainingCents === 0 && persistedOrderItems.some(item => item.payment_status !== "cancelled")) {
      await mostrarModal(
        "Pagamento total recebido!",
        `A comanda #${activeOrder.order_number} está totalmente quitada. Deseja encerrá-la agora?`,
        async () => { await confirmCloseActiveOrder(); }
      );
    }
  } catch (error) {
    showToast(error.message || "Não foi possível registrar o pagamento.", "error");
  } finally {
    setButtonLoading(button, false);
    updatePaymentPreview();
  }
}


async function cancelActiveEmptyOrder() {
  if (!activeOrder || activeOrder.status !== "open") return;
  if (cart.length || persistedOrderItems.some(item => item.payment_status !== "cancelled")) {
    showToast("Esta comanda possui consumo. O cancelamento só é permitido quando está vazia.", "error");
    return;
  }
  const order = { ...activeOrder };
  await mostrarModal(
    "Cancelar comanda vazia?",
    `A comanda #${order.order_number} de ${order.customer_name} será marcada como cancelada. Essa ação não poderá ser desfeita.`,
    async () => {
      const result = await cancelEmptyCustomerOrder(order.id);
      activeOrder.status = "cancelled";
      $("activeOrderNumber").textContent = "CANCELADA";
      $("activeOrderMeta").textContent = "Comanda cancelada sem consumo";
      $("orderWorkspace").hidden = true;
      $("paymentPanel").hidden = true;
      $("closeOrderPanel").hidden = true;
      $("addProductsFromView").hidden = true;
      showToast(`Comanda #${result.order_number} cancelada.`);
      clearActiveOrder();
    }
  );
}

async function closeActiveOrder() {
  if (!activeOrder || activeOrder.status !== "open") return;
  if (cart.length) {
    showToast("Existem itens não salvos no pedido atual. Salve ou remova antes de fechar.", "error");
    return;
  }

  const balanceCents = persistedOrderItems
    .filter(item => item.payment_status !== "cancelled")
    .reduce((sum, item) => sum + (paymentSummary.get(item.id)?.remainingCents ?? cents(item.subtotal)), 0);

  if (balanceCents > 0) {
    showToast("Ainda existe saldo pendente nesta comanda.", "error");
    return;
  }

  $("closeOrderConfirmText").textContent =
    `Confirma o fechamento da comanda #${activeOrder.order_number} de ${activeOrder.customer_name}? Depois do encerramento, novos lançamentos não serão permitidos.`;
  $("closeOrderConfirmModal").hidden = false;
}

async function confirmCloseActiveOrder() {
  if (!activeOrder || activeOrder.status !== "open") return;
  const button = $("confirmCloseOrderButton");
  setButtonLoading(button, true, "Encerrando...");
  try {
    const result = await closeCustomerOrder(activeOrder.id);
    $("closeOrderConfirmModal").hidden = true;
    activeOrder.status = "closed";
    $("addProductsFromView").hidden = true;
    renderOrderHistory();
    $("activeOrderName").textContent = `Comanda #${result.order_number} · ${activeOrder.customer_name}`;
    $("activeOrderNumber").textContent = "ENCERRADA";
    $("activeOrderMeta").textContent = "Comanda encerrada";
    $("changeOrderButton").textContent = "Voltar à consulta";
    $("orderWorkspace").hidden = true;
    $("paymentEntryArea").hidden = true;
    $("paymentPanelTitle").textContent = "Resumo financeiro";
    $("paymentPanelDescription").textContent = "A comanda foi encerrada. O histórico de pagamentos permanece disponível.";
    $("closeOrderTitle").textContent = "Comanda fechada com sucesso";
    $("closeOrderMessage").textContent = `Comanda #${result.order_number} encerrada em ${dateTime(result.closed_at)}. O histórico foi preservado.`;
    $("closeOrderActions").hidden = true;
    $("closeOrderButton").hidden = true;
    showToast(`Comanda #${result.order_number} fechada com sucesso.`);
  } catch (error) {
    showToast(error.message || "Não foi possível fechar a comanda.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function refreshOrderHistory() {
  if (!activeOrder) return;
  $("orderHistoryItems").innerHTML = `<div class="loading"><span class="spinner"></span>Atualizando consumo...</div>`;
  try {
    persistedOrderItems = await getOrderItems(activeOrder.id);
    renderOrderHistory();
    await refreshPaymentSummary();
  } catch (error) {
    $("orderHistoryItems").innerHTML = `<div class="empty-state">Não foi possível carregar o consumo: ${escapeHtml(error.message)}</div>`;
    showToast("Não foi possível atualizar o consumo da comanda.", "error");
  }
}

async function setActiveOrder(order, isNew = false, mode = "edit") {
  activeOrder = { ...order, status: order.status || "open" };
  orderViewMode = mode;
  $("activeOrderBox").hidden = false;
  $("activeOrderName").textContent = `Comanda #${order.order_number} · ${order.customer_name}`;
  $("activeOrderNumber").textContent = activeOrder.status === "closed"
    ? "ENCERRADA"
    : activeOrder.status === "cancelled" ? "CANCELADA" : "ABERTA";
  $("activeOrderMeta").textContent = "";
  $("customerSearchPanel").hidden = true;
  $("orderWorkspace").hidden = mode === "view";
  $("paymentPanel").hidden = mode === "view";
  $("closeOrderPanel").hidden = mode === "view";
  $("addProductsFromView").hidden = mode !== "view" || activeOrder.status !== "open";
  persistedOrderItems = [];
  paymentSummary = new Map();
  showLoading($("orderHistoryItems"), "Carregando comanda e histórico de consumo...");
  renderOrderHistory();
  await refreshOrderHistory();
  $("currentOrderNotice").textContent = isNew
    ? "Comanda criada. Adicione produtos ao pedido."
    : "Comanda selecionada. Os novos itens serão adicionados a ela.";
  renderCart();
}
function clearActiveOrder() {
  activeOrder = null;
  orderViewMode = "edit";
  $("addProductsFromView").hidden = true;
  cart = [];
  persistedOrderItems = [];
  paymentSummary = new Map();
  $("paymentPanel").hidden = true;
  $("paymentEntryArea").hidden = false;
  $("paymentPanelTitle").textContent = "4. Receber pagamento";
  $("paymentPanelDescription").textContent = "Selecione os itens que serão pagos. Itens parcialmente pagos podem ter o saldo restante quitado.";
  $("closeOrderPanel").hidden = true;
  $("closeOrderActions").hidden = false;
  $("closeOrderBalanceBlock").hidden = false;
  $("closeOrderButton").hidden = false;
  $("cancelEmptyOrderButton").hidden = true;
  $("closeOrderPanel").classList.remove("is-empty-cancel-state");
  $("closeOrderTitle").textContent = "Fechamento da comanda";
  $("closeOrderMessage").textContent = "Quando todos os itens estiverem pagos, você poderá encerrar esta comanda.";
  $("changeOrderButton").textContent = "Voltar à consulta";
  $("orderHistoryPanel").hidden = true;
  $("orderHistoryItems").innerHTML = "";
  $("activeOrderBox").hidden = true;
  $("orderWorkspace").hidden = true;
  $("customerSearchPanel").hidden = false;
  $("customerName").value = "";
  lastSearchMatches = [];
  $("customerSuggestions").hidden = true;
  $("openOrdersList").innerHTML = "";
  $("existingOrdersArea").hidden = true;
  renderCart();
}

async function searchCustomer() {
  const name = $("customerName").value.trim().replace(/\s+/g, " ");
  if (name.length < 1) {
    showToast("Digite ao menos uma letra do nome do cliente.", "error");
    return;
  }
  lastSearchMatches = [];
  const button = $("searchCustomerButton");
  setButtonLoading(button, true, "Buscando...");
  showLoading($("openOrdersList"), "Verificando comandas abertas...");
  $("existingOrdersArea").hidden = true;
  try {
    const matches = await findOpenOrdersByName(name);
    const enrichedMatches = await Promise.all(matches.map(enrichOrderPaymentSummary));
    lastSearchMatches = enrichedMatches;
    window._openOrders = enrichedMatches;
    $("customerSuggestions").hidden = true;
    $("existingOrdersArea").hidden = false;
    if (enrichedMatches.length) {
      $("existingOrdersTitle").textContent = enrichedMatches.length === 1
        ? "Encontramos uma comanda aberta"
        : `Encontramos ${enrichedMatches.length} comandas abertas`;
      $("openOrdersList").innerHTML = enrichedMatches.map(renderSearchOrderOption).join("");
    } else {
      $("existingOrdersTitle").textContent = "Nenhuma comanda aberta encontrada";
      $("openOrdersList").innerHTML = `<div class="empty-state">Este cliente ainda não possui comanda aberta. Para começar, utilize “Novo atendimento”.</div>`;
    }
  } catch (error) {
    $("existingOrdersArea").hidden = false;
    $("openOrdersList").innerHTML = `<div class="empty-state">Não foi possível consultar: ${escapeHtml(error.message)}</div>`;
  } finally {
    setButtonLoading(button, false);
  }
}
function startNewAttendance() {
  pendingNewCustomerName = "";
  const currentSearchName = $("customerName").value.trim().replace(/\s+/g, " ");
  $("newCustomerNameInput").value = currentSearchName;
  $("newOrderModal").hidden = false;
  requestAnimationFrame(() => {
    $("newCustomerNameInput").focus();
    $("newCustomerNameInput").select();
  });
}

async function createNewOrderForCustomer(name) {
  const { data, error } = await supabase.rpc("open_customer_order", {
    p_customer_name: name,
    p_table_id: null
  });
  if (error) throw error;

  const order = {
    id: data.id,
    order_number: data.order_number,
    customer_name: name,
    status: "open"
  };
  $("newOrderModal").hidden = true;
  $("duplicateNameModal").hidden = true;
  pendingNewCustomerName = "";
  await setActiveOrder(order, true);
  showToast(`Atendimento iniciado. Comanda #${order.order_number} aberta.`);
}

async function confirmNewOrder() {
  const name = $("newCustomerNameInput").value.trim().replace(/\s+/g, " ");
  if (!name) {
    showToast("Informe o nome do cliente para iniciar o atendimento.", "error");
    $("newCustomerNameInput").focus();
    return;
  }

  const button = $("confirmNewOrderButton");
  setButtonLoading(button, true, "Verificando...");
  try {
    const matches = await findOpenOrdersByName(name);
    if (matches.length) {
      pendingNewCustomerName = name;
      $("distinctCustomerName").value = "";
      $("duplicateNameMessage").textContent =
        `Já existe ${matches.length === 1 ? "uma comanda aberta" : `${matches.length} comandas abertas`} para “${name}”. Se for outra pessoa com o mesmo nome, informe o sobrenome ou apelido para diferenciar os clientes.`;
      $("newOrderModal").hidden = true;
      $("duplicateNameModal").hidden = false;
      requestAnimationFrame(() => $("distinctCustomerName").focus());
      return;
    }

    await createNewOrderForCustomer(name);
  } catch (error) {
    showToast(error.message || "Não foi possível iniciar o atendimento.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function confirmDistinctCustomerName() {
  const distinctName = $("distinctCustomerName").value.trim().replace(/\s+/g, " ");
  if (!pendingNewCustomerName || !distinctName || distinctName.toLocaleLowerCase("pt-BR") === pendingNewCustomerName.toLocaleLowerCase("pt-BR")) {
    showToast("Adicione um sobrenome ou apelido para diferenciar o cliente.", "error");
    $("distinctCustomerName").focus();
    return;
  }

  const button = $("confirmDuplicateNameButton");
  setButtonLoading(button, true, "Verificando...");
  try {
    const duplicateMatches = await findOpenOrdersByName(distinctName);
    if (duplicateMatches.length) {
      showToast("Esse nome também possui uma comanda aberta. Informe outro sobrenome ou apelido.", "error");
      $("distinctCustomerName").focus();
      return;
    }
    await createNewOrderForCustomer(distinctName);
  } catch (error) {
    showToast(error.message || "Não foi possível iniciar o atendimento.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function chooseExistingOrder(orderId) {
  const order = window._openOrders?.find(item => item.id === orderId);
  if (!order) return;
  selectedExistingOrder = order;
  $("confirmExistingText").textContent =
    `Deseja abrir a comanda #${order.order_number} de ${order.customer_name} para consultar o consumo e, se necessário, adicionar novos produtos?`;
  $("confirmExistingModal").hidden = false;
}
async function confirmExistingOrder() {
  if (!selectedExistingOrder) return;
  $("confirmExistingModal").hidden = true;
  const button = $("confirmExistingButton");
  setButtonLoading(button, true, "Carregando...");
  try {
    await setActiveOrder(selectedExistingOrder);
    $("confirmExistingModal").hidden = true;
    selectedExistingOrder = null;
  } catch (error) {
    showToast(error.message || "Não foi possível abrir a comanda.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}
async function saveOrder() {
  if (!activeOrder || !cart.length) return;
  const button = $("saveOrderButton");
  setButtonLoading(button, true, "Salvando pedido...");
  try {
    const payload = cart.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      notes: item.notes
    }));
    await appendItems(activeOrder.id, payload);
    cart = [];
    renderCart();
    await refreshOrderHistory();
    showToast("Pedido lançado com sucesso!");
    $("currentOrderNotice").textContent = "Pedido salvo. Você pode continuar adicionando itens à comanda.";
  } catch (error) {
    showToast(error.message || "Erro ao salvar pedido.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}
async function init() {
  profile = await requireAuth(["admin", "employee"]);
  if (!profile) return;
  $("userName").textContent = profile.full_name;
  $("logoutButton").addEventListener("click", logout);
  showLoading($("productGrid"), "Carregando cardápio...");
  try {
    menu = await getMenu();
    renderCategories();
    renderProducts();
  } catch (error) {
    $("productGrid").innerHTML = `<div class="empty-state">Erro ao carregar cardápio: ${escapeHtml(error.message)}</div>`;
  }
  renderCart();
  supabase.channel("menu-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, async () => {
      try { menu = await getMenu(); renderCategories(); renderProducts(); }
      catch (error) { console.error(error); }
    }).subscribe();
}

let cachedAllOpenOrders = [];

async function openOrderPayment(order) {
  await setActiveOrder(order, false, "edit");
  $("orderWorkspace").hidden = true;
  $("closeOrderPanel").hidden = true;
  $("paymentPanel").hidden = false;
  $("paymentPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAllOpenOrders() {
  const query = $("openOrdersSearch").value.trim().toLocaleLowerCase("pt-BR").replace(/^#/, "");
  const rows = cachedAllOpenOrders.filter(order =>
    order.customer_name.toLocaleLowerCase("pt-BR").includes(query) ||
    String(order.order_number).includes(query)
  );
  if (!rows.length) {
    $("allOpenOrdersList").innerHTML = `<div class="empty-state">Nenhuma comanda aberta encontrada.</div>`;
    return;
  }
  $("allOpenOrdersList").innerHTML = rows.map(order => {
    const itemCount = Number(order.activeItemCount ?? order.item_count ?? 0);
    const receiveAction = order.paymentSummaryAvailable && order.balanceCents > 0 && itemCount > 0
      ? `<button class="btn btn-success btn-compact" type="button" data-global-pay-order="${escapeHtml(order.id)}">Receber pagamento</button>`
      : "";
    const closeAction = order.paymentSummaryAvailable && order.balanceCents === 0 && itemCount > 0
      ? `<button class="btn btn-success btn-compact" type="button" data-global-close-order="${escapeHtml(order.id)}">✓ Fechar comanda</button>`
      : "";

    return `
      <article class="open-order-row">
        <div class="open-order-row-main">
          <div class="order-option-top">
            <strong>Comanda #${escapeHtml(order.order_number)} · ${escapeHtml(order.customer_name)}</strong>
            <span class="status-pill">Aberta</span>
          </div>
          <small>${dateTime(order.opened_at)} · ${itemCount} ${itemCount === 1 ? "unidade" : "unidades"}</small>
          ${renderOrderFinancialSummary(order)}
          ${renderOrderPaymentNote(order)}
        </div>
        <div class="open-order-row-side">
          <div class="open-order-quick-actions">
            <button class="btn btn-secondary btn-compact" type="button" data-global-order="${escapeHtml(order.id)}">Consultar</button>
            ${receiveAction}
            ${closeAction}
          </div>
        </div>
      </article>`;
  }).join("");
}

let allOpenOrdersLoadToken = 0;
async function loadAllOpenOrders() {
  const button = $("refreshOpenOrdersButton");
  const loadToken = ++allOpenOrdersLoadToken;
  setButtonLoading(button, true, "Atualizando...");
  showLoading($("allOpenOrdersList"), "Carregando comandas abertas...");
  $("openOrdersLoadStatus").hidden = true;
  try {
    const orders = await getAllOpenOrders();
    if (loadToken !== allOpenOrdersLoadToken) return;

    // Renderiza os registros imediatamente e consulta os valores pagos em lotes
    // para evitar disparar centenas de RPCs simultaneamente.
    cachedAllOpenOrders = orders.map(order => ({
      ...order,
      activeItemCount: Number(order.item_count || 0),
      paymentSummaryLoading: true,
      paymentSummaryAvailable: false
    }));
    window._openOrders = cachedAllOpenOrders;
    renderAllOpenOrders();

    const batchSize = 8;
    for (let offset = 0; offset < orders.length; offset += batchSize) {
      const batch = orders.slice(offset, offset + batchSize);
      const enrichedBatch = await Promise.all(batch.map(enrichOrderPaymentSummary));
      if (loadToken !== allOpenOrdersLoadToken) return;

      const enrichedById = new Map(enrichedBatch.map(order => [order.id, {
        ...order,
        paymentSummaryLoading: false
      }]));
      cachedAllOpenOrders = cachedAllOpenOrders.map(order => enrichedById.get(order.id) || order);
      window._openOrders = cachedAllOpenOrders;
      renderAllOpenOrders();

      const processed = Math.min(offset + batch.length, orders.length);
      $("openOrdersLoadStatus").textContent = processed < orders.length
        ? `Atualizando resumo financeiro: ${processed} de ${orders.length} comandas...`
        : "Resumo financeiro atualizado.";
      $("openOrdersLoadStatus").hidden = false;
    }

    if (!orders.length) {
      $("allOpenOrdersList").innerHTML = `<div class="empty-state">Nenhuma comanda aberta encontrada.</div>`;
      $("openOrdersLoadStatus").hidden = true;
    } else {
      $("openOrdersLoadStatus").hidden = true;
    }
  } catch (error) {
    if (loadToken !== allOpenOrdersLoadToken) return;
    $("allOpenOrdersList").innerHTML = `<div class="empty-state">Não foi possível carregar as comandas: ${escapeHtml(error.message)}</div>`;
    $("openOrdersLoadStatus").hidden = true;
    showToast("Falha ao carregar comandas abertas.", "error");
  } finally {
    if (loadToken === allOpenOrdersLoadToken) setButtonLoading(button, false);
  }
}

async function closeOpenOrderFromList(order) {
  if (activeOrder && activeOrder.id !== order.id && cart.length) {
    showToast("Finalize ou descarte o pedido atual antes de fechar outra comanda.", "error");
    return;
  }
  $("openOrdersModal").hidden = true;
  cart = [];
  renderCart();
  await setActiveOrder(order, false, "view");
  await closeActiveOrder();
}
async function openAllOrdersModal() {
  $("openOrdersModal").hidden = false;
  $("openOrdersSearch").value = "";
  await loadAllOpenOrders();
}
$("openOrdersButton").addEventListener("click", openAllOrdersModal);
$("closeOpenOrdersModal").addEventListener("click", () => $("openOrdersModal").hidden = true);
$("refreshOpenOrdersButton").addEventListener("click", loadAllOpenOrders);
$("openOrdersSearch").addEventListener("input", renderAllOpenOrders);
$("allOpenOrdersList").addEventListener("click", event => {
  const payButton = event.target.closest("[data-global-pay-order]");
  const closeButton = event.target.closest("[data-global-close-order]");
  const viewButton = event.target.closest("[data-global-order]");
  const id = payButton?.dataset.globalPayOrder || closeButton?.dataset.globalCloseOrder || viewButton?.dataset.globalOrder;
  if (!id) return;
  const order = cachedAllOpenOrders.find(item => item.id === id);
  if (!order) return;
  const action = closeButton
    ? closeOpenOrderFromList(order)
    : (async () => {
        $("openOrdersModal").hidden = true;
        if (payButton) await openOrderPayment(order);
        else await setActiveOrder(order, false, "view");
      })();
  action.catch(error => showToast(error.message || "Não foi possível abrir a comanda.", "error"));
});

$("searchCustomerButton").addEventListener("click", searchCustomer);
$("customerName").addEventListener("keydown", event => {
  if (event.key === "Enter") searchCustomer();
});
async function updateCustomerSuggestions() {
  const query = $("customerName").value.trim();
  const box = $("customerSuggestions");
  if (query.length < 1) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.innerHTML = `<div class="autocomplete-empty"><span class="spinner"></span> Buscando clientes...</div>`;
  box.hidden = false;
  try {
    const suggestions = await getOpenOrderNameSuggestions(query);
    // Ignore stale responses if the user has typed further while the query was running.
    if ($("customerName").value.trim() !== query) return;
    if (!suggestions.length) {
      box.innerHTML = `<div class="autocomplete-empty">Nenhuma comanda aberta com essas iniciais.</div>`;
      box.hidden = false;
      return;
    }
    box.innerHTML = suggestions.map(item => `
      <button class="autocomplete-option" type="button" role="option" data-suggest-name="${escapeHtml(item.customer_name)}">
        <span><strong>${escapeHtml(item.customer_name)}</strong><small>${item.open_order_count} comanda(s) aberta(s)</small></span>
        <span class="autocomplete-arrow">↵</span>
      </button>`).join("");
    box.hidden = false;
  } catch (error) {
    box.hidden = true;
    console.error("Falha nas sugestões de clientes:", error);
  }
}
$("customerName").addEventListener("input", () => {
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(updateCustomerSuggestions, 220);
});
$("customerSuggestions").addEventListener("click", event => {
  const option = event.target.closest("[data-suggest-name]");
  if (!option) return;
  $("customerName").value = option.dataset.suggestName;
  $("customerSuggestions").hidden = true;
  searchCustomer();
});
document.addEventListener("click", event => {
  if (!event.target.closest(".customer-autocomplete")) $("customerSuggestions").hidden = true;
});
$("openOrdersList").addEventListener("click", event => {
  const payButton = event.target.closest("[data-pay-order]");
  const closeButton = event.target.closest("[data-close-order]");
  if (payButton || closeButton) {
    const id = payButton?.dataset.payOrder || closeButton?.dataset.closeOrder;
    const order = lastSearchMatches.find(item => item.id === id);
    if (!order) return;
    const action = closeButton ? closeOpenOrderFromList(order) : openOrderPayment(order);
    action.catch(error => showToast(error.message || "Não foi possível abrir a comanda.", "error"));
    return;
  }
  const button = event.target.closest("[data-order]");
  if (!button) return;
  chooseExistingOrder(button.dataset.order);
});
$("cancelDuplicateNameButton").addEventListener("click", () => {
  $("duplicateNameModal").hidden = true;
  pendingNewCustomerName = "";
});
$("confirmDuplicateNameButton").addEventListener("click", confirmDistinctCustomerName);
$("distinctCustomerName").addEventListener("keydown", event => {
  if (event.key === "Enter") $("confirmDuplicateNameButton").click();
});
$("startNewAttendanceButton").addEventListener("click", startNewAttendance);
$("confirmNewOrderButton").addEventListener("click", confirmNewOrder);
$("newCustomerNameInput").addEventListener("keydown", event => {
  if (event.key === "Enter") confirmNewOrder();
});
const closeNewAttendanceModal = () => {
  $("newOrderModal").hidden = true;
  pendingNewCustomerName = "";
  $("startNewAttendanceButton").focus();
};
$("cancelNewOrderButton").addEventListener("click", closeNewAttendanceModal);
$("closeNewOrderModalButton").addEventListener("click", closeNewAttendanceModal);
$("confirmExistingButton").addEventListener("click", confirmExistingOrder);
$("cancelExistingButton").addEventListener("click", () => $("confirmExistingModal").hidden = true);
$("categoryTabs").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  renderCategories();
  renderProducts();
});
$("productGrid").addEventListener("error", event => {
  const image = event.target.closest?.(".product-card-media img");
  if (image) image.closest(".product-card-media")?.classList.add("is-empty");
}, true);

$("productGrid").addEventListener("click", event => {
  const button = event.target.closest("[data-product]");
  if (!button) return;
  const product = menu.flatMap(category => category.products).find(item => item.id === button.dataset.product);
  if (product) addProduct(product);
});
$("cartItems").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const item = cart[Number(button.dataset.index)];
  if (!item) return;
  if (button.dataset.action === "plus") item.quantity += 1;
  if (button.dataset.action === "minus") item.quantity = Math.max(1, item.quantity - 1);
  if (button.dataset.action === "remove") cart.splice(Number(button.dataset.index), 1);
  renderCart();
  if (activeOrder) renderPaymentPanel();
});
$("saveOrderButton").addEventListener("click", saveOrder);
$("paymentItemList").addEventListener("change", updatePaymentPreview);
$("splitCount").addEventListener("input", updatePaymentPreview);
$("receivePaymentButton").addEventListener("click", submitPayment);
$("closeOrderButton").addEventListener("click", closeActiveOrder);
$("cancelEmptyOrderButton").addEventListener("click", cancelActiveEmptyOrder);
$("cancelCloseOrderButton").addEventListener("click", () => $("closeOrderConfirmModal").hidden = true);
$("confirmCloseOrderButton").addEventListener("click", confirmCloseActiveOrder);
$("changeOrderButton").addEventListener("click", clearActiveOrder);
$("addProductsFromView").addEventListener("click", () => {
  if (!activeOrder || activeOrder.status !== "open") return;
  orderViewMode = "edit";
  $("orderWorkspace").hidden = false;
  $("paymentPanel").hidden = false;
  $("closeOrderPanel").hidden = false;
  $("addProductsFromView").hidden = true;
  $("currentOrderNotice").textContent = "Comanda selecionada. Os novos itens serão adicionados a ela.";
  renderCart();
  renderPaymentPanel();
  $("orderWorkspace").scrollIntoView({ behavior: "smooth", block: "start" });
});
init();

$("openOrdersModal").addEventListener("click", event => {
  if (event.target === $("openOrdersModal")) $("openOrdersModal").hidden = true;
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    $("openOrdersModal").hidden = true;
    $("newOrderModal").hidden = true;
    $("duplicateNameModal").hidden = true;
    pendingNewCustomerName = "";
    $("confirmExistingModal").hidden = true;
    $("closeOrderConfirmModal").hidden = true;
  }
});
