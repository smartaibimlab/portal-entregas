import { createBrowserClient } from "@supabase/ssr";

/** Cliente para Client Components (usa a anon key + sessão em cookies). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
