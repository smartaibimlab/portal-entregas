import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MP_API, UUID_RE, mpToken, siteUrl } from "@/lib/mercadopago";

const noStore = { "Cache-Control": "no-store" };
const erro = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status, headers: noStore });

export async function POST(req: NextRequest) {
  // 1. Entrada: só o ID. Título e valor vêm SEMPRE do banco, nunca do cliente,
  //    senão alguém poderia mandar valor: 0,01.
  let entrega_id: unknown;
  try {
    ({ entrega_id } = await req.json());
  } catch {
    return erro("JSON inválido.", 400);
  }
  if (typeof entrega_id !== "string" || !UUID_RE.test(entrega_id)) {
    return erro("entrega_id inválido.", 400);
  }

  // 2. Busca título e valor no Supabase.
  const supabase = createAdminClient();
  const { data: entrega, error } = await supabase
    .from("entregas")
    .select("id, projeto_titulo, valor, status")
    .eq("id", entrega_id)
    .maybeSingle();

  if (error) {
    console.error("[api/checkout] supabase:", error.message);
    return erro("Erro ao carregar a entrega.", 500);
  }
  if (!entrega) return erro("Entrega não encontrada.", 404);
  if (entrega.status === "PAGO") return erro("Esta entrega já está paga.", 409);

  const valor = Number(entrega.valor);
  if (!Number.isFinite(valor) || valor <= 0) return erro("Valor da entrega inválido.", 422);

  // 3. Cria a preferência no Mercado Pago (Checkout Pro).
  const base = siteUrl();
  const voltar = `${base}/entrega/${entrega.id}`;

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          id: entrega.id,
          title: entrega.projeto_titulo,
          quantity: 1,
          unit_price: valor,
          currency_id: "BRL",
        },
      ],
      external_reference: entrega.id,
      back_urls: { success: voltar, pending: voltar, failure: voltar },
      auto_return: "approved", // exige back_urls.success
      notification_url: `${base}/api/webhook`,
    }),
    cache: "no-store",
  });

  const pref = await res.json().catch(() => null);
  if (!res.ok || !pref?.init_point) {
    console.error("[api/checkout] mercadopago:", res.status, JSON.stringify(pref));
    return erro("Não foi possível iniciar o pagamento.", 502);
  }

  // 4. O front-end redireciona o cliente para cá.
  return NextResponse.json({ init_point: pref.init_point as string }, { headers: noStore });
}
