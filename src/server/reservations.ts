import { prisma } from "./db";
import { moveStock } from "./inventory";
import { notify } from "./notifications";

export async function releaseExpiredReservations() {
  const due = await prisma.order.findMany({
    where: {
      reservationExpiresAt: { lt: new Date() },
      paymentStatus: { in: ["UNPAID", "PENDING", "FAILED"] },
      fulfilmentStatus: "PENDING",
    },
    include: { items: true },
    take: 100,
  });
  let released = 0;
  for (const order of due) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current || current.fulfilmentStatus !== "PENDING" || current.paymentStatus === "PAID") return;
      for (const item of order.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        await moveStock(tx, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          trackInventory: product?.trackInventory ?? true,
        }, "release", "reservation_expired", order.id);
      }
      await tx.order.update({
        where: { id: order.id },
        data: { fulfilmentStatus: "CANCELLED", paymentStatus: "FAILED", reservationExpiresAt: null },
      });
      await tx.orderEvent.create({
        data: { orderId: order.id, kind: "reservation", fromStatus: "PENDING", toStatus: "CANCELLED", note: "Hold expired" },
      });
    });
    released += 1;
  }
  return released;
}

export async function raiseLowStockAlerts() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.notification.findFirst({ where: { kind: "low_stock", createdAt: { gte: since } } });
  if (recent) return 0;
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", deletedAt: null, trackInventory: true },
    include: { variants: true },
  });
  const low = products.filter((product) => {
    const units = product.variants.length
      ? product.variants.reduce((sum, variant) => sum + variant.onHand - variant.reserved, 0)
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
