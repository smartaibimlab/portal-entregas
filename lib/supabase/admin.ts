import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com service role — ignora RLS. Use SOMENTE em código de servidor
 * (Route Handlers). O import "server-only" quebra o build se for importado
 * em um Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Variáveis do Supabase ausentes no servidor.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
