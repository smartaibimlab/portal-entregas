# Portal de Entregas

Portal para escritórios de arquitetura entregarem projetos aos clientes. O cliente recebe um link, paga pelo Mercado Pago e o acesso à pasta do Google Drive é liberado automaticamente.

**Stack:** Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (Auth + Postgres) · Mercado Pago Checkout Pro · Vercel

## Como funciona

1. O escritório faz login em `/login` e cadastra a entrega em `/admin` (cliente, projeto, descrição, valor, link do Drive).
2. Copia o link público `/entrega/{id}` e envia ao cliente.
3. O cliente vê os dados do projeto e clica em **Pagar e Liberar Download**, indo para o checkout do Mercado Pago.
4. O Mercado Pago avisa o servidor em `/api/webhook`. O servidor confirma o pagamento na API do Mercado Pago e marca a entrega como `PAGO`.
5. A página do cliente passa a mostrar o botão **Acessar Pasta do Projeto no Google Drive**.

### Segurança

- O link do Drive **só sai do servidor quando a entrega está paga**. Antes disso, a API devolve `drive_url: null`.
- A página pública nunca acessa o Supabase direto. Ela usa só a rota `/api/entrega/[id]`.
- O valor cobrado vem sempre do banco, nunca do navegador.
- O webhook não confia na notificação recebida. Ele consulta o pagamento na API do Mercado Pago e confere status, referência, valor e moeda antes de liberar.
- Com `MERCADOPAGO_WEBHOOK_SECRET` definido, notificações com assinatura `x-signature` inválida são recusadas.
- `/admin` é protegido no servidor por `proxy.ts` (o antigo `middleware` do Next.js).

## Estrutura

```
proxy.ts                        protege /admin e renova a sessão
supabase/schema.sql             tabela, regras de acesso (RLS) e migração
lib/supabase/client.ts          cliente do navegador (anon key)
lib/supabase/admin.ts           cliente com service role (só no servidor)
lib/supabase/proxy.ts           sessão + redirecionamentos
lib/mercadopago.ts              utilitários do Mercado Pago (só no servidor)
lib/types.ts                    tipos e formatação em R$
app/login/page.tsx              login por e-mail e senha
app/admin/page.tsx              painel: cadastrar, listar, copiar link, alterar status
app/entrega/[id]/               página pública do cliente
app/api/entrega/[id]/route.ts   GET: dados públicos da entrega
app/api/checkout/route.ts       POST: cria a preferência no Mercado Pago
app/api/webhook/route.ts        POST: recebe notificações e libera a entrega
```

## Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql). Ele pode ser rodado de novo sem problema.
3. Em **Authentication → Sign In / Providers**, **desligue "Allow new users to sign up"**.
   > Importante: as regras de acesso liberam a tabela para qualquer usuário logado. Com o cadastro aberto, qualquer pessoa poderia criar uma conta e ver todas as entregas. O `schema.sql` traz comentada uma alternativa que restringe o acesso a um e-mail específico.
4. Em **Authentication → Users → Add user**, crie o usuário do escritório (e-mail e senha).
5. Em **Project Settings → API Keys**, copie a URL do projeto, a chave pública (anon/publishable) e a chave secreta (service_role/secret).

### 2. Mercado Pago

1. Em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app), crie uma aplicação do tipo Checkout Pro.
2. Copie o **Access Token**. Comece pelas **credenciais de teste** e use compradores de teste.
3. (Recomendado) Em **Webhooks**, configure a URL `https://SEU-DOMINIO/api/webhook` com o evento **Pagamentos** e copie a **assinatura secreta**.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

| Variável | Para que serve | Visível no navegador? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública do Supabase | sim (protegida pelas regras de acesso) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta, usada só nas rotas de API | **não**, nunca use prefixo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | URL pública https do site, **sem barra no final** | sim |
| `MERCADOPAGO_ACCESS_TOKEN` | token da aplicação no Mercado Pago | **não** |
| `MERCADOPAGO_WEBHOOK_SECRET` | assinatura secreta dos webhooks (opcional; vazio pula a conferência) | **não** |

O `.env.local` é ignorado pelo git (regra `.env*` no `.gitignore`). Nunca faça commit das suas chaves.

### 4. Rodar localmente

Requer Node.js 20.9 ou mais recente.

```bash
npm install
```

```bash
npm run dev
```

Abra http://localhost:3000. Para testar pagamentos, o Mercado Pago precisa alcançar `/api/webhook` por uma URL pública: use o deploy de preview da Vercel ou um túnel. `localhost` não recebe notificações.

## Deploy na Vercel

1. Importe este repositório em [vercel.com/new](https://vercel.com/new).
2. Em **Settings → Environment Variables**, cadastre as mesmas variáveis do `.env.local`.
3. Faça o deploy e ajuste `NEXT_PUBLIC_SITE_URL` para o domínio final.

> As variáveis `NEXT_PUBLIC_*` são gravadas no código durante o build. Se mudar alguma, faça **Redeploy**.
>
> O build passa mesmo com variáveis faltando. Uma variável esquecida só gera erro quando alguém usa o site, então teste o fluxo completo depois do deploy: login → cadastro → link público → pagamento de teste.

## Limitações conhecidas

- Quem tiver o link de uma entrega **já paga** acessa a pasta do Drive. O ID é um UUID, impossível de adivinhar, mas o link pode ser repassado. Para proteção real, compartilhe a pasta do Drive só com o e-mail do cliente, e não como "qualquer pessoa com o link".
- O status pode ser alterado manualmente no painel (útil para Pix recebido fora do Mercado Pago).
