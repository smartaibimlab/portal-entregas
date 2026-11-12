import "server-only";

export const MP_API = "https://api.mercadopago.com";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mpToken(): string {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente.");
  return t;
}

/** URL pública do site, sem barra final. Precisa ser https público para o MP. */
export function siteUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL;
  if (!u) throw new Error("NEXT_PUBLIC_SITE_URL ausente.");
  return u.replace(/\/+$/, "");
}
