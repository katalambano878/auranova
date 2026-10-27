import { decidePayment } from "@/lib/payments/decision";
import { formatMoney } from "@/lib/money";
import { audit } from "../audit";
import { prisma } from "../db";
import { moveStock } from "../inventory";
import { notify, sendOrderNotice } from "../notifications";
import { adapters, type ProviderName } from "./adapters";

export async function verifyAttempt(reference: string) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { reference },
    include: { order: { include: { items: true } } },
  });
  if (!attempt) return { ok: false as const, error: "Payment attempt not found." };
  if (attempt.provider === "pay_on_delivery") {
    return { ok: true as const, status: "unpaid" as const, orderNumber: attempt.order.number };
  }
  if (attempt.status === "SUCCESSFUL" || attempt.order.paymentStatus === "PAID") {
    return { ok: true as const, status: "successful" as const, orderNumber: attempt.order.number };
  }
  if (attempt.order.fulfilmentStatus === "CANCELLED") {
    await notify({
      kind: "payment_after_cancel",
      title: `Payment check for cancelled ${attempt.order.number}`,
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
  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: { rawVerify: verification.raw as object, providerReference: verification.providerReference || attempt.providerReference },
  });
  if (decision === "accept") {
    await markPaid(attempt.id);
    return { ok: true as const, status: "successful" as const, orderNumber: attempt.order.number };
  }
  if (decision === "fail") {
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["INITIATED", "PENDING"] } },
      data: { status: "FAILED" },
    });
    return { ok: true as const, status: "failed" as const, orderNumber: attempt.order.number };
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
  return { ok: true as const, status: "pending" as const, orderNumber: attempt.order.number };
}

export async function markPaid(attemptId: string) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: attemptId },
    include: { order: { include: { items: true } } },
  });
  if (!attempt) return;
  let shouldEmail = false;
  try {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${attempt.orderId} FOR UPDATE`;
    const updated = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["INITIATED", "PENDING", "FAILED"] } },
      data: { status: "SUCCESSFUL" },
    });
    if (updated.count === 0) return;
    const order = await tx.order.findUnique({ where: { id: attempt.orderId } });
    if (!order || order.paymentStatus === "PAID") return;
    if (order.fulfilmentStatus === "CANCELLED") throw new Error("CANCELLED");
    for (const item of attempt.order.items) {
      if (!item.productId) continue;
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      const moved = await moveStock(tx, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        trackInventory: product?.trackInventory ?? true,
      }, "commit", "sale", order.id);
      if (!moved) throw new Error("STOCK");
      await tx.product.update({ where: { id: item.productId }, data: { unitsSold: { increment: item.quantity } } });
    }
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
        fulfilmentStatus: order.fulfilmentStatus === "PENDING" ? "CONFIRMED" : order.fulfilmentStatus,
        confirmationSentAt: order.confirmationSentAt ?? new Date(),
      },
    });
    await tx.orderEvent.create({
      data: { orderId: order.id, kind: "payment", fromStatus: order.paymentStatus, toStatus: "PAID", note: attempt.provider },
    });
    if (order.couponCode && !order.couponCounted) {
      const coupon = await tx.coupon.findUnique({ where: { code: order.couponCode } });
      if (coupon) {
        await tx.couponRedemption.create({
          data: { couponId: coupon.id, orderId: order.id, userId: order.userId, email: order.email, amount: order.discount },
        });
        await tx.order.update({ where: { id: order.id }, data: { couponCounted: true } });
      }
    }
    shouldEmail = order.confirmationSentAt == null;
  });
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
    const fresh = await prisma.order.findUnique({ where: { id: attempt.orderId } });
    if (fresh) {
      await sendOrderNotice({
        email: fresh.email,
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
  try {
    await prisma.webhookEvent.create({
      data: { provider, eventId: authResult.eventId, payload: authResult.payload as object },
    });
  } catch {
    return { status: 200 };
  }
  let outcome = "ignored";
  if (authResult.reference) {
    const result = await verifyAttempt(authResult.reference);
    outcome = result.ok ? result.status : result.error;
  }
  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider, eventId: authResult.eventId } },
    data: { processedAt: new Date(), outcome },
  });
  return { status: 200 };
}
