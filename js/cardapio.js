import { supabase } from "./supabaseClient.js";
import { requireAuth, logout } from "./guards.js";
import { mostrarModal } from "./utils.js";

const $ = id => document.getElementById(id);
let profile = null;
let categories = [];
let products = [];
let selectedCategoryId = "all";
let toastTimer = null;
let selectedProductImage = null;
let removeExistingProductImage = false;
let previewObjectUrl = null;
let modalPreviousFocus = null;
let previousBodyOverflow = "";
const IMAGE_BUCKET = "menu-product-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
})[c]);

function toast(message, error = false) {
  const el = $("toast");
  el.textContent = message;
  el.className = `toast${error ? " error" : " success"}`;
  el.setAttribute("role", error ? "alert" : "status");
  el.setAttribute("aria-live", error ? "assertive" : "polite");
  el.setAttribute("aria-atomic", "true");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}
function setLoading(button, loading, text) {
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
    button.innerHTML = `<span class="button-loading-spinner" aria-hidden="true"></span><span>${escapeHtml(text || "Salvando...")}</span>`;
  } else {
    if (button.dataset.loading !== "true") return;
    button.innerHTML = button.dataset.originalHtml || button.innerHTML;
    delete button.dataset.originalHtml;
    delete button.dataset.loading;
    button.style.removeProperty("--button-loading-width");
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.classList.remove("is-loading");
  }
}
function focusableElements(container) {
  return [...container.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}
function openModal(id) {
  const overlay = $(id);
  if (!overlay) return;
  modalPreviousFocus = document.activeElement;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  overlay.hidden = false;
  requestAnimationFrame(() => {
    const firstField = focusableElements(overlay)[0];
    (firstField || overlay.querySelector('[role="dialog"]'))?.focus();
  });
}
function clearProductPreviewObjectUrl() {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
}
function closeModal(id) {
  const overlay = $(id);
  if (!overlay) return;
  overlay.hidden = true;
  document.body.style.overflow = previousBodyOverflow;
  if (id === "productModal") {
    clearProductPreviewObjectUrl();
    selectedProductImage = null;
    removeExistingProductImage = false;
  }
  if (modalPreviousFocus?.isConnected) modalPreviousFocus.focus();
  modalPreviousFocus = null;
}

async function confirmDuplicateProduct(productName) {
  return mostrarModal(
    "Produto com nome repetido",
    `Já existe “${productName}” nesta categoria. Deseja manter os dois cadastros? Essa decisão não altera os produtos já lançados nas comandas.`,
    async () => true
  );
}


async function loadMenuData() {
  $("categoryList").innerHTML = `<div class="loading"><span class="spinner"></span>Carregando...</div>`;
  $("adminProductList").innerHTML = `<div class="loading"><span class="spinner"></span>Carregando produtos...</div>`;
  try {
    const [{ data: categoryRows, error: categoryError }, { data: productRows, error: productError }] = await Promise.all([
      supabase.from("categories").select("id,name,description,active,display_order").order("display_order", { ascending: true }),
      supabase.from("products").select("id,category_id,name,description,price,image_url,active,available,display_order").order("display_order", { ascending: true })
    ]);
    if (categoryError) throw categoryError;
    if (productError) throw productError;
    categories = categoryRows || [];
    products = productRows || [];
    if (selectedCategoryId !== "all" && !categories.some(c => c.id === selectedCategoryId)) selectedCategoryId = "all";
    renderSummary();
    renderWaiterView();
    renderCategories();
    renderProductCategoryOptions();
    renderProducts();
  } catch (error) {
    $("categoryList").innerHTML = `<div class="empty-state">Não foi possível carregar as categorias.</div>`;
    $("adminProductList").innerHTML = `<div class="empty-state">Erro ao consultar o cardápio: ${escapeHtml(error.message)}</div>`;
    toast("Confira a migration 008 e as permissões administrativas do Supabase.", true);
  }
}

function renderSummary() {
  $("activeCategoryCount").textContent = categories.filter(c => c.active).length;
  $("activeProductCount").textContent = products.filter(p => p.active).length;
  $("unavailableProductCount").textContent = products.filter(p => p.active && !p.available).length;
}
function renderCategories() {
  const activeCount = products.filter(p => p.active).length;
  const allButton = `
    <button type="button" class="admin-category-item admin-category-all ${selectedCategoryId === "all" ? "selected" : ""}" data-category="all" aria-pressed="${selectedCategoryId === "all"}">
      <span class="admin-category-copy"><strong>Todos os produtos</strong><small>Visão completa do cardápio</small></span>
      <span class="admin-category-count">${activeCount}</span>
    </button>`;
  const rows = categories.map(category => {
    const count = products.filter(p => p.category_id === category.id && p.active).length;
    const state = category.active ? "Ativa" : "Inativa";
    return `
      <div class="admin-category-wrap ${selectedCategoryId === category.id ? "is-selected" : ""}">
        <button type="button" class="admin-category-item ${selectedCategoryId === category.id ? "selected" : ""}" data-category="${category.id}" aria-pressed="${selectedCategoryId === category.id}">
          <span class="admin-category-copy"><strong>${escapeHtml(category.name)}</strong><small>${state} · ${count} produto(s) ativo(s)</small></span>
          <span class="admin-category-count">${count}</span>
        </button>
        <button type="button" class="category-edit-link" data-edit-category="${category.id}" aria-label="Editar categoria ${escapeHtml(category.name)}">
          <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"/></svg></span>
          Editar categoria
        </button>
      </div>`;
  }).join("");
  const empty = categories.length ? "" : `<div class="menu-empty-hint"><span class="menu-empty-icon" aria-hidden="true">＋</span><strong>Nenhuma categoria cadastrada</strong><small>Crie uma categoria para começar a organizar o cardápio.</small></div>`;
  $("categoryList").innerHTML = allButton + rows + empty;
}
function renderProductCategoryOptions(selectedId = "") {
  const activeCategories = categories.filter(c => c.active);
  const selectedInactive = selectedId ? categories.find(c => c.id === selectedId && !c.active) : null;
  const options = activeCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`);
  if (selectedInactive) options.unshift(`<option value="${selectedInactive.id}">${escapeHtml(selectedInactive.name)} · inativa (categoria atual)</option>`);
  $("productCategory").innerHTML = options.length ? options.join("") : `<option value="">Nenhuma categoria ativa</option>`;
  $("productCategory").value = selectedId && (activeCategories.some(c => c.id === selectedId) || selectedInactive) ? selectedId : "";
}
function productFilteredRows() {
  const query = $("productSearch").value.trim().toLocaleLowerCase("pt-BR");
  const status = $("productStatusFilter").value;
  return products.filter(product => {
    if (selectedCategoryId !== "all" && product.category_id !== selectedCategoryId) return false;
    if (query && !`${product.name} ${product.description || ""}`.toLocaleLowerCase("pt-BR").includes(query)) return false;
    if (status === "active" && !product.active) return false;
    if (status === "inactive" && product.active) return false;
    if (status === "unavailable" && (!product.active || product.available)) return false;
    return true;
  }).sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0) || a.name.localeCompare(b.name, "pt-BR"));
}
function bindImageFallbacks(container) {
  container.querySelectorAll("img[data-menu-image]").forEach(image => {
    image.addEventListener("error", () => {
      image.hidden = true;
      const media = image.closest(".admin-product-image, .waiter-product-media");
      if (!media) return;
      media.classList.add("is-empty");
      media.insertAdjacentHTML("beforeend", `<span class="${media.classList.contains("waiter-product-media") ? "waiter-product-placeholder" : "admin-product-placeholder"}" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg></span>`);
    }, { once: true });
  });
}
function renderProducts() {
  const category = categories.find(c => c.id === selectedCategoryId);
  $("productsHeading").textContent = category ? category.name : "Todos os produtos";
  $("productsSubheading").textContent = category
    ? (category.description || `${products.filter(p => p.category_id === category.id).length} produto(s) nesta categoria.`)
    : "Visualize e gerencie todos os produtos do cardápio.";
  const rows = productFilteredRows();
  const totalLabel = rows.length === 1 ? "1 produto" : `${rows.length} produtos`;
  $("productResultCount").textContent = totalLabel;
  if (!rows.length) {
    const searched = $("productSearch").value.trim();
    $("adminProductList").innerHTML = `
      <div class="menu-empty-state">
        <span class="menu-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg></span>
        <strong>${searched ? "Nenhum produto encontrado" : "Não há produtos nesta visualização"}</strong>
        <span>${searched ? "Tente outro termo ou altere o filtro de situação." : "Cadastre um produto ou escolha outro filtro para visualizar o cardápio."}</span>
        ${!searched && $("productStatusFilter").value === "active" ? `<button class="btn btn-primary btn-compact" type="button" data-empty-new-product>Adicionar produto</button>` : ""}
      </div>`;
    return;
  }
  $("adminProductList").innerHTML = rows.map(product => {
    const categoryName = categories.find(c => c.id === product.category_id)?.name || "Sem categoria";
    const status = !product.active
      ? `<span class="admin-status cancelled"><span class="menu-status-dot"></span>Inativo</span>`
      : product.available
        ? `<span class="admin-status closed"><span class="menu-status-dot"></span>Disponível</span>`
        : `<span class="admin-status open"><span class="menu-status-dot"></span>Indisponível</span>`;
    const image = product.image_url
      ? `<img data-menu-image src="${escapeHtml(product.image_url)}" alt="Foto de ${escapeHtml(product.name)}" loading="lazy">`
      : `<span class="admin-product-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg></span>`;
    const toggleLabel = !product.active ? "Ativar produto" : product.available ? "Indisponibilizar" : "Disponibilizar";
    const toggleIcon = product.active && product.available
      ? `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 8.5 7 7m0-7-7 7"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7"/></svg>`;
    return `
      <article class="admin-product-row">
        <div class="admin-product-image ${product.image_url ? "has-image" : "is-empty"}">${image}</div>
        <div class="admin-product-main">
          <div class="admin-product-title-row"><strong>${escapeHtml(product.name)}</strong>${status}</div>
          <span class="admin-product-category">${escapeHtml(categoryName)}</span>
          ${product.description ? `<p>${escapeHtml(product.description)}</p>` : `<p class="admin-product-no-description">Sem descrição cadastrada.</p>`}
          <strong class="admin-product-price">${money(product.price)}</strong>
        </div>
        <div class="admin-product-actions">
          <button class="btn btn-secondary btn-compact" type="button" data-edit-product="${product.id}">
            <span class="button-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"/></svg></span><span>Editar</span>
          </button>
          <button class="btn btn-compact ${product.active && product.available ? "btn-availability-off" : "btn-availability-on"}" type="button" data-toggle-availability="${product.id}" aria-label="${toggleLabel}: ${escapeHtml(product.name)}">
            <span class="button-icon" aria-hidden="true">${toggleIcon}</span><span>${toggleLabel}</span>
          </button>
        </div>
      </article>`;
  }).join("");
  bindImageFallbacks($("adminProductList"));
}

function renderWaiterView() {
  const activeCategories = categories.filter(category => category.active);
  if (selectedCategoryId !== "all" && !activeCategories.some(category => category.id === selectedCategoryId)) selectedCategoryId = "all";
  const categoryTabs = [
    `<button type="button" class="${selectedCategoryId === "all" ? "active" : ""}" data-waiter-category="all" aria-pressed="${selectedCategoryId === "all"}">Todas</button>`,
    ...activeCategories.map(category => `<button type="button" class="${selectedCategoryId === category.id ? "active" : ""}" data-waiter-category="${category.id}" aria-pressed="${selectedCategoryId === category.id}">${escapeHtml(category.name)}</button>`)
  ].join("");
  $("waiterCategoryTabs").innerHTML = categoryTabs;
  const query = ($("waiterProductSearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
  const rows = products.filter(product => {
    if (!product.active || !product.available) return false;
    if (!activeCategories.some(category => category.id === product.category_id)) return false;
    if (selectedCategoryId !== "all" && product.category_id !== selectedCategoryId) return false;
    return !query || `${product.name} ${product.description || ""}`.toLocaleLowerCase("pt-BR").includes(query);
  }).sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0) || a.name.localeCompare(b.name, "pt-BR"));
  $("waiterProductGrid").innerHTML = rows.length ? rows.map(product => {
    const categoryName = activeCategories.find(category => category.id === product.category_id)?.name || "";
    const image = product.image_url
      ? `<img data-menu-image src="${escapeHtml(product.image_url)}" alt="Foto de ${escapeHtml(product.name)}" loading="lazy">`
      : `<span class="waiter-product-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg></span>`;
    return `<article class="waiter-product-card"><div class="waiter-product-media ${product.image_url ? "has-image" : "is-empty"}">${image}</div><span class="waiter-product-category">${escapeHtml(categoryName)}</span><strong>${escapeHtml(product.name)}</strong>${product.description ? `<p>${escapeHtml(product.description)}</p>` : ""}<span class="waiter-product-price">${money(product.price)}</span></article>`;
  }).join("") : `<div class="menu-empty-state"><span class="menu-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg></span><strong>Nenhum produto disponível</strong><span>Não encontramos produtos ativos para esta categoria ou busca.</span></div>`;
  bindImageFallbacks($("waiterProductGrid"));
}

function resetCategoryForm() {
  $("categoryForm").reset();
  $("categoryId").value = "";
  $("categoryModalTitle").textContent = "Nova categoria";
  $("categoryOrder").value = String(categories.length * 10);
  $("categoryActive").checked = true;
}
function editCategory(id) {
  const category = categories.find(c => c.id === id);
  if (!category) return;
  $("categoryId").value = category.id;
  $("categoryName").value = category.name || "";
  $("categoryDescription").value = category.description || "";
  $("categoryOrder").value = category.display_order ?? 0;
  $("categoryActive").checked = Boolean(category.active);
  $("categoryModalTitle").textContent = "Editar categoria";
  openModal("categoryModal");
}
function resetProductForm() {
  $("productForm").reset();
  $("productId").value = "";
  $("productModalTitle").textContent = "Novo produto";
  $("productActive").checked = true;
  $("productAvailable").checked = true;
  $("productOrder").value = String(products.length * 10);
  clearProductPreviewObjectUrl();
  selectedProductImage = null;
  removeExistingProductImage = false;
  $("productImageFile").value = "";
  $("productImageFileName").textContent = "Nenhuma foto selecionada";
  $("productImageUrl").value = "";
  $("productImageUrl").closest("details").open = false;
  renderProductImagePreview("");
  const selectedActiveCategory = categories.find(category => category.id === selectedCategoryId && category.active);
  renderProductCategoryOptions(selectedActiveCategory?.id || "");
}
function editProduct(id) {
  const p = products.find(item => item.id === id);
  if (!p) return;
  renderProductCategoryOptions(p.category_id);
  $("productId").value = p.id;
  $("productCategory").value = p.category_id;
  $("productName").value = p.name || "";
  $("productDescription").value = p.description || "";
  $("productPrice").value = Number(p.price).toFixed(2);
  $("productOrder").value = p.display_order ?? 0;
  $("productImageUrl").value = p.image_url || "";
  selectedProductImage = null;
  removeExistingProductImage = false;
  clearProductPreviewObjectUrl();
  $("productImageFile").value = "";
  $("productImageFileName").textContent = p.image_url ? "Foto atual do produto" : "Nenhuma foto selecionada";
  $("productImageUrl").closest("details").open = Boolean(p.image_url);
  renderProductImagePreview(p.image_url || "");
  $("productActive").checked = Boolean(p.active);
  $("productAvailable").checked = Boolean(p.available);
  $("productModalTitle").textContent = "Editar produto";
  openModal("productModal");
}

async function saveCategory(event) {
  event.preventDefault();
  const id = $("categoryId").value;
  const payload = {
    name: $("categoryName").value.trim(),
    description: $("categoryDescription").value.trim() || null,
    display_order: Math.max(0, Number.parseInt($("categoryOrder").value || "0", 10)),
    active: $("categoryActive").checked
  };
  if (!payload.name) return toast("Informe o nome da categoria.", true);
  const button = $("saveCategoryButton");
  setLoading(button, true);
  try {
    const query = id
      ? supabase.from("categories").update(payload).eq("id", id)
      : supabase.from("categories").insert(payload);
    const { error } = await query;
    if (error) throw error;
    closeModal("categoryModal");
    await loadMenuData();
    toast(id ? "Categoria atualizada." : "Categoria criada.");
  } catch (error) {
    toast(`Não foi possível salvar a categoria: ${error.message}`, true);
  } finally { setLoading(button, false); }
}
function renderProductImagePreview(url) {
  const preview = $("productImagePreview");
  if (!preview) return;
  preview.replaceChildren();
  preview.classList.toggle("has-image", Boolean(url));
  if (!url) {
    preview.innerHTML = `<span class="menu-image-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>Prévia da foto</span>`;
    return;
  }
  const image = document.createElement("img");
  image.src = url;
  image.alt = "Prévia da foto do produto";
  image.addEventListener("error", () => {
    preview.classList.remove("has-image");
    preview.innerHTML = `<span class="menu-image-placeholder menu-image-error">Não foi possível carregar a imagem</span>`;
  }, { once: true });
  preview.append(image);
}

async function uploadProductImage(file, productId) {
  if (!file) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Formato inválido. Utilize JPG, PNG ou WebP.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("A foto deve ter no máximo 5 MB.");
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
  const path = `${productId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: file.type
  });
  if (error) throw error;
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function saveProduct(event) {
  event.preventDefault();
  const id = $("productId").value;
  const price = Number($("productPrice").value);
  if (!Number.isFinite(price) || price < 0) return toast("Informe um preço válido.", true);
  const payload = {
    category_id: $("productCategory").value,
    name: $("productName").value.trim(),
    description: $("productDescription").value.trim() || null,
    price: Math.round(price * 100) / 100,
    display_order: Math.max(0, Number.parseInt($("productOrder").value || "0", 10)),
    image_url: $("productImageUrl").value.trim() || null,
    active: $("productActive").checked,
    available: $("productAvailable").checked
  };
  if (!payload.category_id) return toast("Cadastre ou ative uma categoria antes de criar produtos.", true);
  if (!payload.name) return toast("Informe o nome do produto.", true);
  const duplicate = products.find(p => p.id !== id && p.active && p.category_id === payload.category_id &&
    p.name.trim().toLocaleLowerCase("pt-BR") === payload.name.toLocaleLowerCase("pt-BR"));
  if (duplicate && !(await confirmDuplicateProduct(duplicate.name))) return;
  const button = $("saveProductButton");
  setLoading(button, true, selectedProductImage ? "Enviando foto e salvando..." : "Salvando produto...");
  try {
    const productId = id || crypto.randomUUID();
    if (selectedProductImage) payload.image_url = await uploadProductImage(selectedProductImage, productId);
    else if (removeExistingProductImage) payload.image_url = null;
    const query = id
      ? supabase.from("products").update(payload).eq("id", id)
      : supabase.from("products").insert({ id: productId, ...payload });
    const { error } = await query;
    if (error) throw error;
    closeModal("productModal");
    await loadMenuData();
    toast(id ? "Produto atualizado." : "Produto cadastrado.");
  } catch (error) {
    toast(`Não foi possível salvar o produto: ${error.message}`, true);
  } finally { setLoading(button, false); }
}
async function toggleAvailability(id, button) {
  const product = products.find(p => p.id === id);
  if (!product || !button) return;
  const payload = !product.active
    ? { active: true, available: true }
    : { available: !product.available };
  setLoading(button, true, "Atualizando...");
  try {
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) throw error;
    await loadMenuData();
    toast(!product.active ? "Produto ativado e disponível." : payload.available ? "Produto disponível para pedidos." : "Produto marcado como indisponível.");
  } catch (error) {
    toast(`Não foi possível atualizar: ${error.message}`, true);
  } finally {
    setLoading(button, false);
  }
}

function toggleModoAdmin() {
  const adminView = $("adminView");
  const waiterView = $("waiterView");
  const button = $("toggleAdminModeButton");
  const showingWaiter = !waiterView.hidden;
  adminView.hidden = !showingWaiter;
  waiterView.hidden = showingWaiter;
  button.querySelector("span:last-child").textContent = showingWaiter ? "Ver modo garçom" : "Ver modo administrador";
  button.setAttribute("aria-pressed", String(!showingWaiter));
  $("newProductButton").hidden = !showingWaiter;
  if (showingWaiter) {
    document.querySelector(".menu-admin-page .page-heading h1").textContent = "Gestão do cardápio";
    document.querySelector(".menu-eyebrow").textContent = "ADMINISTRAÇÃO · CARDÁPIO";
  } else {
    document.querySelector(".menu-admin-page .page-heading h1").textContent = "Consulta do cardápio";
    document.querySelector(".menu-eyebrow").textContent = "VISUALIZAÇÃO · CARDÁPIO";
    renderWaiterView();
  }
}
window.toggleModoAdmin = toggleModoAdmin;

function bindEvents() {
  $("logoutButton").addEventListener("click", logout);
  $("toggleAdminModeButton").addEventListener("click", toggleModoAdmin);
  $("waiterProductSearch").addEventListener("input", renderWaiterView);
  $("waiterCategoryTabs").addEventListener("click", event => {
    const button = event.target.closest("[data-waiter-category]");
    if (!button) return;
    selectedCategoryId = button.dataset.waiterCategory;
    renderWaiterView();
  });
  $("newCategoryButton").addEventListener("click", () => { resetCategoryForm(); openModal("categoryModal"); });
  $("newProductButton").addEventListener("click", () => {
    if (!categories.some(c => c.active)) {
      toast("Cadastre ou ative uma categoria antes de cadastrar produtos.", true);
      resetCategoryForm(); openModal("categoryModal"); return;
    }
    resetProductForm(); openModal("productModal");
  });
  $("categoryForm").addEventListener("submit", saveCategory);
  $("productForm").addEventListener("submit", saveProduct);
  $("productImageFile").addEventListener("change", event => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast("Formato inválido. Utilize JPG, PNG ou WebP.", true); event.target.value = ""; return; }
    if (file.size > MAX_IMAGE_SIZE) { toast("A foto deve ter no máximo 5 MB.", true); event.target.value = ""; return; }
    clearProductPreviewObjectUrl();
    selectedProductImage = file;
    removeExistingProductImage = false;
    $("productImageUrl").value = "";
    $("productImageUrl").closest("details").open = false;
    $("productImageFileName").textContent = file.name;
    previewObjectUrl = URL.createObjectURL(file);
    renderProductImagePreview(previewObjectUrl);
  });
  $("removeProductImageButton").addEventListener("click", () => {
    selectedProductImage = null;
    removeExistingProductImage = true;
    clearProductPreviewObjectUrl();
    $("productImageFile").value = "";
    $("productImageFileName").textContent = "Foto removida do cadastro";
    $("productImageUrl").value = "";
    $("productImageUrl").closest("details").open = false;
    renderProductImagePreview("");
  });
  $("productImageUrl").addEventListener("input", () => {
    if ($("productImageUrl").value.trim()) {
      selectedProductImage = null;
      removeExistingProductImage = false;
      clearProductPreviewObjectUrl();
      $("productImageFile").value = "";
      $("productImageFileName").textContent = "Endereço de imagem informado";
      renderProductImagePreview($("productImageUrl").value.trim());
    }
  });
  $("productSearch").addEventListener("input", renderProducts);
  $("productStatusFilter").addEventListener("change", renderProducts);
  $("categoryList").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-category]");
    if (edit) return editCategory(edit.dataset.editCategory);
    const item = event.target.closest("[data-category]");
    if (item) {
      selectedCategoryId = item.dataset.category;
      renderCategories(); renderProducts();
    }
  });
  $("adminProductList").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-product]");
    if (edit) return editProduct(edit.dataset.editProduct);
    const toggle = event.target.closest("[data-toggle-availability]");
    if (toggle) toggleAvailability(toggle.dataset.toggleAvailability, toggle);
    const emptyAdd = event.target.closest("[data-empty-new-product]");
    if (emptyAdd) $("newProductButton").click();
  });
  document.querySelectorAll("[data-close-modal]").forEach(button =>
    button.addEventListener("click", () => closeModal(button.dataset.closeModal))
  );
  ["categoryModal", "productModal"].forEach(id => $(id).addEventListener("click", event => {
    if (event.target === $(id)) closeModal(id);
  }));
  document.addEventListener("keydown", event => {
    const activeOverlay = ["categoryModal", "productModal"].map(id => $(id)).find(overlay => overlay && !overlay.hidden);
    if (!activeOverlay) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal(activeOverlay.id);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(activeOverlay);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!activeOverlay.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
profile = await requireAuth(["admin"]);
if (profile) {
  $("userName").textContent = profile.full_name || "";
  bindEvents();
  await loadMenuData();
}
