import { supabase } from "./supabaseClient.js";
import { requireAuth } from "./guards.js";

const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 100;
const state = {
  filters: null,
  page: 1,
  pageSize: PAGE_SIZE,
  totalRows: 0,
  loading: false,
  requestToken: 0,
  toastTimer: null
};

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function integer(value) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
function quantity(value) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function statusLabel(status) {
  return ({ paid: "Pago", pending: "Pendente", partially_paid: "Parcialmente pago", cancelled: "Cancelado" })[status] || "Pendente";
}
function statusClass(status) {
  return ({ paid: "paid", pending: "pending", partially_paid: "partial", cancelled: "cancelled" })[status] || "pending";
}
function showToast(message, error = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = `toast${error ? " error" : " success"}`;
  toast.setAttribute("role", error ? "alert" : "status");
  toast.setAttribute("aria-live", error ? "assertive" : "polite");
  toast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}
function resetSummary() {
  $("reportTotalPaid").textContent = money(0);
  $("reportTotalPending").textContent = money(0);
  $("reportPaidCount").textContent = "0";
  $("reportPendingCount").textContent = "0";
}
function renderSummary(summary = {}) {
  $("reportTotalPaid").textContent = money(summary.total_paid);
  $("reportTotalPending").textContent = money(summary.total_pending);
  $("reportPaidCount").textContent = integer(summary.paid_item_count);
  $("reportPendingCount").textContent = integer(summary.pending_item_count);
}
function renderEmptyRow(message) {
  $("reportTableBody").innerHTML = `<tr><td class="reports-table-empty" colspan="7">${escapeHtml(message)}</td></tr>`;
}
function renderRows(rows) {
  if (!rows.length) {
    renderEmptyRow("Nenhum lançamento encontrado para os filtros selecionados.");
    return;
  }

  $("reportTableBody").innerHTML = rows.map(row => `
    <tr>
      <td class="reports-date-cell">${escapeHtml(dateTime(row.created_at))}</td>
      <td class="reports-order-cell"><strong>${escapeHtml(`#${row.order_number} · ${row.customer_name || "Cliente não identificado"}`)}</strong></td>
      <td class="reports-product-cell">${escapeHtml(row.product_name || "Produto")}</td>
      <td class="reports-number-cell">${escapeHtml(quantity(row.quantity))}</td>
      <td class="reports-number-cell">${escapeHtml(money(row.unit_price))}</td>
      <td class="reports-number-cell reports-total-cell">${escapeHtml(money(row.subtotal))}</td>
      <td><span class="report-status report-status-${statusClass(row.payment_status)}">${escapeHtml(statusLabel(row.payment_status))}</span></td>
    </tr>`).join("");
}
function renderPagination() {
  const pages = Math.max(1, Math.ceil(state.totalRows / state.pageSize));
  const pagination = $("reportPagination");
  pagination.hidden = state.totalRows <= state.pageSize;
  $("reportPaginationInfo").textContent = `Página ${state.page} de ${pages} · ${integer(state.totalRows)} lançamentos`;
  $("reportPrevPage").disabled = state.loading || state.page <= 1;
  $("reportNextPage").disabled = state.loading || state.page >= pages;
}
function setLoading(loading) {
  state.loading = loading;
  const button = $("applyReportFilters");
  button.disabled = loading;
  button.innerHTML = loading
    ? '<span class="spinner reports-button-spinner" aria-hidden="true"></span>Consultando...'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M7 12h10m-7 7h4"/></svg>Filtrar relatório';
  $("reportPrevPage").disabled = loading || state.page <= 1;
  $("reportNextPage").disabled = loading || state.page >= Math.ceil(state.totalRows / state.pageSize);
}
function formatPeriod(from, to) {
  const format = value => {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };
  return `${format(from)} a ${format(to)}`;
}
async function loadReport() {
  if (!state.filters) return;
  const requestToken = ++state.requestToken;
  setLoading(true);
  $("reportResultsLabel").textContent = "Consultando lançamentos...";
  try {
    const { data, error } = await supabase.rpc("get_order_item_report", {
      p_date_from: state.filters.dateFrom,
      p_date_to: state.filters.dateTo,
      p_status: state.filters.status,
      p_page: state.page,
      p_page_size: state.pageSize
    });
    if (error) throw error;
    if (requestToken !== state.requestToken) return;
    const result = data || {};
    const rows = Array.isArray(result.rows) ? result.rows : [];
    state.totalRows = Number(result.total_rows || 0);
    renderSummary(result.summary || {});
    renderRows(rows);
    $("reportResultsLabel").textContent = `${integer(state.totalRows)} ${state.totalRows === 1 ? "lançamento encontrado" : "lançamentos encontrados"}`;
    $("reportPeriodLabel").textContent = formatPeriod(state.filters.dateFrom, state.filters.dateTo);
    renderPagination();
  } catch (error) {
    if (requestToken !== state.requestToken) return;
    console.error("Falha ao carregar relatório:", error);
    state.totalRows = 0;
    resetSummary();
    $("reportResultsLabel").textContent = "Não foi possível carregar o relatório.";
    $("reportPeriodLabel").textContent = "Falha na consulta";
    renderEmptyRow("Não foi possível consultar os lançamentos. Confira se a migration 014 foi executada e tente novamente.");
    showToast(error.message || "Falha ao consultar relatório.", true);
  } finally {
    if (requestToken === state.requestToken) {
      setLoading(false);
      renderPagination();
    }
  }
}
function validateFilters() {
  const dateFrom = $("reportDateFrom").value;
  const dateTo = $("reportDateTo").value;
  if (!dateFrom || !dateTo) {
    showToast("Informe as datas inicial e final para gerar o relatório.", true);
    (!dateFrom ? $("reportDateFrom") : $("reportDateTo")).focus();
    return null;
  }
  if (dateTo < dateFrom) {
    showToast("A data final não pode ser anterior à data inicial.", true);
    $("reportDateTo").focus();
    return null;
  }
  return { dateFrom, dateTo, status: $("reportStatus").value || "all" };
}
function clearReport() {
  state.requestToken += 1;
  state.loading = false;
  setLoading(false);
  state.filters = null;
  state.page = 1;
  state.totalRows = 0;
  $("reportDateFrom").value = "";
  $("reportDateTo").value = "";
  $("reportDateFrom").removeAttribute("max");
  $("reportDateTo").removeAttribute("min");
  $("reportStatus").value = "all";
  resetSummary();
  $("reportResultsLabel").textContent = "Aplique um período para visualizar os lançamentos.";
  $("reportPeriodLabel").textContent = "Nenhum período selecionado";
  renderEmptyRow("Informe as datas inicial e final e clique em “Filtrar relatório”.");
  $("reportPagination").hidden = true;
}
function bindEvents() {
  $("reportFiltersForm").addEventListener("submit", event => {
    event.preventDefault();
    const filters = validateFilters();
    if (!filters) return;
    state.filters = filters;
    state.page = 1;
    loadReport();
  });
  $("clearReportFilters").addEventListener("click", clearReport);
  $("reportPrevPage").addEventListener("click", () => {
    if (!state.filters || state.page <= 1 || state.loading) return;
    state.page -= 1;
    loadReport();
  });
  $("reportNextPage").addEventListener("click", () => {
    const pages = Math.ceil(state.totalRows / state.pageSize);
    if (!state.filters || state.page >= pages || state.loading) return;
    state.page += 1;
    loadReport();
  });
  const syncDateBounds = () => {
    const from = $("reportDateFrom").value;
    const to = $("reportDateTo").value;
    $("reportDateTo").min = from || "";
    $("reportDateFrom").max = to || "";
  };
  $("reportDateFrom").addEventListener("change", syncDateBounds);
  $("reportDateTo").addEventListener("change", syncDateBounds);
}

const profile = await requireAuth(["admin"]);
if (profile) {
  $("userName").textContent = profile.full_name || "";
  resetSummary();
  bindEvents();
}
