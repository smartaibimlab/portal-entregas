"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, type Entrega, type StatusEntrega } from "@/lib/types";

// createBrowserClient é singleton no navegador; criar sob demanda evita
// executar no prerender do servidor.
const sb = () => createClient();

const formVazio = { cliente_nome: "", projeto_titulo: "", descricao: "", valor: "", drive_url: "" };

export default function AdminPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [form, setForm] = useState(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await sb()
      .from("entregas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setMensagem({ tipo: "erro", texto: "Não foi possível carregar as entregas." });
    else setEntregas(data as Entrega[]);
  }, []);

  // Segunda barreira (a primeira é o proxy.ts no servidor).
  useEffect(() => {
    sb().auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setVerificando(false);
      carregar();
    });
  }, [router, carregar]);

  async function cadastrar(e: FormEvent) {
    e.preventDefault();
    setMensagem(null);

    const valor = Number(form.valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) {
      setMensagem({ tipo: "erro", texto: "Valor inválido. Use, por exemplo, 4500,00." });
      return;
    }
    if (!/^https:\/\//i.test(form.drive_url.trim())) {
      setMensagem({ tipo: "erro", texto: "O link do Drive deve começar com https://" });
      return;
    }

    setSalvando(true);
    const { error } = await sb().from("entregas").insert({
      cliente_nome: form.cliente_nome.trim(),
      projeto_titulo: form.projeto_titulo.trim(),
      descricao: form.descricao.trim() || null,
      valor,
      drive_url: form.drive_url.trim(),
    });
    setSalvando(false);

    if (error) {
      setMensagem({ tipo: "erro", texto: "Erro ao cadastrar: " + error.message });
      return;
    }
    setForm(formVazio);
    setMensagem({ tipo: "ok", texto: "Entrega cadastrada." });
    carregar();
  }

  async function alternarStatus(entrega: Entrega) {
    const novo: StatusEntrega = entrega.status === "PAGO" ? "PENDENTE" : "PAGO";
    if (!confirm(`Alterar "${entrega.projeto_titulo}" para ${novo}?`)) return;
    const { error } = await sb().from("entregas").update({ status: novo }).eq("id", entrega.id);
    if (error) setMensagem({ tipo: "erro", texto: "Erro ao alterar status." });
    else carregar();
  }

  async function copiarLink(id: string) {
    const url = `${window.location.origin}/entrega/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      prompt("Copie o link:", url);
    }
  }

  async function sair() {
    await sb().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (verificando) {
    return <main className="flex flex-1 items-center justify-center text-sm tracking-widest text-terra/60">CARREGANDO…</main>;
  }

  const campo = (k: keyof typeof formVazio) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-8">
      <header className="mb-12 flex items-end justify-between border-b border-terra/15 pb-6">
        <div>
          <p className="rotulo">Painel</p>
          <h1 className="font-serif text-4xl font-light text-oliva">Entregas de Projetos</h1>
        </div>
        <button onClick={sair} className="text-xs tracking-[0.2em] uppercase text-terra/70 hover:text-terra">
          Sair
        </button>
      </header>

      <div className="grid gap-12 lg:grid-cols-[380px_1fr]">
        {/* Formulário */}
        <section>
          <h2 className="mb-6 font-serif text-2xl text-terra">Nova entrega</h2>
          <form onSubmit={cadastrar} className="space-y-5 border border-terra/10 bg-areia/60 p-6">
            <div>
              <label className="rotulo" htmlFor="cliente_nome">Cliente</label>
              <input id="cliente_nome" required className="campo" {...campo("cliente_nome")} />
            </div>
            <div>
              <label className="rotulo" htmlFor="projeto_titulo">Projeto</label>
              <input id="projeto_titulo" required className="campo" {...campo("projeto_titulo")} />
            </div>
            <div>
              <label className="rotulo" htmlFor="descricao">Descrição</label>
              <textarea id="descricao" rows={3} className="campo resize-y" {...campo("descricao")} />
            </div>
            <div>
              <label className="rotulo" htmlFor="valor">Valor (R$)</label>
              <input id="valor" required inputMode="decimal" placeholder="4.500,00" className="campo" {...campo("valor")} />
            </div>
            <div>
              <label className="rotulo" htmlFor="drive_url">Link da pasta no Google Drive</label>
              <input id="drive_url" required type="url" placeholder="https://drive.google.com/…" className="campo" {...campo("drive_url")} />
            </div>

            {mensagem && (
              <p role="status" className={`text-sm ${mensagem.tipo === "ok" ? "text-oliva" : "text-terra"}`}>
                {mensagem.texto}
              </p>
            )}

            <button type="submit" disabled={salvando} className="botao w-full bg-oliva text-creme hover:bg-oliva-escuro">
              {salvando ? "Salvando…" : "Cadastrar entrega"}
            </button>
          </form>
        </section>

        {/* Lista */}
        <section>
          <h2 className="mb-6 font-serif text-2xl text-terra">
            Entregas <span className="text-base text-terra/50">({entregas.length})</span>
          </h2>

          {entregas.length === 0 ? (
            <p className="border border-dashed border-terra/20 p-10 text-center text-sm text-terra/60">
              Nenhuma entrega cadastrada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-terra/10 border-y border-terra/10">
              {entregas.map((e) => (
                <li key={e.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-serif text-xl text-terra">{e.projeto_titulo}</p>
                    <p className="text-sm text-terra/70">
                      {e.cliente_nome} · {formatBRL(e.valor)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => alternarStatus(e)}
                      title="Clique para alterar o status manualmente"
                      className={`px-3 py-1 text-[0.65rem] tracking-[0.2em] uppercase ${
                        e.status === "PAGO" ? "bg-oliva text-creme" : "border border-terra/30 bg-areia text-terra"
                      }`}
                    >
                      {e.status}
                    </button>
                    <button
                      onClick={() => copiarLink(e.id)}
                      className="botao border border-oliva px-4 py-2 text-oliva hover:bg-oliva hover:text-creme"
                    >
                      {copiado === e.id ? "Copiado ✓" : "Copiar link"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
