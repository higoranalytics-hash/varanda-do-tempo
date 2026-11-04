import { supabase } from "./supabaseClient.js";

const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const buttonText = document.getElementById("buttonText");
const buttonLoader = document.getElementById("buttonLoader");
const message = document.getElementById("loginMessage");

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `message ${type}`;
}
function setLoading(loading) {
  button.disabled = loading;
  buttonText.hidden = loading;
  buttonLoader.hidden = !loading;
}

async function redirectIfAlreadyLoggedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data: profile } = await supabase
    .from("profiles").select("role, active").eq("id", session.user.id).maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return;
  }
  window.location.replace(profile.role === "admin" ? "dashboard.html" : "atendimento.html");
}
redirectIfAlreadyLoggedIn();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading(true);
  showMessage("");
  try {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) throw new Error("Perfil não encontrado. Procure o administrador.");
    if (!profile.active) throw new Error("Usuário desativado. Procure o administrador.");

    window.location.replace(profile.role === "admin" ? "dashboard.html" : "atendimento.html");
  } catch (error) {
    await supabase.auth.signOut();
    const msg = error.message === "Invalid login credentials"
      ? "E-mail ou senha incorretos." : error.message;
    showMessage(msg);
  } finally {
    setLoading(false);
  }
});
