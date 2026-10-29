import { decidePayment } from "@/lib/payments/decision";
import { formatMoney } from "@/lib/money";
import { audit } from "../audit";
import { nid, supabaseAdmin, throwIf } from "../db";
import { moveStock } from "../inventory";
import { notify, sendOrderNotice } from "../notifications";
import { adapters, type ProviderName } from "./adapters";

export async function verifyAttempt(reference: string) {
  const db = supabaseAdmin();
  const { data: attempt, error } = await db.from("PaymentAttempt").select("*, order:Order(*, items:OrderItem(*))").eq("reference", reference).maybeSingle();
  throwIf(error);
  if (!attempt?.order) return { ok: false as const, error: "Payment attempt not found." };
  const order = attempt.order;
  if (attempt.provider === "pay_on_delivery") {
    return { ok: true as const, status: "unpaid" as const, orderNumber: order.number };
  }
  if (attempt.status === "SUCCESSFUL" || order.paymentStatus === "PAID") {
    return { ok: true as const, status: "successful" as const, orderNumber: order.number };
  }
  if (order.fulfilmentStatus === "CANCELLED") {
    await notify({
      kind: "payment_after_cancel",
      title: `Payment check for cancelled ${order.number}`,
      body: "A payment check arrived after the reservation expired. It was not marked paid. Reconcile it in the provider dashboard if money was collected.",
    });
    return { ok: false as const, error: "This order is no longer payable." };
  }
  const provider = adapters[attempt.provider as ProviderName];
  if (!provider) return { ok: false as const, error: "Unknown payment provider." };
  const verification = await provider.verify(reference);
  const decision = decidePayment({
    expectedMinor: attempt.amount,
    expectedCurrency: attempt.currency,
    reportedMinor: verification.amountMinor,
    reportedCurrency: verification.currency,
    status: verification.status,
  });
  await db
    .from("PaymentAttempt")
    .update({ rawVerify: verification.raw as object, providerReference: verification.providerReference || attempt.providerReference })
    .eq("id", attempt.id);
  if (decision === "accept") {
    await markPaid(attempt.id);
    return { ok: true as const, status: "successful" as const, orderNumber: order.number };
  }
  if (decision === "fail") {
    await db.from("PaymentAttempt").update({ status: "FAILED" }).eq("id", attempt.id).in("status", ["INITIATED", "PENDING"]);
    return { ok: true as const, status: "failed" as const, orderNumber: order.number };
  }
  if (decision === "reject_amount" || decision === "reject_currency") {
    await audit({
      action: decision,
      entity: "payment_attempt",
      entityId: attempt.id,
      metadata: { reference, reportedMinor: verification.amountMinor, reportedCurrency: verification.currency },
    });
    return { ok: false as const, error: "The provider response did not match this order." };
  }
  return { ok: true as const, status: "pending" as const, orderNumber: order.number };
}

export async function markPaid(attemptId: string) {
  const db = supabaseAdmin();
  const { data: attempt, error } = await db.from("PaymentAttempt").select("*, order:Order(*, items:OrderItem(*))").eq("id", attemptId).maybeSingle();
  throwIf(error);
  if (!attempt?.order) return;
  let shouldEmail = false;
  try {
    const updated = await db.from("PaymentAttempt").update({ status: "SUCCESSFUL" }).eq("id", attempt.id).in("status", ["INITIATED", "PENDING", "FAILED"]).select();
    if (updated.error || !updated.data?.length) return;
    const { data: order, error: orderError } = await db.from("Order").select("*").eq("id", attempt.orderId).maybeSingle();
    throwIf(orderError);
    if (!order || order.paymentStatus === "PAID") return;
    if (order.fulfilmentStatus === "CANCELLED") throw new Error("CANCELLED");
    for (const item of attempt.order.items || []) {
      if (!item.productId) continue;
      const { data: product, error: productError } = await db.from("Product").select("trackInventory, unitsSold").eq("id", item.productId).maybeSingle();
      throwIf(productError);
      const moved = await moveStock(
        {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          trackInventory: product?.trackInventory ?? true,
        },
        "commit",
        "sale",
        order.id,
      );
      if (!moved) throw new Error("STOCK");
      await db.from("Product").update({ unitsSold: (product?.unitsSold ?? 0) + item.quantity }).eq("id", item.productId);
    }
    shouldEmail = order.confirmationSentAt == null;
    await db
      .from("Order")
      .update({
        paymentStatus: "PAID",
        paidAt: new Date().toISOString(),
        fulfilmentStatus: order.fulfilmentStatus === "PENDING" ? "CONFIRMED" : order.fulfilmentStatus,
        confirmationSentAt: order.confirmationSentAt ?? new Date().toISOString(),
      })
      .eq("id", order.id);
    await db.from("OrderEvent").insert({
      id: nid(),
      orderId: order.id,
      kind: "payment",
      fromStatus: order.paymentStatus,
      toStatus: "PAID",
      note: attempt.provider,
    });
    if (order.couponCode && !order.couponCounted) {
      const { data: coupon, error: couponError } = await db.from("Coupon").select("id").eq("code", order.couponCode).maybeSingle();
      throwIf(couponError);
      if (coupon) {
        await db.from("CouponRedemption").insert({
          couponId: coupon.id,
          orderId: order.id,
          userId: order.userId,
          email: order.email,
          amount: order.discount,
        });
        await db.from("Order").update({ couponCounted: true }).eq("id", order.id);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === "CANCELLED") {
      await notify({
        kind: "payment_after_cancel",
        title: `Unapplied payment for ${attempt.order.number}`,
        body: "The provider reported a successful payment after the order was cancelled. It was not marked paid.",
      });
      return;
    }
    if (error instanceof Error && error.message === "STOCK") {
      await notify({
        kind: "stock_conflict",
        title: `Stock conflict on ${attempt.order.number}`,
        body: "Payment was verified but stock could not be committed. Review the order before fulfilling it.",
      });
      return;
    }
    throw error;
  }
  if (shouldEmail) {
    const { data: fresh, error: freshError } = await db.from("Order").select("*").eq("id", attempt.orderId).maybeSingle();
    throwIf(freshError);
    if (fresh) {
      await sendOrderNotice({
        email: fresh.email,
        phone: fresh.phone,
        orderNumber: fresh.number,
        totalLabel: formatMoney(fresh.total, fresh.currency),
        paymentStatus: "paid",
      });
    }
  }
}

export async function acceptWebhook(provider: ProviderName, rawBody: string, headers: Headers) {
  let authResult;
  try {
    authResult = adapters[provider].authenticateWebhook(rawBody, headers);
  } catch {
    return { status: 400 };
  }
  if (!authResult.ok) return { status: authResult.status };
  const db = supabaseAdmin();
  try {
    await db.from("WebhookEvent").insert({
      id: nid(),
      provider,
      eventId: authResult.eventId,
      payload: authResult.payload as object,
    });
  } catch {
    return { status: 200 };
  }
  let outcome = "ignored";
  if (authResult.reference) {
    const result = await verifyAttempt(authResult.reference);
    outcome = result.ok ? result.status : result.error;
  }
  await db
    .from("WebhookEvent")
    .update({ processedAt: new Date().toISOString(), outcome })
    .eq("provider", provider)
    .eq("eventId", authResult.eventId);
  return { status: 200 };
}
