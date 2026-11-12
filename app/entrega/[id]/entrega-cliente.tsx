"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatBRL, type EntregaPublica } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "ok"; entrega: EntregaPublica };

const TENTATIVAS = 10; // ~30 s aguardando o webhook após voltar do Mercado Pago
const INTERVALO_MS = 3000;

export function EntregaCliente() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  // O Mercado Pago acrescenta parâmetros à back_url ao retornar. Usado só para
  // decidir se vale a pena aguardar; quem libera o download é o webhook.
  const voltouAprovado =
    search.get("status") === "approved" || search.get("collection_status") === "approved";

  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [aguardando, setAguardando] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function carregar(tentativa: number) {
      try {
        // Busca EXCLUSIVAMENTE pela rota interna — nunca direto no Supabase.
        const res = await fetch(`/api/entrega/${encodeURIComponent(id)}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar.");
        setEstado({ fase: "ok", entrega: json });

        const esperar = voltouAprovado && json.status !== "PAGO" && tentativa < TENTATIVAS;
        setAguardando(esperar);
        if (esperar) timer = setTimeout(() => carregar(tentativa + 1), INTERVALO_MS);
      } catch (err) {
        if ((err as Error).name !== "AbortError")
          setEstado({ fase: "erro", mensagem: (err as Error).message });
      }
    }

    carregar(1);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [id, voltouAprovado]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        <p className="rotulo mb-10 text-center">Entrega de Projeto</p>

        {estado.fase === "carregando" && (
          <p className="text-center text-sm tracking-widest text-terra/60">CARREGANDO…</p>
        )}

        {estado.fase === "erro" && (
          <div className="border border-terra/15 bg-areia/60 p-10 text-center">
            <h1 className="font-serif text-3xl font-light text-terra">Indisponível</h1>
            <p className="mt-3 text-sm text-terra/70">{estado.mensagem}</p>
          </div>
        )}

        {estado.fase === "ok" && <Cartao entrega={estado.entrega} aguardando={aguardando} />}
      </div>
    </main>
  );
}

function Cartao({ entrega, aguardando }: { entrega: EntregaPublica; aguardando: boolean }) {
  const pago = entrega.status === "PAGO";
  const [redirecionando, setRedirecionando] = useState(false);
  const [erroPagamento, setErroPagamento] = useState<string | null>(null);

  async function pagar() {
    setErroPagamento(null);
    setRedirecionando(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entrega_id: entrega.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.init_point) throw new Error(json.error ?? "Erro ao iniciar pagamento.");
      window.location.href = json.init_point; // vai para o Checkout do Mercado Pago
    } catch (e) {
      setErroPagamento((e as Error).message);
      setRedirecionando(false);
    }
  }

  return (
    <article className="border border-terra/10 bg-areia/60">
      <div className="p-8 sm:p-12">
        <p className="text-sm text-terra/70">{entrega.cliente_nome}</p>
        <h1 className="mt-2 font-serif text-4xl font-light leading-tight text-oliva">
          {entrega.projeto_titulo}
        </h1>
        <div className="my-8 h-px w-12 bg-terra/30" />

        {entrega.descricao && (
          <p className="whitespace-pre-line leading-relaxed text-terra/85">{entrega.descricao}</p>
        )}

        <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-terra/10 pt-6">
          <div>
            <dt className="rotulo">Valor</dt>
            <dd className="font-serif text-2xl text-terra">{formatBRL(entrega.valor)}</dd>
          </div>
          <div>
            <dt className="rotulo">Status</dt>
            <dd className={`text-sm tracking-[0.2em] uppercase ${pago ? "text-oliva" : "text-terra"}`}>
              {pago ? "Pago" : "Pendente"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-terra/10 bg-creme/60 p-8 sm:px-12">
        {pago && entrega.drive_url ? (
          <a
            href={entrega.drive_url}
            target="_blank"
            rel="noopener noreferrer"
            className="botao w-full bg-oliva text-creme hover:bg-oliva-escuro"
          >
            Acessar Pasta do Projeto no Google Drive
          </a>
        ) : (
          <>
            {aguardando && (
              <p role="status" className="mb-4 text-center text-sm text-oliva">
                Confirmando seu pagamento com o Mercado Pago…
              </p>
            )}
            <button
              onClick={pagar}
              disabled={redirecionando || aguardando}
              className="botao w-full bg-terra text-creme hover:opacity-90"
            >
              {redirecionando ? "Redirecionando…" : "Pagar e Liberar Download"}
            </button>
            {erroPagamento && (
              <p role="alert" className="mt-3 text-center text-sm text-terra">{erroPagamento}</p>
            )}
          </>
        )}
      </div>
    </article>
  );
}
