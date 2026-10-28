import { cookies } from "next/headers";
import { nid, supabaseAdmin, throwIf } from "./db";
import { getSession } from "./session";
import { availableUnits, priceWithSettings, productEmbed } from "./catalog";
import { getSettings } from "./settings";

const CART_COOKIE = "auranova_cart";
const cartSelect = `*, items:CartItem(*, product:Product(${productEmbed}), variant:ProductVariant(*))`;

export async function readCart() {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  const session = await getSession();
  const db = supabaseAdmin();
  if (session) {
    const { data, error } = await db.from("Cart").select(cartSelect).eq("userId", session.user.id).maybeSingle();
    throwIf(error);
    if (data) return data;
  }
  if (!token) return null;
  const { data, error } = await db.from("Cart").select(cartSelect).eq("token", token).maybeSingle();
  throwIf(error);
  return data;
}

export async function ensureCart() {
  const session = await getSession();
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  const db = supabaseAdmin();
  if (session) {
    const { data: existing, error: existingError } = await db.from("Cart").select("*").eq("userId", session.user.id).maybeSingle();
    throwIf(existingError);
    if (existing) {
      if (token) await mergeTokenIntoCart(token, existing.id, session.user.id);
      return existing;
    }
    if (token) {
      const { data: guest, error: guestError } = await db.from("Cart").select("*").eq("token", token).maybeSingle();
      throwIf(guestError);
      if (guest && !guest.userId) {
        const updated = await db.from("Cart").update({ userId: session.user.id }).eq("id", guest.id).select().single();
        throwIf(updated.error);
        return updated.data;
      }
    }
    const created = await db.from("Cart").insert({ id: nid(), userId: session.user.id, token: crypto.randomUUID() }).select().single();
    throwIf(created.error);
    jar.set(CART_COOKIE, created.data.token, cookieOptions());
    return created.data;
  }
  if (token) {
    const { data: guest, error: guestError } = await db.from("Cart").select("*").eq("token", token).maybeSingle();
    throwIf(guestError);
    if (guest) return guest;
  }
  const created = await db.from("Cart").insert({ id: nid(), token: crypto.randomUUID() }).select().single();
  throwIf(created.error);
  jar.set(CART_COOKIE, created.data.token, cookieOptions());
  return created.data;
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
  const db = supabaseAdmin();
  const { data: guest, error: guestError } = await db.from("Cart").select("*, items:CartItem(*)").eq("token", token).maybeSingle();
  throwIf(guestError);
  if (!guest || guest.id === cartId || guest.userId) return;
  for (const item of guest.items || []) {
    let matchQuery = db.from("CartItem").select("id, quantity").eq("cartId", cartId).eq("productId", item.productId);
    matchQuery = item.variantId ? matchQuery.eq("variantId", item.variantId) : matchQuery.is("variantId", null);
    const { data: match, error: matchError } = await matchQuery.maybeSingle();
    throwIf(matchError);
    if (match) {
      const updated = await db.from("CartItem").update({ quantity: match.quantity + item.quantity }).eq("id", match.id);
      throwIf(updated.error);
    } else {
      const inserted = await db.from("CartItem").insert({
        id: nid(),
        cartId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      });
      throwIf(inserted.error);
    }
  }
  const deleted = await db.from("Cart").delete().eq("id", guest.id);
  throwIf(deleted.error);
  const linked = await db.from("Cart").update({ userId }).eq("id", cartId);
  throwIf(linked.error);
}

export async function cartView() {
  const cart = await readCart();
  const settings = await getSettings();
  if (!cart || !cart.items?.length) return { items: [], count: 0, subtotal: 0, problems: [] as string[] };
  const items = cart.items.map((item: (typeof cart.items)[number]) => {
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
    if (item.product.variants?.length && !item.variant) {
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
    count: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
    subtotal: items.reduce((sum: number, item: any) => sum + (item.problem ? 0 : item.lineTotal), 0),
    problems: items.flatMap((item: any) => (item.problem ? [item.problem] : [])),
  };
}
