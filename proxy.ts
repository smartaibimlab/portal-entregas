import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Só roda onde a sessão importa. A página/API pública de entrega fica de fora.
  matcher: ["/admin/:path*", "/login"],
};
