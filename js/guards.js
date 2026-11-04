import { supabase } from "./supabaseClient.js";

export async function requireAuth(allowedRoles = []) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    window.location.replace("index.html");
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    await supabase.auth.signOut();
    window.location.replace("index.html");
    return null;
  }

  if (allowedRoles.length && !allowedRoles.includes(profile.role)) {
    window.location.replace(profile.role === "admin" ? "dashboard.html" : "atendimento.html");
    return null;
  }
  return profile;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.replace("index.html");
}
