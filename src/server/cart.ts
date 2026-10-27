import { cookies } from "next/headers";
import { prisma } from "./db";
import { getSession } from "./session";
import { availableUnits, priceWithSettings, productInclude } from "./catalog";
import { getSettings } from "./settings";

const CART_COOKIE = "auranova_cart";

export async function readCart() {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  const session = await getSession();
  if (session) {
    const cart = await prisma.cart.findUnique({
      where: { userId: session.user.id },
      include: { items: { include: { product: { include: productInclude }, variant: true } } },
    });
    if (cart) return cart;
  }
  if (!token) return null;
  return prisma.cart.findUnique({
    where: { token },
    include: { items: { include: { product: { include: productInclude }, variant: true } } },
  });
}

export async function ensureCart() {
  const session = await getSession();
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (session) {
    const existing = await prisma.cart.findUnique({ where: { userId: session.user.id } });
    if (existing) {
      if (token) await mergeTokenIntoCart(token, existing.id, session.user.id);
      return existing;
    }
    if (token) {
      const guest = await prisma.cart.findUnique({ where: { token } });
      if (guest && !guest.userId) {
        return prisma.cart.update({ where: { id: guest.id }, data: { userId: session.user.id } });
      }
    }
    const created = await prisma.cart.create({ data: { userId: session.user.id, token: crypto.randomUUID() } });
    jar.set(CART_COOKIE, created.token, cookieOptions());
    return created;
  }
  if (token) {
    const guest = await prisma.cart.findUnique({ where: { token } });
    if (guest) return guest;
  }
  const created = await prisma.cart.create({ data: { token: crypto.randomUUID() } });
  jar.set(CART_COOKIE, created.token, cookieOptions());
  return created;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

async function mergeTokenIntoCart(token: string, cartId: string, userId: string) {
  const guest = await prisma.cart.findUnique({ where: { token }, include: { items: true } });
  if (!guest || guest.id === cartId || guest.userId) return;
  for (const item of guest.items) {
    const match = await prisma.cartItem.findFirst({
      where: { cartId, productId: item.productId, variantId: item.variantId },
    });
    if (match) {
      await prisma.cartItem.update({ where: { id: match.id }, data: { quantity: match.quantity + item.quantity } });
    } else {
      await prisma.cartItem.create({
        data: { cartId, productId: item.productId, variantId: item.variantId, quantity: item.quantity },
      });
    }
  }
  await prisma.cart.delete({ where: { id: guest.id } });
  await prisma.cart.update({ where: { id: cartId }, data: { userId } });
}

export async function cartView() {
  const cart = await readCart();
  const settings = await getSettings();
  if (!cart) return { items: [], count: 0, subtotal: 0, problems: [] as string[] };
  const items = cart.items.map((item) => {
    const base = {
      ...item,
      unitPrice: 0,
      lineTotal: 0,
      available: 0,
      problem: null as string | null,
      onSale: false,
      compareAt: null as number | null,
    };
    if (item.product.status !== "PUBLISHED" || item.product.deletedAt) {
      return { ...base, problem: "This product is no longer available." };
    }
    if (item.product.variants.length && !item.variant) {
      return { ...base, problem: "Choose a variant again." };
    }
    const priced = priceWithSettings(settings, item.product, item.variant);
    const available = item.variant
      ? availableUnits(item.product.trackInventory, item.variant.onHand, item.variant.reserved)
      : availableUnits(item.product.trackInventory, item.product.onHand, item.product.reserved);
    return {
      ...base,
      unitPrice: priced.current,
      lineTotal: priced.current * item.quantity,
      available,
      problem: available < item.quantity ? "Only the available quantity can be purchased." : null,
      onSale: priced.onSale,
      compareAt: priced.compareAt,
    };
  });
  return {
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + (item.problem ? 0 : item.lineTotal), 0),
    problems: items.flatMap((item) => (item.problem ? [item.problem] : [])),
  };
}
