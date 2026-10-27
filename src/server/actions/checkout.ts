"use server";

import { headers } from "next/headers";
import { placeOrder, prepareCheckout, parseCheckout, retryPayment, shippingChoices, enabledPaymentMethods } from "../checkout";
import { cartView } from "../cart";
import { rateLimit } from "../rate-limit";

async function clientKey() {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-for") || "local";
}

export async function quoteCheckoutAction(input: unknown) {
  const parsed = parseCheckout(input);
  if (!parsed.ok) return parsed;
  const quote = await prepareCheckout(parsed.data);
  if (!quote.ok) return quote;
  return {
    ok: true as const,
    subtotal: quote.subtotal,
    discount: quote.discount,
    shippingFee: quote.shippingFee,
    tax: quote.tax,
    total: quote.total,
    currency: quote.currency,
    methodName: quote.method.name,
  };
}

export async function deliveryOptionsAction(region: string, city: string) {
  const cart = await cartView();
  const weight = cart.items.reduce((sum, item) => sum + ((item.variant?.weightGrams ?? item.product.weightGrams ?? 0) * item.quantity), 0);
  const methods = await shippingChoices(region, city, cart.subtotal, weight);
  return methods.map((method) => ({
    id: method.id,
    name: method.name,
    fee: method.calculatedFee,
    available: method.available,
    reason: method.reason || null,
    estimateMinDays: method.estimateMinDays,
    estimateMaxDays: method.estimateMaxDays,
    pickupInstructions: method.pickupInstructions,
  }));
}

export async function placeOrderAction(input: unknown) {
  const limited = await rateLimit(`checkout:${await clientKey()}`, 8, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false as const, error: "Too many checkout attempts. Wait a few minutes." };
  return placeOrder(input);
}

export async function retryPaymentAction(reference: string) {
  const limited = await rateLimit(`retry:${reference}`, 5, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false as const, error: "Too many payment retries." };
  return retryPayment(reference);
}

export async function paymentMethodsAction() {
  return enabledPaymentMethods();
}
