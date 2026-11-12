-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor > New query)

create extension if not exists "pgcrypto";

create table if not exists public.entregas (
  id             uuid primary key default gen_random_uuid(),
  cliente_nome   text not null,
  projeto_titulo text not null,
  descricao      text,
  valor          numeric(12,2) not null check (valor >= 0),
  drive_url      text not null,
  status         text not null default 'PENDENTE' check (status in ('PENDENTE', 'PAGO')),
  mp_payment_id  text,
  created_at     timestamptz not null default now()
);

-- Migração para quem já criou a tabela antes desta coluna existir:
alter table public.entregas add column if not exists mp_payment_id text;

create index if not exists entregas_created_at_idx on public.entregas (created_at desc);

-- RLS: o público (role anon) NÃO tem acesso algum à tabela.
-- A página pública lê pela rota /api/entrega/[id], que usa a service role no servidor.
alter table public.entregas enable row level security;

-- Somente usuários autenticados (o escritório) podem ler/escrever.
-- IMPORTANTE: desative o cadastro público em Authentication > Sign In / Providers
-- ("Allow new users to sign up" = off) e crie o usuário admin manualmente em
-- Authentication > Users. Caso contrário, qualquer pessoa que se cadastrar
-- passa a ser "authenticated".
drop policy if exists "admin_select" on public.entregas;
drop policy if exists "admin_insert" on public.entregas;
drop policy if exists "admin_update" on public.entregas;
drop policy if exists "admin_delete" on public.entregas;

create policy "admin_select" on public.entregas for select to authenticated using (true);
create policy "admin_insert" on public.entregas for insert to authenticated with check (true);
create policy "admin_update" on public.entregas for update to authenticated using (true) with check (true);
create policy "admin_delete" on public.entregas for delete to authenticated using (true);

-- Alternativa mais restrita (trave em um e-mail específico):
-- create policy "admin_all" on public.entregas for all to authenticated
--   using ((auth.jwt() ->> 'email') = 'seu-email@escritorio.com')
--   with check ((auth.jwt() ->> 'email') = 'seu-email@escritorio.com');
