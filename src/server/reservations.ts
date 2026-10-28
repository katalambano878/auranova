import { nid, supabaseAdmin, throwIf } from "./db";
import { moveStock } from "./inventory";
import { notify } from "./notifications";

export async function releaseExpiredReservations() {
  const db = supabaseAdmin();
  const { data: due, error } = await db
    .from("Order")
    .select("*, items:OrderItem(*)")
    .lt("reservationExpiresAt", new Date().toISOString())
    .in("paymentStatus", ["UNPAID", "PENDING", "FAILED"])
    .eq("fulfilmentStatus", "PENDING")
    .limit(100);
  throwIf(error);
  let released = 0;
  for (const order of due || []) {
    const { data: current, error: currentError } = await db.from("Order").select("fulfilmentStatus, paymentStatus").eq("id", order.id).maybeSingle();
    throwIf(currentError);
    if (!current || current.fulfilmentStatus !== "PENDING" || current.paymentStatus === "PAID") continue;
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
        "release",
        "reservation_expired",
        order.id,
      );
    }
    const updated = await db
      .from("Order")
      .update({ fulfilmentStatus: "CANCELLED", paymentStatus: "FAILED", reservationExpiresAt: null })
      .eq("id", order.id);
    throwIf(updated.error);
    const event = await db.from("OrderEvent").insert({
      id: nid(),
      orderId: order.id,
      kind: "reservation",
      fromStatus: "PENDING",
      toStatus: "CANCELLED",
      note: "Hold expired",
    });
    throwIf(event.error);
    released += 1;
  }
  return released;
}

export async function raiseLowStockAlerts() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const db = supabaseAdmin();
  const { data: recent, error: recentError } = await db
    .from("Notification")
    .select("id")
    .eq("kind", "low_stock")
    .gte("createdAt", since)
    .limit(1)
    .maybeSingle();
  throwIf(recentError);
  if (recent) return 0;
  const { data: products, error } = await db
    .from("Product")
    .select("sku, onHand, reserved, lowStockThreshold, variants:ProductVariant(onHand, reserved)")
    .eq("status", "PUBLISHED")
    .is("deletedAt", null)
    .eq("trackInventory", true);
  throwIf(error);
  const low = (products || []).filter((product) => {
    const variants = product.variants || [];
    const units = variants.length
      ? variants.reduce((sum, variant) => sum + variant.onHand - variant.reserved, 0)
      : product.onHand - product.reserved;
    return units <= product.lowStockThreshold;
  });
  if (!low.length) return 0;
  await notify({
    kind: "low_stock",
    title: `${low.length} product${low.length === 1 ? "" : "s"} at or below the low-stock line`,
    body: low.map((product) => product.sku).join(", "),
  });
  return low.length;
}
