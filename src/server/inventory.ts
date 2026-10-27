import { prisma } from "./db";

type StockTarget = { productId: string; variantId: string | null; quantity: number; trackInventory: boolean };

async function updateStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  target: StockTarget,
  sql: "reserve" | "release" | "commit" | "commit_now" | "restock",
) {
  if (!target.trackInventory) return true;
  const qty = target.quantity;
  if (target.variantId) {
    const changed =
      sql === "reserve"
        ? await tx.$executeRaw`UPDATE "ProductVariant" SET reserved = reserved + ${qty} WHERE id = ${target.variantId} AND "onHand" - reserved >= ${qty}`
        : sql === "release"
          ? await tx.$executeRaw`UPDATE "ProductVariant" SET reserved = GREATEST(reserved - ${qty}, 0) WHERE id = ${target.variantId}`
          : sql === "commit"
            ? await tx.$executeRaw`UPDATE "ProductVariant" SET reserved = GREATEST(reserved - ${qty}, 0), "onHand" = GREATEST("onHand" - ${qty}, 0) WHERE id = ${target.variantId}`
            : sql === "commit_now"
              ? await tx.$executeRaw`UPDATE "ProductVariant" SET "onHand" = "onHand" - ${qty} WHERE id = ${target.variantId} AND "onHand" - reserved >= ${qty}`
              : await tx.$executeRaw`UPDATE "ProductVariant" SET "onHand" = "onHand" + ${qty} WHERE id = ${target.variantId}`;
    return changed > 0;
  }
  const changed =
    sql === "reserve"
      ? await tx.$executeRaw`UPDATE "Product" SET reserved = reserved + ${qty} WHERE id = ${target.productId} AND "onHand" - reserved >= ${qty}`
      : sql === "release"
        ? await tx.$executeRaw`UPDATE "Product" SET reserved = GREATEST(reserved - ${qty}, 0) WHERE id = ${target.productId}`
        : sql === "commit"
          ? await tx.$executeRaw`UPDATE "Product" SET reserved = GREATEST(reserved - ${qty}, 0), "onHand" = GREATEST("onHand" - ${qty}, 0) WHERE id = ${target.productId}`
          : sql === "commit_now"
            ? await tx.$executeRaw`UPDATE "Product" SET "onHand" = "onHand" - ${qty} WHERE id = ${target.productId} AND "onHand" - reserved >= ${qty}`
            : await tx.$executeRaw`UPDATE "Product" SET "onHand" = "onHand" + ${qty} WHERE id = ${target.productId}`;
  return changed > 0;
}

export async function moveStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  target: StockTarget,
  sql: "reserve" | "release" | "commit" | "commit_now" | "restock",
  reason: string,
  orderId?: string,
) {
  const ok = await updateStock(tx, target, sql);
  if (!ok) return false;
  if (target.trackInventory) {
    const delta = sql === "restock" || sql === "release" ? target.quantity : -target.quantity;
    await tx.inventoryMovement.create({
      data: {
        productId: target.productId,
        variantId: target.variantId,
        delta,
        reason,
        orderId,
      },
    });
  }
  return true;
}
