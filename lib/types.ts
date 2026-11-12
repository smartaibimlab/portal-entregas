export type StatusEntrega = "PENDENTE" | "PAGO";

export type Entrega = {
  id: string;
  cliente_nome: string;
  projeto_titulo: string;
  descricao: string | null;
  valor: number;
  drive_url: string;
  status: StatusEntrega;
  mp_payment_id: string | null;
  created_at: string;
};

/** Formato devolvido pela rota pública. `drive_url` é null enquanto não estiver PAGO. */
export type EntregaPublica = Omit<Entrega, "drive_url" | "created_at" | "mp_payment_id"> & {
  drive_url: string | null;
};

export const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
