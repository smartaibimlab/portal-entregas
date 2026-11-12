import { Suspense } from "react";
import { EntregaCliente } from "./entrega-cliente";

// Wrapper de servidor: no Next.js 16 (Cache Components), hooks de URL como
// useParams() precisam ficar dentro de <Suspense>. Os dados continuam sendo
// buscados pelo cliente EXCLUSIVAMENTE em /api/entrega/[id].
export default function EntregaPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center text-sm tracking-widest text-terra/60">
          CARREGANDO…
        </main>
      }
    >
      <EntregaCliente />
    </Suspense>
  );
}
