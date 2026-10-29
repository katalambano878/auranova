import { z } from "zod";
import { evaluateCoupon } from "@/lib/coupons";
import { GHANA_REGIONS, isDigitalAddress, normalizeGhanaPhone } from "@/lib/ghana";
import { formatMoney } from "@/lib/money";
import { appUrl } from "./env";
import { taxPortion } from "@/lib/pricing";
import { quoteShipping, type ShippingMethodRule } from "@/lib/shipping";
import { accraDayKey } from "@/lib/time";
import { nid, supabaseAdmin, throwIf } from "./db";
import { moveStock } from "./inventory";
import { adapters, type ProviderName } from "./payments/adapters";
import { cartView, ensureCart } from "./cart";
import { getSettings } from "./settings";
import { sendOrderNotice } from "./notifications";
import { getSession } from "./session";

const checkoutSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email(),
  phone: z.string().trim().min(8).max(24),
  region: z.string().refine((value) => GHANA_REGIONS.includes(value as (typeof GHANA_REGIONS)[number]), "Choose a region in Ghana."),
  city: z.string().trim().min(1).max(80),
  line1: z.string().trim().min(3).max(200),
  landmark: z.string().trim().max(200).optional().default(""),
  digitalAddress: z.string().trim().max(20).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default(""),
  instructions: z.string().trim().max(400).optional().default(""),
  notes: z.string().trim().max(400).optional().default(""),
  shippingMethodId: z.string().min(1),
  paymentMethod: z.string().min(1),
  couponCode: z.string().trim().max(40).optional().default(""),
  idempotencyKey: z.string().uuid(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function parseCheckout(input: unknown) {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Check the checkout details." };
  const phone = normalizeGhanaPhone(parsed.data.phone);
  if (!phone) return { ok: false as const, error: "Enter a valid Ghana phone number." };
  if (parsed.data.digitalAddress && !isDigitalAddress(parsed.data.digitalAddress)) {
    return { ok: false as const, error: "GhanaPost digital addresses look like GA-123-4567." };
  }
  return { ok: true as const, data: { ...parsed.data, phone } };
}

export async function enabledPaymentMethods() {
  const settings = await getSettings();
  const methods: { id: string; label: string }[] = [];
  if (settings.payOnDeliveryEnabled) methods.push({ id: "pay_on_delivery", label: "Pay on delivery" });
  if (settings.moolreEnabled && process.env.MOOLRE_API_USER && process.env.MOOLRE_API_PUBKEY && process.env.MOOLRE_ACCOUNT_NUMBER && process.env.MOOLRE_MERCHANT_EMAIL) {
    methods.push({ id: "moolre", label: "Moolre" });
  }
  if (settings.flutterwaveEnabled && process.env.FLUTTERWAVE_SECRET_KEY) methods.push({ id: "flutterwave", label: "Flutterwave" });
  if (settings.paystackEnabled && process.env.PAYSTACK_SECRET_KEY) methods.push({ id: "paystack", label: "Paystack" });
  if (settings.hubtelEnabled && process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET && process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER) {
    methods.push({ id: "hubtel", label: "Hubtel" });
  }
  return methods;
}

export async function shippingChoices(region: string, city: string, subtotal: number, weightGrams: number) {
  const { data: zones, error } = await supabaseAdmin()
    .from("ShippingZone")
    .select("regions, cities, methods:ShippingMethod(*)")
    .eq("active", true);
  throwIf(error);
  const methods = (zones || []).flatMap((zone) =>
    (zone.methods || [])
      .filter((method: { active: boolean }) => method.active)
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      .map((method: Record<string, unknown>) => ({ ...method, regions: zone.regions, cities: zone.cities })),
  );
  return quoteShipping(methods as ShippingMethodRule[], { region, city, subtotal, weightGrams });
}

async function couponDecision(code: string, email: string, lines: { productId: string; categoryId: string; quantity: number; unitPrice: number }[]) {
  if (!code) return { ok: true as const, discount: 0, freeShipping: false, coupon: null };
  const db = supabaseAdmin();
  const { data: coupon, error } = await db.from("Coupon").select("*").eq("code", code.toUpperCase()).maybeSingle();
  throwIf(error);
  if (!coupon) return { ok: false as const, error: "Coupon not found." };
  const [usageRes, customerRes, priorRes] = await Promise.all([
    db.from("CouponRedemption").select("id", { count: "exact", head: true }).eq("couponId", coupon.id),
    db.from("CouponRedemption").select("id", { count: "exact", head: true }).eq("couponId", coupon.id).eq("email", email.toLowerCase()),
    db
      .from("Order")
      .select("id", { count: "exact", head: true })
      .eq("email", email.toLowerCase())
      .neq("fulfilmentStatus", "CANCELLED")
      .or("paymentStatus.eq.PAID,and(provider.eq.pay_on_delivery,fulfilmentStatus.neq.CANCELLED)"),
  ]);
  throwIf(usageRes.error);
  throwIf(customerRes.error);
  throwIf(priorRes.error);
  const decision = evaluateCoupon(
    {
      type: coupon.type,
      amount: coupon.amount,
      minSubtotal: coupon.minSubtotal,
      maxDiscount: coupon.maxDiscount,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
      active: coupon.active,
      usageLimit: coupon.usageLimit,
      usageCount: usageRes.count ?? 0,
      perCustomerLimit: coupon.perCustomerLimit,
      customerUses: customerRes.count ?? 0,
      firstOrderOnly: coupon.firstOrderOnly,
      isFirstOrder: (priorRes.count ?? 0) === 0,
      productIds: coupon.productIds,
      categoryIds: coupon.categoryIds,
      excludedProductIds: coupon.excludedProductIds,
    },
    lines,
  );
  if (!decision.ok) return decision;
  return { ...decision, coupon };
}

export async function prepareCheckout(input: CheckoutInput) {
  const cart = await cartView();
  if (!cart.items.length) return { ok: false as const, error: "Your cart is empty." };
  if (cart.problems.length) return { ok: false as const, error: cart.problems[0] };
  const lines = cart.items.map((item: any) => ({
    productId: item.productId,
    categoryId: item.product.categoryId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    name: item.product.name,
    variantName: item.variant?.label ?? null,
    sku: item.variant?.sku ?? item.product.sku,
    variantId: item.variantId,
    weight: (item.variant?.weightGrams ?? item.product.weightGrams ?? 0) * item.quantity,
    trackInventory: item.product.trackInventory,
  }));
  const subtotal = lines.reduce((sum: any, line: any) => sum + line.unitPrice * line.quantity, 0);
  const weight = lines.reduce((sum: any, line: any) => sum + line.weight, 0);
  const methods = await shippingChoices(input.region, input.city, subtotal, weight);
  const method = methods.find((item) => item.id === input.shippingMethodId && item.available);
  if (!method) return { ok: false as const, error: "Choose an available delivery method." };
  const coupon = await couponDecision(input.couponCode, input.email, lines);
  if (!coupon.ok) return coupon;
  const settings = await getSettings();
  const shippingFee = coupon.freeShipping ? 0 : method.calculatedFee;
  const discounted = Math.max(subtotal - coupon.discount, 0);
  const taxable = discounted + shippingFee;
  const tax = taxPortion(taxable, settings.taxRateBps, settings.pricesIncludeTax);
  const total = settings.pricesIncludeTax ? taxable : taxable + tax;
  const payments = await enabledPaymentMethods();
  if (!payments.some((item) => item.id === input.paymentMethod)) {
    return { ok: false as const, error: "That payment method is not available." };
  }
  return {
    ok: true as const,
    lines,
    subtotal,
    discount: coupon.discount,
    shippingFee,
    tax,
    total,
    method,
    couponCode: coupon.coupon?.code ?? null,
    settings,
    currency: settings.currency,
  };
}

function orderNumber() {
  const day = accraDayKey(new Date()).replaceAll("-", "");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `AN-${day}-${suffix}`;
}

type QuoteLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  trackInventory: boolean;
  name: string;
  variantName: string | null;
  sku: string;
  unitPrice: number;
};

async function releaseReserved(lines: QuoteLine[], online: boolean, orderId?: string) {
  if (!online) return;
  for (const line of lines) {
    await moveStock(
      { productId: line.productId, variantId: line.variantId, quantity: line.quantity, trackInventory: line.trackInventory },
      "release",
      "checkout_rollback",
      orderId,
    );
  }
}

async function idempotentOrderResponse(idempotencyKey: string) {
  const db = supabaseAdmin();
  const { data: existing, error } = await db.from("Order").select("*").eq("idempotencyKey", idempotencyKey).maybeSingle();
  throwIf(error);
  if (!existing) return null;
  const { data: attempt, error: attemptError } = await db
    .from("PaymentAttempt")
    .select("*")
    .eq("orderId", existing.id)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIf(attemptError);
  return {
    ok: true as const,
    orderNumber: existing.number,
    attemptReference: attempt?.reference ?? "",
    checkoutUrl: attempt?.checkoutUrl ?? null,
    paymentStatus: existing.paymentStatus,
  };
}

export async function placeOrder(raw: unknown) {
  const parsed = parseCheckout(raw);
  if (!parsed.ok) return parsed;
  const quote = await prepareCheckout(parsed.data);
  if (!quote.ok) return quote;
  const raced = await idempotentOrderResponse(parsed.data.idempotencyKey);
  if (raced) return raced;
  const session = await getSession();
  const cart = await ensureCart();
  const reference = `ANP${crypto.randomUUID().replace(/-/g, "")}`;
  const address = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
    country: "GH",
    region: parsed.data.region,
    city: parsed.data.city,
    line1: parsed.data.line1,
    landmark: parsed.data.landmark || null,
    digitalAddress: parsed.data.digitalAddress || null,
    postalCode: parsed.data.postalCode || null,
    instructions: parsed.data.instructions || null,
  };
  const online = parsed.data.paymentMethod !== "pay_on_delivery";
  let orderId = "";
  let orderNo = "";
  const db = supabaseAdmin();
  try {
    for (const line of quote.lines) {
      const moved = await moveStock(
        {
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          trackInventory: line.trackInventory,
        },
        online ? "reserve" : "commit_now",
        online ? "reserve" : "pay_on_delivery",
        undefined,
      );
      if (!moved) throw new Error("STOCK");
    }
    orderId = nid();
    orderNo = orderNumber();
    const orderInsert = await db.from("Order").insert({
      id: orderId,
      number: orderNo,
      userId: session?.user.id,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      customerName: `${parsed.data.firstName} ${parsed.data.lastName}`,
      idempotencyKey: parsed.data.idempotencyKey,
      paymentStatus: "UNPAID",
      fulfilmentStatus: online ? "PENDING" : "CONFIRMED",
      currency: quote.currency,
      subtotal: quote.subtotal,
      discount: quote.discount,
      shippingFee: quote.shippingFee,
      tax: quote.tax,
      total: quote.total,
      taxInclusive: quote.settings.pricesIncludeTax,
      taxRateBps: quote.settings.taxRateBps,
      couponCode: quote.couponCode,
      shippingMethodName: quote.method.name,
      shippingAddress: address,
      customerNotes: parsed.data.notes || null,
      reservationExpiresAt: online ? new Date(Date.now() + quote.settings.reservationMinutes * 60 * 1000).toISOString() : null,
      provider: parsed.data.paymentMethod,
    });
    if (orderInsert.error) {
      if (orderInsert.error.message.includes("duplicate") || orderInsert.error.code === "23505") {
        await releaseReserved(quote.lines, online);
        const again = await idempotentOrderResponse(parsed.data.idempotencyKey);
        if (again) return again;
      }
      throw new Error(orderInsert.error.message);
    }
    const itemsInsert = await db.from("OrderItem").insert(
      quote.lines.map((line: any) => ({
        id: nid(),
        orderId,
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        variantName: line.variantName,
        sku: line.sku,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.unitPrice * line.quantity,
      })),
    );
    throwIf(itemsInsert.error);
    const eventInsert = await db.from("OrderEvent").insert({
      id: nid(),
      orderId,
      kind: "order",
      toStatus: online ? "PENDING" : "CONFIRMED",
      note: parsed.data.paymentMethod,
    });
    throwIf(eventInsert.error);
    if (!online && quote.couponCode) {
      const { data: coupon, error: couponError } = await db.from("Coupon").select("id").eq("code", quote.couponCode).maybeSingle();
      throwIf(couponError);
      if (coupon) {
        const redemption = await db.from("CouponRedemption").insert({
          couponId: coupon.id,
          orderId,
          userId: session?.user.id,
          email: parsed.data.email.toLowerCase(),
          amount: quote.discount,
        });
        throwIf(redemption.error);
        const counted = await db.from("Order").update({ couponCounted: true }).eq("id", orderId);
        throwIf(counted.error);
      }
    }
    const attemptInsert = await db.from("PaymentAttempt").insert({
      id: nid(),
      orderId,
      provider: parsed.data.paymentMethod,
      reference,
      amount: quote.total,
      currency: quote.currency,
      status: online ? "INITIATED" : "PENDING",
    });
    throwIf(attemptInsert.error);
    const cleared = await db.from("CartItem").delete().eq("cartId", cart.id);
    throwIf(cleared.error);
  } catch (error) {
    if (error instanceof Error && error.message === "STOCK") return { ok: false as const, error: "A product sold out while you were checking out." };
    await releaseReserved(quote.lines, online, orderId || undefined);
    const again = await idempotentOrderResponse(parsed.data.idempotencyKey);
    if (again) return again;
    throw error;
  }

  if (!online) {
    await sendOrderNotice({
      email: parsed.data.email,
      phone: parsed.data.phone,
      orderNumber: orderNo,
      totalLabel: formatMoney(quote.total, quote.currency),
      paymentStatus: "unpaid — pay on delivery",
    });
    const sent = await db.from("Order").update({ confirmationSentAt: new Date().toISOString() }).eq("id", orderId);
    throwIf(sent.error);
    return { ok: true as const, orderNumber: orderNo, attemptReference: reference, checkoutUrl: null, paymentStatus: "UNPAID" };
  }

  const base = appUrl();
  const started = await adapters[parsed.data.paymentMethod as ProviderName].initiate({
    reference,
    amount: quote.total,
    email: parsed.data.email,
    name: `${parsed.data.firstName} ${parsed.data.lastName}`,
    phone: parsed.data.phone,
    callbackUrl: `${base}/api/webhooks/${parsed.data.paymentMethod}`,
    redirectUrl: `${base}/checkout/confirmation?attempt=${reference}`,
  });
  if (!started.ok) {
    await db.from("PaymentAttempt").update({ status: "FAILED" }).eq("reference", reference);
    return {
      ok: true as const,
      orderNumber: orderNo,
      attemptReference: reference,
      checkoutUrl: null,
      paymentStatus: "FAILED",
      error: started.error,
    };
  }
  await db.from("PaymentAttempt").update({ status: "PENDING", checkoutUrl: started.url }).eq("reference", reference);
  await db.from("Order").update({ paymentStatus: "PENDING" }).eq("id", orderId);
  return { ok: true as const, orderNumber: orderNo, attemptReference: reference, checkoutUrl: started.url, paymentStatus: "PENDING" };
}

export async function retryPayment(reference: string) {
  const db = supabaseAdmin();
  const { data: attempt, error } = await db.from("PaymentAttempt").select("*, order:Order(*)").eq("reference", reference).maybeSingle();
  throwIf(error);
  if (!attempt?.order) return { ok: false as const, error: "Payment attempt not found." };
  const order = attempt.order as { paymentStatus: string; fulfilmentStatus: string; email: string; customerName: string; phone: string; shippingAddress: unknown; id: string };
  if (order.paymentStatus === "PAID") return { ok: true as const, checkoutUrl: null, attemptReference: reference };
  if (order.fulfilmentStatus === "CANCELLED") return { ok: false as const, error: "This order has expired." };
  if (attempt.provider === "pay_on_delivery") return { ok: false as const, error: "This order is paid on delivery." };
  const nextReference = `ANP${crypto.randomUUID().replace(/-/g, "")}`;
  const created = await db.from("PaymentAttempt").insert({
    id: nid(),
    orderId: attempt.orderId,
    provider: attempt.provider,
    reference: nextReference,
    amount: attempt.amount,
    currency: attempt.currency,
    status: "INITIATED",
  });
  throwIf(created.error);
  const base = appUrl();
  const address = order.shippingAddress as { phone?: string };
  const started = await adapters[attempt.provider as ProviderName].initiate({
    reference: nextReference,
    amount: attempt.amount,
    email: order.email,
    name: order.customerName,
    phone: address.phone || order.phone,
    callbackUrl: `${base}/api/webhooks/${attempt.provider}`,
    redirectUrl: `${base}/checkout/confirmation?attempt=${nextReference}`,
  });
  if (!started.ok) {
    await db.from("PaymentAttempt").update({ status: "FAILED" }).eq("reference", nextReference);
    return { ok: false as const, error: started.error };
  }
  await db.from("PaymentAttempt").update({ status: "PENDING", checkoutUrl: started.url }).eq("reference", nextReference);
  return { ok: true as const, checkoutUrl: started.url, attemptReference: nextReference };
}
