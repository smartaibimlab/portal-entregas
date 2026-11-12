import { NextResponse, type NextRequest } from "next/server";
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { MP_API, UUID_RE, mpToken } from "@/lib/mercadopago";

/**
 * Notificações do Mercado Pago. Aceita os dois formatos:
 *  - Webhooks:  POST /api/webhook?data.id=123&type=payment  body {type, action, data:{id}}
 *  - IPN legado: POST /api/webhook?topic=payment&id=123
 *
 * Por que é seguro: NÃO confiamos no conteúdo da notificação. Ela só diz
 * "olhe o pagamento X". Consultamos o pagamento direto na API do MP com o nosso
 * token e conferimos status, referência, valor e moeda antes de liberar.
 *
 * Códigos de resposta: 200 = processado ou ignorado (o MP para de reenviar);
 * 500 = falha temporária (o MP tenta de novo depois).
 */
const ok = (info: string) => NextResponse.json({ ok: true, info });

export async function POST(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  const tipo = String(body?.type ?? q.get("type") ?? body?.topic ?? q.get("topic") ?? "");
  const paymentId = String(body?.data?.id ?? q.get("data.id") ?? q.get("id") ?? "");

  // Camada extra: se houver segredo configurado e o MP mandou x-signature, ela
  // TEM que bater. (A consulta à API abaixo é a proteção principal.)
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const xSignature = req.headers.get("x-signature");
  if (secret && xSignature) {
    try {
      WebhookSignatureValidator.validate({
        xSignature,
        xRequestId: req.headers.get("x-request-id"),
        dataId: q.get("data.id"), // o manifesto usa o data.id da QUERY STRING
        secret,
        toleranceSeconds: 600,
      });
    } catch (e) {
      if (e instanceof InvalidWebhookSignatureError) {
        console.warn("[webhook] assinatura inválida:", e.reason, e.requestId);
        return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
      }
      throw e;
    }
  }

  if (tipo !== "payment") return ok(`ignorado: tipo "${tipo}"`);
  if (!/^\d+$/.test(paymentId)) return ok("ignorado: id de pagamento ausente");

  // 1. Consulta o pagamento real no Mercado Pago.
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken()}` },
    cache: "no-store",
  });
  if (res.status === 404) return ok("pagamento não encontrado");
  if (!res.ok) {
    console.error("[webhook] erro MP:", res.status, await res.text());
    return NextResponse.json({ error: "falha ao consultar pagamento" }, { status: 500 });
  }
  const pagamento = await res.json();

  if (pagamento.status !== "approved") return ok(`pagamento ${pagamento.status}`);

  const entregaId = String(pagamento.external_reference ?? "");
  if (!UUID_RE.test(entregaId)) return ok("external_reference inválida");

  // 2. Confere que o valor pago corresponde à entrega.
  const supabase = createAdminClient();
  const { data: entrega, error } = await supabase
    .from("entregas")
    .select("id, valor, status")
    .eq("id", entregaId)
    .maybeSingle();

  if (error) {
    console.error("[webhook] supabase:", error.message);
    return NextResponse.json({ error: "falha no banco" }, { status: 500 });
  }
  if (!entrega) return ok("entrega não encontrada");
  if (entrega.status === "PAGO") return ok("já estava paga"); // idempotente: o MP reenvia

  const valorPago = Number(pagamento.transaction_amount);
  if (pagamento.currency_id !== "BRL" || !(valorPago + 0.001 >= Number(entrega.valor))) {
    console.error("[webhook] valor divergente", { entregaId, paymentId, valorPago, esperado: entrega.valor });
    return ok("valor divergente — não liberado");
  }

  // 3. Libera. O filtro em status evita sobrescrever se duas notificações chegarem juntas.
  const { error: upErr } = await supabase
    .from("entregas")
    .update({ status: "PAGO", mp_payment_id: String(pagamento.id) })
    .eq("id", entregaId)
    .eq("status", "PENDENTE");

  if (upErr) {
    console.error("[webhook] update:", upErr.message);
    return NextResponse.json({ error: "falha ao atualizar" }, { status: 500 });
  }

  return ok("entrega liberada");
}
