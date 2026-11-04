import { supabase } from "./supabaseClient.js";


export async function getOpenOrderNameSuggestions(prefix) {
  const normalizedPrefix = String(prefix || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  if (normalizedPrefix.length < 1) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("customer_name, order_number, opened_at")
    .eq("status", "open")
    .ilike("customer_name_key", `${normalizedPrefix}%`)
    .order("opened_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const unique = new Map();
  for (const row of data || []) {
    const key = String(row.customer_name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
    if (!key) continue;
    if (!unique.has(key)) {
      unique.set(key, { customer_name: row.customer_name, latest_order_number: row.order_number, open_order_count: 1 });
    } else {
      unique.get(key).open_order_count += 1;
    }
  }
  return [...unique.values()].sort((a, b) => a.customer_name.localeCompare(b.customer_name, "pt-BR"));
}

export async function findOpenOrdersByName(customerName) {
  const normalizedName = customerName.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalizedName) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, customer_name, opened_at, status,
      order_items(id, quantity, unit_price, subtotal, payment_status)
    `)
    .eq("customer_name_key", normalizedName)
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  if (error) throw error;

  return (data || []).map(order => {
    const items = order.order_items || [];
    const total = items
      .filter(item => item.payment_status !== "cancelled")
      .reduce((sum, item) => sum + Number(item.subtotal), 0);
    return { ...order, total };
  });
}


export async function getAllOpenOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, customer_name, opened_at, status,
      order_items(id, quantity, unit_price, subtotal, payment_status)
    `)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).map(order => {
    const items = order.order_items || [];
    const activeItems = items.filter(item => item.payment_status !== "cancelled");
    const total = activeItems.reduce((sum, item) => sum + Number(item.subtotal ?? Number(item.quantity) * Number(item.unit_price)), 0);
    return { ...order, total, item_count: activeItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0) };
  });
}

export async function createOrder({ customerName, tableId = null, items }) {
  const { data, error } = await supabase.rpc("create_order_with_items", {
    p_customer_name: customerName.trim().replace(/\s+/g, " "),
    p_table_id: tableId || null,
    p_items: items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      notes: item.notes || null
    }))
  });
  if (error) throw error;
  return data;
}

export async function appendItems(orderId, items) {
  const { data, error } = await supabase.rpc("append_items_to_order", {
    p_order_id: orderId,
    p_items: items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      notes: item.notes || null
    }))
  });
  if (error) throw error;
  return data;
}


export async function getOrderItems(orderId) {
  const { data, error } = await supabase
    .from("order_items")
    .select("id, product_name, quantity, unit_price, subtotal, payment_status, notes, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}



export async function getOrderPaymentSummary(orderId) {
  const { data, error } = await supabase.rpc("get_order_payment_summary", {
    p_order_id: orderId
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function receiveOrderPayment({ orderId, orderItemIds, paymentMethod, payerName, splitCount }) {
  const { data, error } = await supabase.rpc("receive_order_payment", {
    p_order_id: orderId,
    p_order_item_ids: orderItemIds,
    p_payment_method: paymentMethod,
    p_payer_name: payerName || null,
    p_split_count: splitCount
  });
  if (error) throw error;
  return data;
}


export async function getOrderPaymentHistory(orderId) {
  const { data, error } = await supabase.rpc("get_order_payment_history", {
    p_order_id: orderId
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}


export async function closeCustomerOrder(orderId) {
  const { data, error } = await supabase.rpc("close_customer_order", {
    p_order_id: orderId
  });
  if (error) throw error;
  return data;
}


export async function cancelEmptyCustomerOrder(orderId) {
  const { data, error } = await supabase.rpc("cancel_empty_customer_order", {
    p_order_id: orderId
  });
  if (error) throw error;
  return data;
}
