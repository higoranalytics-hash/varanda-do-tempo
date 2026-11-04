import { supabase } from "./supabaseClient.js";

export async function getMenu() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, display_order, products(id, name, description, price, image_url, display_order)")
    .eq("active", true)
    .eq("products.active", true)
    .eq("products.available", true)
    .order("display_order", { ascending: true })
    .order("display_order", { ascending: true, referencedTable: "products" });

  if (error) throw error;
  return (data || []).map(category => ({
    ...category,
    products: (category.products || [])
      .filter(product => product && Number.isFinite(Number(product.price)))
      .sort((a,b) => a.display_order - b.display_order)
  }));
}
