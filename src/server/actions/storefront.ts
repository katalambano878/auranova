"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../db";
import { ensureCart } from "../cart";
import { availableUnits, priceWithSettings } from "../catalog";
import { getSettings } from "../settings";
import { getSession } from "../session";
import { rateLimit } from "../rate-limit";
import { normalizeGhanaPhone } from "@/lib/ghana";

export async function addToCart(productId: string, variantId: string | null, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return { ok: false as const, error: "Choose a quantity between 1 and 20." };
  }
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "PUBLISHED", deletedAt: null },
    include: { variants: true },
  });
  if (!product) return { ok: false as const, error: "That product is not available." };
  const variant = variantId ? product.variants.find((item) => item.id === variantId) ?? null : null;
  if (product.variants.length && !variant) return { ok: false as const, error: "Choose an available option." };
  const settings = await getSettings();
  const available = variant
    ? availableUnits(product.trackInventory, variant.onHand, variant.reserved)
    : availableUnits(product.trackInventory, product.onHand, product.reserved);
  const cart = await ensureCart();
  const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId, variantId } });
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (product.trackInventory && nextQuantity > available) {
    return { ok: false as const, error: available > 0 ? `Only ${available} available.` : "Out of stock." };
  }
  if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
  else await prisma.cartItem.create({ data: { cartId: cart.id, productId, variantId, quantity } });
  revalidatePath("/", "layout");
  return { ok: true as const, price: priceWithSettings(settings, product, variant).current };
}

export async function updateCartItem(itemId: string, quantity: number) {
  const cart = await ensureCart();
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id }, include: { product: true, variant: true } });
  if (!item) return { ok: false as const, error: "Item not found." };
  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    revalidatePath("/", "layout");
    return { ok: true as const };
  }
  const available = item.variant
    ? availableUnits(item.product.trackInventory, item.variant.onHand, item.variant.reserved)
    : availableUnits(item.product.trackInventory, item.product.onHand, item.product.reserved);
  if (item.product.trackInventory && quantity > available) return { ok: false as const, error: `Only ${available} available.` };
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function clearCart() {
  const cart = await ensureCart();
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setCoupon(code: string) {
  const jar = await cookies();
  const clean = code.trim().toUpperCase();
  if (!clean) {
    jar.delete("auranova_coupon");
    return { ok: true as const };
  }
  const coupon = await prisma.coupon.findUnique({ where: { code: clean } });
  if (!coupon || !coupon.active) return { ok: false as const, error: "That coupon is not active." };
  jar.set("auranova_coupon", clean, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return { ok: true as const };
}

export async function subscribeNewsletter(email: string) {
  const parsed = z.email().safeParse(email.trim().toLowerCase());
  if (!parsed.success) return { ok: false as const, error: "Enter a valid email address." };
  const limited = await rateLimit(`newsletter:${parsed.data}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return { ok: false as const, error: "Too many attempts. Try again later." };
  await prisma.newsletterSubscriber.upsert({
    where: { email: parsed.data },
    update: {},
    create: { email: parsed.data, status: "confirmed" },
  });
  return { ok: true as const, message: "You're on the list." };
}

export async function sendContact(input: { name: string; email: string; phone?: string; message: string }) {
  const schema = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.email(),
    phone: z.string().trim().max(24).optional(),
    message: z.string().trim().min(10).max(2000),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Check the form." };
  if (parsed.data.phone && !normalizeGhanaPhone(parsed.data.phone)) return { ok: false as const, error: "Enter a valid Ghana phone number or leave it blank." };
  const limited = await rateLimit(`contact:${parsed.data.email}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return { ok: false as const, error: "Too many messages. Try again later." };
  await prisma.contactMessage.create({ data: parsed.data });
  await prisma.notification.create({
    data: { kind: "contact", title: `Message from ${parsed.data.name}`, body: parsed.data.message, emailNote: "Stored for staff. Email is sent only when a provider is configured." },
  });
  return { ok: true as const, message: "Message received. We store it for the store team." };
}

export async function syncCart() {
  await ensureCart();
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function mergeWishlist(productIds: string[]) {
  const session = await getSession();
  if (!session) return { ok: false as const };
  const ids = productIds.filter((id) => typeof id === "string").slice(0, 50);
  for (const productId of ids) {
    const product = await prisma.product.findFirst({ where: { id: productId, status: "PUBLISHED", deletedAt: null } });
    if (!product) continue;
    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: session.user.id, productId } },
      update: {},
      create: { userId: session.user.id, productId },
    });
  }
  return { ok: true as const };
}

export async function toggleWishlist(productId: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, guest: true };
  const where = { userId_productId: { userId: session.user.id, productId } };
  const existing = await prisma.wishlistItem.findUnique({ where });
  if (existing) await prisma.wishlistItem.delete({ where });
  else await prisma.wishlistItem.create({ data: { userId: session.user.id, productId } });
  revalidatePath("/wishlist");
  return { ok: true as const, saved: !existing };
}
