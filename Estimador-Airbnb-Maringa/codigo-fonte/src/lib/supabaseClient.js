import { createClient } from "@supabase/supabase-js";

// Credenciais lidas das variáveis de ambiente do Vite.
// NUNCA coloque a Secret Key do Supabase aqui — apenas a URL do projeto
// e a chave pública (anon/publishable key), que são seguras para o navegador.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "[Supabase] Variáveis de ambiente ausentes. Configure VITE_SUPABASE_URL e " +
      "VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env (veja .env.example)."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
