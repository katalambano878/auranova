import { createHmac, timingSafeEqual } from "node:crypto";
import { majorToMinor } from "@/lib/money";

export type ProviderName = "moolre" | "flutterwave" | "paystack" | "hubtel";

export type Verification = {
  status: "successful" | "failed" | "pending" | "cancelled" | "expired";
  amountMinor?: number | null;
  currency?: string | null;
  providerReference?: string | null;
  raw: unknown;
};

export type WebhookAuth =
  | { ok: false; status: number }
  | { ok: true; eventId: string; reference?: string; payload: unknown };

function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function minorToMajor(minor: number) {
  const abs = Math.abs(minor);
  return `${minor < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

async function postJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body: body as Record<string, unknown> };
}

function moolreReady() {
  return Boolean(process.env.MOOLRE_API_USER && process.env.MOOLRE_API_PUBKEY && process.env.MOOLRE_ACCOUNT_NUMBER && process.env.MOOLRE_MERCHANT_EMAIL);
}

export const adapters: Record<ProviderName, {
  initiate: (input: { reference: string; amount: number; email: string; name: string; phone: string; callbackUrl: string; redirectUrl: string }) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  verify: (reference: string) => Promise<Verification>;
  authenticateWebhook: (rawBody: string, headers: Headers) => WebhookAuth;
  refund?: (input: { providerReference: string; amount: number }) => Promise<{ ok: true; status: "refunded" | "pending"; reference?: string } | { ok: false; error: string }>;
}> = {
  moolre: {
    async initiate(input) {
      if (!moolreReady()) return { ok: false, error: "Moolre credentials are not configured." };
      const { body } = await postJson("https://api.moolre.com/embed/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-USER": process.env.MOOLRE_API_USER || "",
          "X-API-PUBKEY": process.env.MOOLRE_API_PUBKEY || "",
        },
        body: JSON.stringify({
          type: 1,
          amount: minorToMajor(input.amount),
          email: process.env.MOOLRE_MERCHANT_EMAIL,
          externalref: input.reference,
          callback: input.callbackUrl,
          redirect: input.redirectUrl,
          reusable: "0",
          currency: "GHS",
          accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
          metadata: { customer_email: input.email },
        }),
      });
      const data = body.data as { authorization_url?: string } | undefined;
      if (body.status !== 1 || !data?.authorization_url) {
        return { ok: false, error: typeof body.message === "string" ? body.message : "Moolre could not start the payment." };
      }
      return { ok: true, url: data.authorization_url };
    },
    async verify(reference) {
      if (!moolreReady()) return { status: "pending", raw: { error: "not_configured" } };
      const { body } = await postJson("https://api.moolre.com/open/transact/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-USER": process.env.MOOLRE_API_USER || "",
          "X-API-PUBKEY": process.env.MOOLRE_API_PUBKEY || "",
        },
        body: JSON.stringify({
          type: 1,
          idtype: 1,
          id: reference,
          accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
        }),
      });
      const data = (body.data || {}) as Record<string, unknown>;
      const txStatus = data.txstatus ?? data.txtstatus;
      const success = body.status === 1 && (txStatus === 1 || txStatus === "1");
      return {
        status: success ? "successful" : "pending",
        amountMinor: data.amount == null ? null : majorToMinor(String(data.amount)),
        currency: typeof data.currency === "string" ? data.currency : "GHS",
        providerReference: String(data.transactionid || data.thirdpartyref || reference),
        raw: body,
      };
    },
    authenticateWebhook(rawBody) {
      const payload = JSON.parse(rawBody) as Record<string, unknown>;
      const reference = String(payload.externalref || payload.externalRef || (payload.data as { externalref?: string } | undefined)?.externalref || "");
      if (!reference) return { ok: false, status: 400 };
      return { ok: true, eventId: `moolre:${reference}:${createHmac("sha256", reference).update(rawBody).digest("hex").slice(0, 16)}`, reference, payload };
    },
  },
  flutterwave: {
    async initiate(input) {
      if (!process.env.FLUTTERWAVE_SECRET_KEY) return { ok: false, error: "Flutterwave credentials are not configured." };
      const { body } = await postJson("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
        body: JSON.stringify({
          tx_ref: input.reference,
          amount: Number(minorToMajor(input.amount)),
          currency: "GHS",
          redirect_url: input.redirectUrl,
          customer: { email: input.email, phonenumber: input.phone, name: input.name },
          customizations: { title: "AuraNova" },
        }),
      });
      const data = body.data as { link?: string } | undefined;
      if (body.status !== "success" || !data?.link) {
        return { ok: false, error: typeof body.message === "string" ? body.message : "Flutterwave could not start the payment." };
      }
      return { ok: true, url: data.link };
    },
    async verify(reference) {
      if (!process.env.FLUTTERWAVE_SECRET_KEY) return { status: "pending", raw: { error: "not_configured" } };
      const response = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      const data = (body.data || {}) as Record<string, unknown>;
      const status = String(data.status || "").toLowerCase();
      return {
        status: status === "successful" ? "successful" : status === "failed" ? "failed" : "pending",
        amountMinor: data.amount == null ? null : majorToMinor(String(data.amount)),
        currency: typeof data.currency === "string" ? data.currency : null,
        providerReference: data.id == null ? reference : String(data.id),
        raw: body,
      };
    },
    authenticateWebhook(rawBody, headers) {
      const secret = process.env.FLUTTERWAVE_WEBHOOK_HASH || "";
      const header = headers.get("verif-hash") || "";
      if (!secret || !header || !equal(secret, header)) return { ok: false, status: 401 };
      const payload = JSON.parse(rawBody) as { data?: { tx_ref?: string; id?: number } };
      const reference = payload.data?.tx_ref;
      if (!reference) return { ok: false, status: 400 };
      return { ok: true, eventId: `flutterwave:${payload.data?.id || reference}`, reference, payload };
    },
    async refund(input) {
      if (!process.env.FLUTTERWAVE_SECRET_KEY) return { ok: false, error: "Flutterwave credentials are not configured." };
      const { body } = await postJson(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(input.providerReference)}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
        body: JSON.stringify({ amount: Number(minorToMajor(input.amount)) }),
      });
      if (body.status !== "success") return { ok: false, error: typeof body.message === "string" ? body.message : "Flutterwave refund was not accepted." };
      return { ok: true, status: "refunded" };
    },
  },
  paystack: {
    async initiate(input) {
      if (!process.env.PAYSTACK_SECRET_KEY) return { ok: false, error: "Paystack credentials are not configured." };
      const { body } = await postJson("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          email: input.email,
          amount: input.amount,
          currency: "GHS",
          reference: input.reference,
          callback_url: input.redirectUrl,
        }),
      });
      const data = body.data as { authorization_url?: string } | undefined;
      if (body.status !== true || !data?.authorization_url) {
        return { ok: false, error: typeof body.message === "string" ? body.message : "Paystack could not start the payment." };
      }
      return { ok: true, url: data.authorization_url };
    },
    async verify(reference) {
      if (!process.env.PAYSTACK_SECRET_KEY) return { status: "pending", raw: { error: "not_configured" } };
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      const data = (body.data || {}) as Record<string, unknown>;
      const status = String(data.status || "").toLowerCase();
      return {
        status: status === "success" ? "successful" : status === "failed" || status === "abandoned" ? "failed" : "pending",
        amountMinor: typeof data.amount === "number" ? data.amount : null,
        currency: typeof data.currency === "string" ? data.currency : null,
        providerReference: typeof data.id === "number" ? String(data.id) : reference,
        raw: body,
      };
    },
    authenticateWebhook(rawBody, headers) {
      const secret = process.env.PAYSTACK_SECRET_KEY || "";
      const signature = headers.get("x-paystack-signature") || "";
      const digest = createHmac("sha512", secret).update(rawBody).digest("hex");
      if (!secret || !signature || !equal(digest, signature)) return { ok: false, status: 401 };
      const payload = JSON.parse(rawBody) as { event?: string; data?: { reference?: string; id?: number } };
      const reference = payload.data?.reference;
      if (!reference) return { ok: false, status: 400 };
      return { ok: true, eventId: `paystack:${payload.event || "event"}:${payload.data?.id || reference}`, reference, payload };
    },
    async refund(input) {
      if (!process.env.PAYSTACK_SECRET_KEY) return { ok: false, error: "Paystack credentials are not configured." };
      const { body } = await postJson("https://api.paystack.co/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify({ transaction: input.providerReference, amount: input.amount }),
      });
      const data = body.data as { status?: string; id?: number } | undefined;
      if (body.status !== true) return { ok: false, error: typeof body.message === "string" ? body.message : "Paystack refund was not accepted." };
      const pending = data?.status === "pending" || data?.status === "processing";
      return { ok: true, status: pending ? "pending" : "refunded", reference: data?.id ? String(data.id) : undefined };
    },
  },
  hubtel: {
    async initiate(input) {
      const id = process.env.HUBTEL_CLIENT_ID;
      const secret = process.env.HUBTEL_CLIENT_SECRET;
      const merchant = process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER;
      if (!id || !secret || !merchant) return { ok: false, error: "Hubtel credentials are not configured." };
      const phone = input.phone.replace(/\D/g, "");
      const { body } = await postJson(process.env.HUBTEL_CHECKOUT_URL || "https://payproxyapi.hubtel.com/items/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        },
        body: JSON.stringify({
          totalAmount: Number(minorToMajor(input.amount)),
          description: `AuraNova ${input.reference}`,
          callbackUrl: input.callbackUrl,
          returnUrl: input.redirectUrl,
          cancellationUrl: input.redirectUrl,
          merchantAccountNumber: merchant,
          clientReference: input.reference,
          payeeName: input.name,
          payeeEmail: input.email,
          payeeMobileNumber: phone,
        }),
      });
      const data = (body.data || {}) as { checkoutUrl?: string; checkoutDirectUrl?: string };
      const url = data.checkoutUrl || data.checkoutDirectUrl;
      const code = String(body.responseCode || body.ResponseCode || "");
      if (!url || (code && code !== "0000")) {
        return { ok: false, error: typeof body.message === "string" ? body.message : "Hubtel could not start the payment." };
      }
      return { ok: true, url };
    },
    async verify(reference) {
      const id = process.env.HUBTEL_CLIENT_ID;
      const secret = process.env.HUBTEL_CLIENT_SECRET;
      const merchant = process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER;
      if (!id || !secret || !merchant) return { status: "pending", raw: { error: "not_configured" } };
      const statusUrl = process.env.HUBTEL_STATUS_URL || `https://api-txnstatus.hubtel.com/transactions/${encodeURIComponent(merchant)}/status`;
      const response = await fetch(`${statusUrl}?clientReference=${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      const data = (body.data || body.Data || body) as Record<string, unknown>;
      const status = String(data.status || data.Status || body.responseCode || "").toLowerCase();
      const successful = ["success", "successful", "paid", "completed", "0000"].includes(status);
      const failed = ["failed", "fail", "cancelled", "canceled", "expired"].includes(status);
      const amount = data.amount ?? data.Amount ?? data.amountPaid;
      return {
        status: successful ? "successful" : failed ? "failed" : "pending",
        amountMinor: amount == null ? null : majorToMinor(String(amount)),
        currency: "GHS",
        providerReference: String(data.transactionId || data.TransactionId || reference),
        raw: body,
      };
    },
    authenticateWebhook(rawBody) {
      const payload = JSON.parse(rawBody) as { Data?: { ClientReference?: string }; clientReference?: string };
      const reference = payload.Data?.ClientReference || payload.clientReference;
      if (!reference) return { ok: false, status: 400 };
      return { ok: true, eventId: `hubtel:${reference}:${createHmac("sha256", reference).update(rawBody).digest("hex").slice(0, 16)}`, reference, payload };
    },
  },
};
