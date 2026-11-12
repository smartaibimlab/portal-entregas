"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
      setErro("E-mail ou senha inválidos.");
      setCarregando(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <header className="mb-12 text-center">
          <p className="rotulo">Portal de Entregas</p>
          <h1 className="font-serif text-4xl font-light text-oliva">Acesso do Escritório</h1>
          <div className="mx-auto mt-6 h-px w-12 bg-terra/30" />
        </header>

        <form onSubmit={entrar} className="space-y-6 border border-terra/10 bg-areia/60 p-8">
          <div>
            <label htmlFor="email" className="rotulo">E-mail</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="campo"
            />
          </div>
          <div>
            <label htmlFor="senha" className="rotulo">Senha</label>
            <input
              id="senha"
              type="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="campo"
            />
          </div>

          {erro && <p role="alert" className="text-sm text-terra">{erro}</p>}

          <button type="submit" disabled={carregando} className="botao w-full bg-oliva text-creme hover:bg-oliva-escuro">
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
