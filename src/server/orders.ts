import { canTransitionFulfilment, type FulfilmentStatus } from "@/lib/order-status";
import { formatMoney } from "@/lib/money";
import { audit } from "./audit";
import { nid, supabaseAdmin, throwIf } from "./db";
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
  const db = supabaseAdmin();
  const { data: order, error } = await db.from("Order").select("*, items:OrderItem(*), shipment:Shipment(*)").eq("id", input.orderId).maybeSingle();
  throwIf(error);
  if (!order) return { ok: false as const, error: "Order not found." };
  if (!canTransitionFulfilment(order.fulfilmentStatus, input.to)) {
    return { ok: false as const, error: `Cannot move an order from ${order.fulfilmentStatus} to ${input.to}.` };
  }
  if (input.to === "CANCELLED" && order.paymentStatus === "PAID") {
    return { ok: false as const, error: "Refund a paid order instead of cancelling it." };
  }
  if (input.to === "CANCELLED") {
    for (const item of order.items || []) {
      if (!item.productId) continue;
      const { data: product, error: productError } = await db.from("Product").select("trackInventory").eq("id", item.productId).maybeSingle();
      throwIf(productError);
      await moveStock(
        {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          trackInventory: product?.trackInventory ?? true,
        },
        order.provider === "pay_on_delivery" ? "restock" : "release",
        "cancelled",
        order.id,
      );
    }
  }
  const updated = await db.from("Order").update({ fulfilmentStatus: input.to }).eq("id", order.id);
  throwIf(updated.error);
  const event = await db.from("OrderEvent").insert({
    id: nid(),
    orderId: order.id,
    kind: "fulfilment",
    fromStatus: order.fulfilmentStatus,
    toStatus: input.to,
    note: input.note,
    actorId: input.actorId,
  });
  throwIf(event.error);
  if (input.to === "SHIPPED") {
    const { data: existingShipment, error: shipmentLookupError } = await db.from("Shipment").select("id").eq("orderId", order.id).maybeSingle();
    throwIf(shipmentLookupError);
    const payload = {
      trackingRef: input.trackingRef || null,
      shippedAt: new Date().toISOString(),
      notes: input.note,
    };
    if (existingShipment) {
      const shipment = await db.from("Shipment").update(payload).eq("id", existingShipment.id);
      throwIf(shipment.error);
    } else {
      const shipment = await db.from("Shipment").insert({ id: nid(), orderId: order.id, ...payload });
      throwIf(shipment.error);
    }
  }
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
  const db = supabaseAdmin();
  const { data: order, error } = await db
    .from("Order")
    .select("*, attempts:PaymentAttempt(*), refunds:Refund(*), items:OrderItem(*)")
    .eq("id", input.orderId)
    .maybeSingle();
  throwIf(error);
  if (!order) return { ok: false as const, error: "Order not found." };
  if (order.paymentStatus !== "PAID" && order.paymentStatus !== "PARTIALLY_REFUNDED") {
    return { ok: false as const, error: "Only a paid order can be refunded." };
  }
  const refunds = order.refunds || [];
  const refunded = refunds.filter((refund: any) => refund.status === "REFUNDED").reduce((sum: any, refund: any) => sum + refund.amount, 0);
  if (input.amount <= 0 || input.amount > order.total - refunded) {
    return { ok: false as const, error: "Refund amount is not valid for this order." };
  }
  const attempts = (order.attempts || []).filter((a: any) => a.status === "SUCCESSFUL").sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const attempt = attempts[0];
  const provider = attempt?.provider as ProviderName | undefined;
  const adapter = provider ? adapters[provider] : undefined;
  if (!adapter?.refund || !attempt?.providerReference) {
    const pending = await db
      .from("Refund")
      .insert({
        id: nid(),
        orderId: order.id,
        paymentAttemptId: attempt?.id,
        amount: input.amount,
        reason: input.reason,
        restock: input.restock,
        status: "PENDING",
      })
      .select()
      .single();
    throwIf(pending.error);
    await audit({
      actorId: input.actorId,
      action: "refund.pending",
      entity: "refund",
      entityId: pending.data.id,
      metadata: { provider: provider || order.provider, reason: input.reason },
    });
    return { ok: true as const, status: "PENDING" as const, message: "This provider has no refund call in this integration. Complete the refund in the provider dashboard, then confirm it here." };
  }
  const result = await adapter.refund({ providerReference: attempt.providerReference, amount: input.amount });
  if (!result.ok) return { ok: false as const, error: result.error };
  const status = result.status === "refunded" ? "REFUNDED" : "PENDING";
  const created = await db.from("Refund").insert({
    id: nid(),
    orderId: order.id,
    paymentAttemptId: attempt.id,
    amount: input.amount,
    reason: input.reason,
    restock: input.restock && status === "REFUNDED",
    status,
    providerReference: result.reference,
  });
  throwIf(created.error);
  if (status === "REFUNDED") {
    const nextRefunded = refunded + input.amount;
    await db
      .from("Order")
      .update({
        paymentStatus: nextRefunded >= order.total ? "REFUNDED" : "PARTIALLY_REFUNDED",
        fulfilmentStatus: nextRefunded >= order.total && order.fulfilmentStatus === "DELIVERED" ? "REFUNDED" : order.fulfilmentStatus,
      })
      .eq("id", order.id);
    if (input.restock) {
      for (const item of order.items || []) {
        if (!item.productId) continue;
        const { data: product, error: productError } = await db.from("Product").select("trackInventory").eq("id", item.productId).maybeSingle();
        throwIf(productError);
        await moveStock(
          {
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            trackInventory: product?.trackInventory ?? true,
          },
          "restock",
          "refund_restock",
          order.id,
        );
      }
    }
  }
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
  const db = supabaseAdmin();
  const { data: refund, error } = await db.from("Refund").select("*, order:Order(*, items:OrderItem(*), refunds:Refund(*))").eq("id", input.refundId).maybeSingle();
  throwIf(error);
  if (!refund || refund.status !== "PENDING") return { ok: false as const, error: "There is no pending refund to confirm." };
  const order = refund.order as {
    id: string;
    total: number;
    items: { productId: string | null; variantId: string | null; quantity: number }[];
    refunds: { status: string; amount: number }[];
  };
  const updated = await db.from("Refund").update({ status: "REFUNDED" }).eq("id", refund.id);
  throwIf(updated.error);
  const already = order.refunds.filter((item) => item.status === "REFUNDED").reduce((sum, item) => sum + item.amount, 0);
  const next = already + refund.amount;
  const orderUpdated = await db
    .from("Order")
    .update({ paymentStatus: next >= order.total ? "REFUNDED" : "PARTIALLY_REFUNDED" })
    .eq("id", refund.orderId);
  throwIf(orderUpdated.error);
  if (refund.restock) {
    for (const item of order.items) {
      if (!item.productId) continue;
      const { data: product, error: productError } = await db.from("Product").select("trackInventory").eq("id", item.productId).maybeSingle();
      throwIf(productError);
      await moveStock(
        {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          trackInventory: product?.trackInventory ?? true,
        },
        "restock",
        "manual_refund_restock",
        refund.orderId,
      );
    }
  }
  await audit({
    actorId: input.actorId,
    action: "refund.manual",
    entity: "refund",
    entityId: refund.id,
    metadata: { reason: input.reason, manual: true },
  });
  return { ok: true as const };
}
