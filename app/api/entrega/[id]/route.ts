import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_RE } from "@/lib/mercadopago";
import type { EntregaPublica } from "@/lib/types";

const noStore = { "Cache-Control": "no-store" };

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/entrega/[id]">) {
  const { id } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Entrega não encontrada." }, { status: 404, headers: noStore });
  }

  const supabase = createAdminClient(); // SUPABASE_SERVICE_ROLE_KEY, só no servidor
  const { data, error } = await supabase
    .from("entregas")
    .select("id, cliente_nome, projeto_titulo, descricao, valor, status, drive_url")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[api/entrega]", error.message);
    return NextResponse.json({ error: "Erro ao carregar a entrega." }, { status: 500, headers: noStore });
  }
  if (!data) {
    return NextResponse.json({ error: "Entrega não encontrada." }, { status: 404, headers: noStore });
  }

  // REGRA CRÍTICA: o link do Drive só sai do servidor quando a entrega está paga.
  const body: EntregaPublica = {
    id: data.id,
    cliente_nome: data.cliente_nome,
    projeto_titulo: data.projeto_titulo,
    descricao: data.descricao,
    valor: Number(data.valor),
    status: data.status,
    drive_url: data.status === "PAGO" ? data.drive_url : null,
  };

  return NextResponse.json(body, { headers: noStore });
}
