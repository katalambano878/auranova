import { canTransitionFulfilment, type FulfilmentStatus } from "@/lib/order-status";
import { formatMoney } from "@/lib/money";
import { audit } from "./audit";
import { prisma } from "./db";
import { moveStock } from "./inventory";
import { adapters, type ProviderName } from "./payments/adapters";
import { notify } from "./notifications";

export async function transitionFulfilment(input: {
  actorId: string;
  orderId: string;
  to: FulfilmentStatus;
  note?: string;
  trackingRef?: string;
}) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { items: true, shipment: true } });
  if (!order) return { ok: false as const, error: "Order not found." };
  if (!canTransitionFulfilment(order.fulfilmentStatus, input.to)) {
    return { ok: false as const, error: `Cannot move an order from ${order.fulfilmentStatus} to ${input.to}.` };
  }
  if (input.to === "CANCELLED" && order.paymentStatus === "PAID") {
    return { ok: false as const, error: "Refund a paid order instead of cancelling it." };
  }
  await prisma.$transaction(async (tx) => {
    if (input.to === "CANCELLED") {
      for (const item of order.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        await moveStock(tx, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          trackInventory: product?.trackInventory ?? true,
        }, order.provider === "pay_on_delivery" ? "restock" : "release", "cancelled", order.id);
      }
    }
    await tx.order.update({ where: { id: order.id }, data: { fulfilmentStatus: input.to } });
    await tx.orderEvent.create({
      data: { orderId: order.id, kind: "fulfilment", fromStatus: order.fulfilmentStatus, toStatus: input.to, note: input.note, actorId: input.actorId },
    });
    if (input.to === "SHIPPED") {
      await tx.shipment.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, trackingRef: input.trackingRef || null, shippedAt: new Date(), notes: input.note },
        update: { trackingRef: input.trackingRef || null, shippedAt: new Date(), notes: input.note },
      });
    }
  });
  await audit({ actorId: input.actorId, action: "order.fulfilment", entity: "order", entityId: order.id, metadata: { to: input.to } });
  if (input.to === "SHIPPED" || input.to === "DELIVERED" || input.to === "CANCELLED") {
    await notify({
      kind: "fulfilment",
      title: `${order.number} ${input.to.toLowerCase()}`,
      body: input.note || "",
      email: {
        to: order.email,
        subject: `Order ${order.number}`,
        text: `Your order ${order.number} is now ${input.to.toLowerCase().replaceAll("_", " ")}.${input.trackingRef ? `\nTracking: ${input.trackingRef}` : ""}`,
      },
    });
  }
  return { ok: true as const };
}

export async function requestRefund(input: {
  actorId: string;
  orderId: string;
  amount: number;
  reason: string;
  restock: boolean;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { attempts: { where: { status: "SUCCESSFUL" }, orderBy: { createdAt: "desc" } }, refunds: true, items: true },
  });
  if (!order) return { ok: false as const, error: "Order not found." };
  if (order.paymentStatus !== "PAID" && order.paymentStatus !== "PARTIALLY_REFUNDED") {
    return { ok: false as const, error: "Only a paid order can be refunded." };
  }
  const refunded = order.refunds.filter((refund) => refund.status === "REFUNDED").reduce((sum, refund) => sum + refund.amount, 0);
  if (input.amount <= 0 || input.amount > order.total - refunded) {
    return { ok: false as const, error: "Refund amount is not valid for this order." };
  }
  const attempt = order.attempts[0];
  const provider = attempt?.provider as ProviderName | undefined;
  const adapter = provider ? adapters[provider] : undefined;
  if (!adapter?.refund || !attempt?.providerReference) {
    const pending = await prisma.refund.create({
      data: {
        orderId: order.id,
        paymentAttemptId: attempt?.id,
        amount: input.amount,
        reason: input.reason,
        restock: input.restock,
        status: "PENDING",
      },
    });
    await audit({
      actorId: input.actorId,
      action: "refund.pending",
      entity: "refund",
      entityId: pending.id,
      metadata: { provider: provider || order.provider, reason: input.reason },
    });
    return { ok: true as const, status: "PENDING" as const, message: "This provider has no refund call in this integration. Complete the refund in the provider dashboard, then confirm it here." };
  }
  const result = await adapter.refund({ providerReference: attempt.providerReference, amount: input.amount });
  if (!result.ok) return { ok: false as const, error: result.error };
  const status = result.status === "refunded" ? "REFUNDED" : "PENDING";
  await prisma.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        orderId: order.id,
        paymentAttemptId: attempt.id,
        amount: input.amount,
        reason: input.reason,
        restock: input.restock && status === "REFUNDED",
        status,
        providerReference: result.reference,
      },
    });
    if (status === "REFUNDED") {
      const nextRefunded = refunded + input.amount;
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: nextRefunded >= order.total ? "REFUNDED" : "PARTIALLY_REFUNDED",
          fulfilmentStatus: nextRefunded >= order.total && order.fulfilmentStatus === "DELIVERED" ? "REFUNDED" : order.fulfilmentStatus,
        },
      });
      if (input.restock) {
        for (const item of order.items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          await moveStock(tx, {
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            trackInventory: product?.trackInventory ?? true,
          }, "restock", "refund_restock", order.id);
        }
      }
    }
  });
  await audit({ actorId: input.actorId, action: "refund.request", entity: "order", entityId: order.id, metadata: { amount: input.amount, status, restock: input.restock } });
  await notify({
    kind: "refund",
    title: `Refund ${formatMoney(input.amount, order.currency)} for ${order.number}`,
    body: input.reason,
    email: { to: order.email, subject: `Refund update for ${order.number}`, text: `Refund status: ${status.toLowerCase()}.\nAmount: ${formatMoney(input.amount, order.currency)}.` },
  });
  return { ok: true as const, status };
}

export async function confirmManualRefund(input: { actorId: string; refundId: string; reason: string }) {
  const refund = await prisma.refund.findUnique({ where: { id: input.refundId }, include: { order: { include: { items: true, refunds: true } } } });
  if (!refund || refund.status !== "PENDING") return { ok: false as const, error: "There is no pending refund to confirm." };
  await prisma.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: refund.id }, data: { status: "REFUNDED" } });
    const already = refund.order.refunds.filter((item) => item.status === "REFUNDED").reduce((sum, item) => sum + item.amount, 0);
    const next = already + refund.amount;
    await tx.order.update({
      where: { id: refund.orderId },
      data: { paymentStatus: next >= refund.order.total ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
    if (refund.restock) {
      for (const item of refund.order.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        await moveStock(tx, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          trackInventory: product?.trackInventory ?? true,
        }, "restock", "manual_refund_restock", refund.orderId);
      }
    }
  });
  await audit({
    actorId: input.actorId,
    action: "refund.manual",
    entity: "refund",
    entityId: refund.id,
    metadata: { reason: input.reason, manual: true },
  });
  return { ok: true as const };
}
