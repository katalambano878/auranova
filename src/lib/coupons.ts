export type CouponLine = {
  productId: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
};

export type CouponRule = {
  type: "FIXED" | "PERCENT" | "FREE_SHIPPING";
  amount: number;
  minSubtotal: number | null;
  maxDiscount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  customerUses: number;
  firstOrderOnly: boolean;
  isFirstOrder: boolean;
  productIds: string[];
  categoryIds: string[];
  excludedProductIds: string[];
};

export type CouponDecision =
  | { ok: true; discount: number; freeShipping: boolean; eligibleSubtotal: number }
  | { ok: false; reason: string };

export function evaluateCoupon(
  coupon: CouponRule,
  lines: CouponLine[],
  now = new Date(),
): CouponDecision {
  if (!coupon.active) return { ok: false, reason: "This coupon is not active." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, reason: "This coupon is not active yet." };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, reason: "This coupon has expired." };
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }
  if (coupon.perCustomerLimit != null && coupon.customerUses >= coupon.perCustomerLimit) {
    return { ok: false, reason: "You have already used this coupon." };
  }
  if (coupon.firstOrderOnly && !coupon.isFirstOrder) {
    return { ok: false, reason: "This coupon is only for a first order." };
  }

  const eligible = lines.filter((line) => {
    if (coupon.excludedProductIds.includes(line.productId)) return false;
    const productOk = coupon.productIds.length === 0 || coupon.productIds.includes(line.productId);
    const categoryOk = coupon.categoryIds.length === 0 || coupon.categoryIds.includes(line.categoryId);
    if (coupon.productIds.length && coupon.categoryIds.length) return productOk || categoryOk;
    return productOk && categoryOk;
  });
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const orderSubtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (coupon.minSubtotal != null && orderSubtotal < coupon.minSubtotal) {
    return { ok: false, reason: "Your order is below the minimum for this coupon." };
  }
  if (eligibleSubtotal <= 0) return { ok: false, reason: "This coupon does not apply to these products." };

  if (coupon.type === "FREE_SHIPPING") {
    return { ok: true, discount: 0, freeShipping: true, eligibleSubtotal };
  }
  if (coupon.type === "FIXED") {
    const discount = Math.min(Math.max(coupon.amount, 0), eligibleSubtotal);
    return { ok: true, discount, freeShipping: false, eligibleSubtotal };
  }
  const raw = Math.floor((eligibleSubtotal * coupon.amount) / 10000);
  const capped = coupon.maxDiscount != null ? Math.min(raw, coupon.maxDiscount) : raw;
  const discount = Math.min(Math.max(capped, 0), eligibleSubtotal);
  return { ok: true, discount, freeShipping: false, eligibleSubtotal };
}
