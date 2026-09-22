// LEF — genera la referencia y la firma de integridad para abrir el Widget de Wompi
// desde el portal del estudiante. El secreto de integridad NUNCA sale de este servidor
// (así lo exige la documentación oficial de Wompi) — el navegador solo recibe el hash ya
// calculado. Se invoca con el JWT del estudiante autenticado.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://www.lefcenter.com,https://lefcenter.com,https://lef-center.vercel.app")
  .split(",").map((s) => s.trim()).filter(Boolean);

function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), "Content-Type": "application/json" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(req, { error: "no_autenticado" }, 401);

  const admin = createClient(url, serviceKey);
  const { data: profile } = await admin
    .from("profiles").select("student_id, active").eq("user_id", auth.user.id).maybeSingle();
  if (!profile || !profile.active || !profile.student_id) return json(req, { error: "requiere_estudiante" }, 403);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json(req, { error: "json_invalido" }, 400); }
  const subscriptionId = String(payload.subscription_id ?? "");
  if (!subscriptionId) return json(req, { error: "falta_subscription_id" }, 400);

  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, student_id, monthly_amount, currency, status")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (subErr || !sub) return json(req, { error: "suscripcion_no_encontrada" }, 404);
  if (sub.student_id !== profile.student_id) return json(req, { error: "no_autorizado" }, 403);
  if (sub.status === "cancelled") return json(req, { error: "suscripcion_cancelada" }, 400);

  // Cobrar solo el saldo pendiente, no la mensualidad completa — si el estudiante
  // ya tiene un abono registrado a mano, Wompi no debe volver a cobrarle el total.
  // Mismo cálculo que admin_billing_overview/get_my_billing: suma de pagos
  // aprobados que nadie haya reversado.
  const { data: subPayments } = await admin
    .from("payments")
    .select("id, amount, status, reverses_payment")
    .eq("subscription_id", sub.id);
  const rows = subPayments || [];
  const reversedIds = new Set(rows.map((p) => p.reverses_payment).filter(Boolean));
  const paidBefore = rows
    .filter((p) => p.status === "approved" && !reversedIds.has(p.id))
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Number(sub.monthly_amount) - paidBefore;
  if (balance <= 0) return json(req, { error: "suscripcion_ya_pagada" }, 400);

  const publicKey = Deno.env.get("WOMPI_PUBLIC_KEY");
  const integritySecret = Deno.env.get("WOMPI_INTEGRITY_SECRET");
  if (!publicKey || !integritySecret) return json(req, { error: "wompi_sin_configurar" }, 500);

  const currency = (sub.currency || "COP").toUpperCase();
  const amountInCents = Math.round(balance * 100);
  const reference = `LEF-${sub.id}-${Date.now()}`;
  const signature = await sha256Hex(reference + amountInCents + currency + integritySecret);

  return json(req, {
    reference,
    amountInCents,
    currency,
    signature,
    publicKey,
  });
});
