// LEF — recibe la confirmación de pago de Wompi (eventos). Esta es la ÚNICA fuente de
// verdad para marcar un pago como aprobado — nunca se confía en la redirección del
// navegador después del widget. Verifica la firma del evento con el secreto de eventos
// antes de registrar nada. URL pública: se configura en el dashboard de Wompi (sandbox y
// producción por separado, cada una con su propio secreto de eventos).
import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc: any, key) => (acc == null ? undefined : acc[key]), obj);
}

const METHOD_MAP: Record<string, string> = {
  CARD: "card",
  PSE: "pse",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let event: any;
  try { event = await req.json(); } catch { return json({ error: "json_invalido" }, 400); }

  const eventsSecret = Deno.env.get("WOMPI_EVENTS_SECRET");
  if (!eventsSecret) return json({ error: "wompi_sin_configurar" }, 500);

  const sig = event?.signature;
  if (!sig || !Array.isArray(sig.properties) || !sig.checksum || !sig.timestamp) {
    return json({ error: "evento_invalido" }, 400);
  }

  const concatenated = sig.properties.map((p: string) => String(getPath(event.data, p) ?? "")).join("") +
    String(sig.timestamp) + eventsSecret;
  const expected = await sha256Hex(concatenated);

  if (expected.toLowerCase() !== String(sig.checksum).toLowerCase()) {
    return json({ error: "firma_invalida" }, 401);
  }

  // Firma válida — a partir de aquí el evento es confiable.
  if (event.event === "transaction.updated") {
    const tx = event.data?.transaction;
    if (tx && tx.status === "APPROVED") {
      const m = /^LEF-([0-9a-f-]{36})-\d+$/i.exec(String(tx.reference ?? ""));
      if (m) {
        const subscriptionId = m[1];
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const method = METHOD_MAP[String(tx.payment_method_type || "").toUpperCase()] || "other";
        const { error } = await admin.rpc("record_wompi_payment", {
          p_subscription_id: subscriptionId,
          p_amount: (tx.amount_in_cents || 0) / 100,
          p_currency: tx.currency || "COP",
          p_method: method,
          p_gateway_txn_id: tx.id,
          p_reference: tx.reference,
        });
        if (error) {
          // Registramos el error pero igual respondemos 200 abajo si ya no hay nada más
          // que reintentar tenga sentido (evita bucles de reintento de Wompi); si quieres
          // que Wompi reintente ante un fallo real, cambia este return por status 500.
          console.error("record_wompi_payment error:", error.message);
        }
      }
    }
  }

  return json({ ok: true });
});
