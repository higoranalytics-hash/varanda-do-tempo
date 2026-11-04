import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { beginGlobalLoading, endGlobalLoading } from "./utils.js";

const SUPABASE_URL = "https://zpvpyygtvxktlkcmtunk.supabase.co";
const SUPABASE_KEY = "sb_publishable_VZOxNG41H3Sna2g2byZI4g_GGXuZxQj";

// Centraliza o feedback visual de qualquer operação Supabase em todas as páginas.
// O contador evita que uma requisição encerrada esconda o overlay enquanto outra segue ativa.
const trackedFetch = async (...args) => {
  beginGlobalLoading();
  try {
    return await fetch(...args);
  } finally {
    endGlobalLoading();
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { fetch: trackedFetch },
});
