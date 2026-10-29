import { normalizeGhanaPhone } from "@/lib/ghana";

const billingUrl = "https://api.taysend.com/v1/billing";

export type SmsPackage = {
  id: string;
  amount: string;
  sms: string;
};

function taysendKey() {
  const key = process.env.TAYSEND_API_KEY?.trim();
  return key || null;
}

async function taysend(path: string, init?: RequestInit) {
  const key = taysendKey();
  if (!key) return { ok: false as const, error: "Add TAYSEND_API_KEY to load the SMS wallet." };
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(20000),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof body.message === "string" ? body.message : "Taysend could not complete that request.";
      return { ok: false as const, error: message };
    }
    return { ok: true as const, body };
  } catch {
    return { ok: false as const, error: "Taysend could not be reached." };
  }
}

function packageField(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

export async function smsWallet() {
  const result = await taysend(billingUrl);
  if (!result.ok) return result;
  const smsLeft = Number(result.body.sms_left);
  const packages = Array.isArray(result.body.packages) ? result.body.packages : [];
  return {
    ok: true as const,
    smsLeft: Number.isFinite(smsLeft) ? smsLeft : 0,
    packages: packages.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const id = packageField(row.id);
      if (!id) return [];
      return [{ id, amount: packageField(row.amount), sms: packageField(row.sms) }];
    }),
  };
}

export async function startSmsCheckout(input: { packageId: string; email: string; successUrl: string }) {
  const result = await taysend(`${billingUrl}/checkout`, {
    method: "POST",
    body: JSON.stringify({
      package_id: input.packageId,
      email: input.email,
      success_url: input.successUrl,
    }),
  });
  if (!result.ok) return result;
  const checkoutUrl = result.body.checkout_url;
  if (typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
    return { ok: false as const, error: "Taysend did not return a checkout page." };
  }
  return { ok: true as const, checkoutUrl };
}

export async function sendSms(input: { to: string; text: string }) {
  const key = process.env.TAYSEND_API_KEY;
  const sender = process.env.TAYSEND_SENDER_ID?.trim();
  if (!key || !sender) return { sent: false, note: "Taysend is not configured." };
  const to = normalizeGhanaPhone(input.to);
  if (!to) return { sent: false, note: "The phone number is not a Ghana mobile number." };
  try {
    const response = await fetch("https://api.taysend.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        to,
        sender_id: sender,
        message: input.text,
        type: "transactional",
      }),
      signal: AbortSignal.timeout(20000),
    });
    const body = (await response.json().catch(() => ({}))) as { status?: string; message?: string };
    if (!response.ok) {
      return { sent: false, note: body.message || "Taysend rejected the message." };
    }
    return { sent: true, note: body.status ? `Accepted (${body.status}).` : "Accepted." };
  } catch {
    return { sent: false, note: "Taysend could not be reached." };
  }
}
