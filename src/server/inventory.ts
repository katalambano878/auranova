import { supabaseAdmin } from "./db";

type StockTarget = { productId: string; variantId: string | null; quantity: number; trackInventory: boolean };
type StockOp = "reserve" | "release" | "commit" | "commit_now" | "restock";

export async function moveStock(target: StockTarget, sql: StockOp, reason: string, orderId?: string) {
  const { data, error } = await supabaseAdmin().rpc("move_stock", {
    p_product_id: target.productId,
    p_variant_id: target.variantId,
    p_quantity: target.quantity,
    p_track: target.trackInventory,
    p_op: sql,
    p_reason: reason,
    p_order_id: orderId ?? null,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}
