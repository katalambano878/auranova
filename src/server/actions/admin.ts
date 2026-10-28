"use server";

import { revalidatePath } from "next/cache";
import { parseMoney } from "@/lib/money";
import { slugify, uniqueSuffix } from "@/lib/utils";
import { audit } from "../audit";
import { nid, supabaseAdmin, throwIf } from "../db";
import { saveImage } from "../storage";
import { requirePermission } from "../session";
import { isStaffRole } from "../permissions";
import { transitionFulfilment, requestRefund, confirmManualRefund } from "../orders";
import { createStaffUser } from "./auth";
import type { FulfilmentStatus } from "@/lib/order-status";

async function gate(permission: string) {
  const access = await requirePermission(permission);
  if (!access.ok) return access;
  return access;
}

export async function saveProduct(formData: FormData) {
  const access = await gate("catalogue.write");
  if (!access.ok) return access;
  const name = String(formData.get("name") || "").trim();
  const price = parseMoney(String(formData.get("price") || ""));
  const sku = String(formData.get("sku") || "").trim();
  if (!name || price == null || !sku) return { ok: false as const, error: "Name, SKU, and a valid price are required." };
  const saleRaw = String(formData.get("salePrice") || "").trim();
  const salePrice = saleRaw ? parseMoney(saleRaw) : null;
  if (saleRaw && salePrice == null) return { ok: false as const, error: "Sale price must be a valid amount." };
  const id = String(formData.get("id") || "");
  let slug = slugify(String(formData.get("slug") || name));
  const db = supabaseAdmin();
  let slugQuery = db.from("Product").select("id").eq("slug", slug);
  if (id) slugQuery = slugQuery.neq("id", id);
  const { data: existingSlug, error: slugError } = await slugQuery.maybeSingle();
  throwIf(slugError);
  if (existingSlug) slug = `${slug}-${uniqueSuffix()}`;
  const categoryId = String(formData.get("categoryId") || "");
  const brandId = String(formData.get("brandId") || "") || null;
  const data = {
    name,
    slug,
    sku,
    shortDescription: String(formData.get("shortDescription") || ""),
    description: String(formData.get("description") || ""),
    categoryId,
    brandId,
    price,
    salePrice,
    lowStockThreshold: Number(formData.get("lowStockThreshold") || 5),
    status: String(formData.get("status") || "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    featured: formData.get("featured") === "on",
    bestseller: formData.get("bestseller") === "on",
    seoTitle: String(formData.get("seoTitle") || "") || null,
    seoDescription: String(formData.get("seoDescription") || "") || null,
    features: String(formData.get("features") || "").split("\n").map((line) => line.trim()).filter(Boolean),
    searchText: [name, sku, String(formData.get("shortDescription") || "")].join(" "),
  };
  if (!categoryId) return { ok: false as const, error: "Choose a category." };
  try {
    if (id) {
      const { data: previous, error: previousError } = await db.from("Product").select("slug").eq("id", id).maybeSingle();
      throwIf(previousError);
      const updated = await db.from("Product").update(data).eq("id", id).select().single();
      throwIf(updated.error);
      if (previous && previous.slug !== updated.data.slug) {
        await db.from("Redirect").upsert(
          { fromPath: `/products/${previous.slug}`, toPath: `/products/${updated.data.slug}` },
          { onConflict: "fromPath" },
        );
      }
      await audit({ actorId: access.session.user.id, action: "product.update", entity: "product", entityId: id, metadata: { price, salePrice } });
    } else {
      const created = await db
        .from("Product")
        .insert({ id: nid(), ...data, onHand: Math.max(0, Math.floor(Number(formData.get("onHand") || 0))) })
        .select()
        .single();
      throwIf(created.error);
      await audit({ actorId: access.session.user.id, action: "product.create", entity: "product", entityId: created.data.id });
    }
  } catch {
    return { ok: false as const, error: "Could not save the product. The SKU or slug may already exist." };
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { ok: true as const };
}

export async function addVariant(formData: FormData) {
  const access = await gate("catalogue.write");
  if (!access.ok) return access;
  const price = parseMoney(String(formData.get("price") || ""));
  if (price == null) return { ok: false as const, error: "Enter a variant price." };
  const productId = String(formData.get("productId") || "");
  const db = supabaseAdmin();
  await db.from("ProductVariant").insert({
    productId,
    sku: String(formData.get("sku") || ""),
    label: String(formData.get("label") || ""),
    price,
    salePrice: String(formData.get("salePrice") || "") ? parseMoney(String(formData.get("salePrice"))) : null,
    onHand: Number(formData.get("onHand") || 0),
    options: {
      ...(String(formData.get("color") || "") ? { color: String(formData.get("color")) } : {}),
      ...(String(formData.get("size") || "") ? { size: String(formData.get("size")) } : {}),
      ...(String(formData.get("capacity") || "") ? { capacity: String(formData.get("capacity")) } : {}),
    },
  });
  await db.from("Product").update({ onHand: 0 }).eq("id", productId);
  await audit({ actorId: access.session.user.id, action: "variant.create", entity: "product", entityId: productId });
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true as const };
}

export async function adjustStock(formData: FormData) {
  const access = await gate("inventory.write");
  if (!access.ok) return access;
  const delta = Number(formData.get("delta") || 0);
  const productId = String(formData.get("productId") || "");
  const variantId = String(formData.get("variantId") || "") || null;
  if (!Number.isInteger(delta) || delta === 0) return { ok: false as const, error: "Enter a whole-number adjustment." };
  const db = supabaseAdmin();
  if (variantId) {
    const { data: variant, error } = await db.from("ProductVariant").select("onHand").eq("id", variantId).maybeSingle();
    throwIf(error);
    if (!variant) return { ok: false as const, error: "Variant not found." };
    await db.from("ProductVariant").update({ onHand: variant.onHand + delta }).eq("id", variantId);
  } else {
    const { data: product, error } = await db.from("Product").select("onHand").eq("id", productId).maybeSingle();
    throwIf(error);
    if (!product) return { ok: false as const, error: "Product not found." };
    await db.from("Product").update({ onHand: product.onHand + delta }).eq("id", productId);
  }
  await db.from("InventoryMovement").insert({
    productId,
    variantId,
    delta,
    reason: "adjustment",
    note: String(formData.get("note") || ""),
    actorId: access.session.user.id,
  });
  await audit({ actorId: access.session.user.id, action: "inventory.adjust", entity: "product", entityId: productId, metadata: { delta, variantId } });
  revalidatePath("/admin/inventory");
  return { ok: true as const };
}

export async function saveNamed(kind: "category" | "brand", formData: FormData) {
  const access = await gate("catalogue.write");
  if (!access.ok) return access;
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false as const, error: "Name is required." };
  const slug = slugify(String(formData.get("slug") || name));
  const db = supabaseAdmin();
  if (kind === "category") {
    await db.from("Category").upsert(
      { id: nid(), slug, name, description: String(formData.get("description") || "") },
      { onConflict: "slug" },
    );
  } else {
    await db.from("Brand").upsert({ id: nid(), slug, name }, { onConflict: "slug" });
  }
  await audit({ actorId: access.session.user.id, action: `${kind}.save`, entity: kind, metadata: { slug } });
  revalidatePath(`/admin/${kind === "category" ? "categories" : "brands"}`);
  return { ok: true as const };
}

export async function saveCategory(formData: FormData) {
  return saveNamed("category", formData);
}

export async function saveBrand(formData: FormData) {
  return saveNamed("brand", formData);
}

export async function saveCoupon(formData: FormData) {
  const access = await gate("promotions.write");
  if (!access.ok) return access;
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const type = String(formData.get("type") || "PERCENT") as "FIXED" | "PERCENT" | "FREE_SHIPPING";
  const amount = type === "PERCENT" ? Math.round(Number(formData.get("amount") || 0) * 100) : parseMoney(String(formData.get("amount") || "0")) || 0;
  if (!code) return { ok: false as const, error: "A code is required." };
  await supabaseAdmin().from("Coupon").upsert(
    {
      id: nid(),
      code,
      type,
      amount,
      active: formData.get("active") === "on",
      minSubtotal: parseMoney(String(formData.get("minSubtotal") || "")),
      maxDiscount: parseMoney(String(formData.get("maxDiscount") || "")),
    },
    { onConflict: "code" },
  );
  await audit({ actorId: access.session.user.id, action: "coupon.save", entity: "coupon", metadata: { code } });
  revalidatePath("/admin/coupons");
  return { ok: true as const };
}

export async function savePromotion(formData: FormData) {
  const access = await gate("promotions.write");
  if (!access.ok) return access;
  const id = String(formData.get("id") || "");
  const data = {
    title: String(formData.get("title") || ""),
    subtitle: String(formData.get("subtitle") || ""),
    ctaLabel: String(formData.get("ctaLabel") || "") || null,
    ctaHref: String(formData.get("ctaHref") || "") || null,
    active: formData.get("active") === "on",
  };
  if (!data.title) return { ok: false as const, error: "A title is required." };
  const db = supabaseAdmin();
  if (id) await db.from("Promotion").update(data).eq("id", id);
  else await db.from("Promotion").insert({ id: nid(), ...data });
  revalidatePath("/");
  return { ok: true as const };
}

export async function moderateReview(id: string, status: "PUBLISHED" | "REJECTED" | "HIDDEN") {
  const access = await gate("reviews.moderate");
  if (!access.ok) return access;
  await supabaseAdmin().from("Review").update({ status }).eq("id", id);
  await audit({ actorId: access.session.user.id, action: "review.moderate", entity: "review", entityId: id, metadata: { status } });
  return { ok: true as const };
}

export async function updateFulfilment(formData: FormData) {
  const access = await gate("orders.fulfil");
  if (!access.ok) return access;
  return transitionFulfilment({
    actorId: access.session.user.id,
    orderId: String(formData.get("orderId") || ""),
    to: String(formData.get("to") || "") as FulfilmentStatus,
    note: String(formData.get("note") || ""),
    trackingRef: String(formData.get("trackingRef") || ""),
  });
}

export async function addOrderNote(formData: FormData) {
  const access = await gate("orders.note");
  if (!access.ok) return access;
  await supabaseAdmin().from("OrderNote").insert({
    id: nid(),
    orderId: String(formData.get("orderId")),
    authorId: access.session.user.id,
    body: String(formData.get("body") || ""),
  });
  return { ok: true as const };
}

export async function refundAction(formData: FormData) {
  const access = await gate("orders.refund");
  if (!access.ok) return access;
  const amount = parseMoney(String(formData.get("amount") || ""));
  if (amount == null) return { ok: false as const, error: "Enter a refund amount." };
  return requestRefund({
    actorId: access.session.user.id,
    orderId: String(formData.get("orderId") || ""),
    amount,
    reason: String(formData.get("reason") || ""),
    restock: formData.get("restock") === "on",
  });
}

export async function manualRefundAction(formData: FormData) {
  const access = await gate("payments.reconcile");
  if (!access.ok) return access;
  return confirmManualRefund({
    actorId: access.session.user.id,
    refundId: String(formData.get("refundId") || ""),
    reason: String(formData.get("reason") || ""),
  });
}

export async function savePaymentFlags(formData: FormData) {
  const access = await gate("settings.write");
  if (!access.ok) return access;
  await supabaseAdmin()
    .from("StoreSettings")
    .update({
      payOnDeliveryEnabled: formData.get("payOnDeliveryEnabled") === "on",
      moolreEnabled: formData.get("moolreEnabled") === "on",
      flutterwaveEnabled: formData.get("flutterwaveEnabled") === "on",
      paystackEnabled: formData.get("paystackEnabled") === "on",
      hubtelEnabled: formData.get("hubtelEnabled") === "on",
    })
    .eq("id", "default");
  await audit({ actorId: access.session.user.id, action: "payments.update", entity: "settings", entityId: "default" });
  return { ok: true as const };
}

export async function saveSettings(formData: FormData) {
  const access = await gate("settings.write");
  if (!access.ok) return access;
  await supabaseAdmin()
    .from("StoreSettings")
    .update({
      storeName: String(formData.get("storeName") || "AuraNova"),
      tagline: String(formData.get("tagline") || ""),
      supportPhone: String(formData.get("supportPhone") || "") || null,
      supportWhatsapp: String(formData.get("supportWhatsapp") || "") || null,
      supportEmail: String(formData.get("supportEmail") || "") || null,
      addressLine: String(formData.get("addressLine") || "") || null,
      heroTitle: String(formData.get("heroTitle") || ""),
      heroSubtitle: String(formData.get("heroSubtitle") || ""),
      announcement: String(formData.get("announcement") || ""),
      announcementEnabled: formData.get("announcementEnabled") === "on",
      salePricingEnabled: formData.get("salePricingEnabled") === "on",
      maintenanceMode: formData.get("maintenanceMode") === "on",
      demoBanner: formData.get("demoBanner") === "on",
      payOnDeliveryEnabled: formData.get("payOnDeliveryEnabled") === "on",
      moolreEnabled: formData.get("moolreEnabled") === "on",
      flutterwaveEnabled: formData.get("flutterwaveEnabled") === "on",
      paystackEnabled: formData.get("paystackEnabled") === "on",
      hubtelEnabled: formData.get("hubtelEnabled") === "on",
      taxRateBps: Math.round(Number(formData.get("taxPercent") || 0) * 100),
      legalName: String(formData.get("legalName") || "") || null,
      tin: String(formData.get("tin") || "") || null,
      instagramUrl: String(formData.get("instagramUrl") || "") || null,
      facebookUrl: String(formData.get("facebookUrl") || "") || null,
      tiktokUrl: String(formData.get("tiktokUrl") || "") || null,
    })
    .eq("id", "default");
  await audit({ actorId: access.session.user.id, action: "settings.update", entity: "settings", entityId: "default" });
  revalidatePath("/");
  return { ok: true as const };
}

export async function savePage(formData: FormData) {
  const access = await gate("content.write");
  if (!access.ok) return access;
  const slug = String(formData.get("slug") || "");
  const paragraphs = String(formData.get("body") || "")
    .split("\n\n")
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ type: "paragraph" as const, text }));
  await supabaseAdmin().from("ContentPage").upsert(
    { id: nid(), slug, title: String(formData.get("title") || slug), blocks: paragraphs },
    { onConflict: "slug" },
  );
  return { ok: true as const };
}

export async function saveFaq(formData: FormData) {
  const access = await gate("content.write");
  if (!access.ok) return access;
  await supabaseAdmin().from("FaqItem").insert({
    id: nid(),
    question: String(formData.get("question") || ""),
    answer: String(formData.get("answer") || ""),
    published: true,
  });
  return { ok: true as const };
}

export async function saveShipping(formData: FormData) {
  const access = await gate("shipping.write");
  if (!access.ok) return access;
  const fee = parseMoney(String(formData.get("fee") || "0"));
  if (fee == null) return { ok: false as const, error: "Enter a delivery fee." };
  await supabaseAdmin()
    .from("ShippingMethod")
    .update({ name: String(formData.get("name") || ""), fee, active: formData.get("active") === "on" })
    .eq("id", String(formData.get("id") || ""));
  await audit({ actorId: access.session.user.id, action: "shipping.update", entity: "shipping_method", entityId: String(formData.get("id")) });
  return { ok: true as const };
}

export async function uploadMedia(formData: FormData) {
  const access = await gate("media.write");
  if (!access.ok) return access;
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "Choose an image." };
  return saveImage(file, String(formData.get("alt") || ""));
}

export async function createStaff(formData: FormData) {
  const access = await gate("staff.manage");
  if (!access.ok) return access;
  const email = String(formData.get("email") || "").toLowerCase();
  const role = String(formData.get("role") || "");
  const password = String(formData.get("password") || "");
  if (!isStaffRole(role) || role === "super_admin") return { ok: false as const, error: "Choose a staff role below super admin." };
  if (password.length < 8) return { ok: false as const, error: "Use a password of at least 8 characters." };
  const { data: existing, error } = await supabaseAdmin().from("User").select("id").eq("email", email).maybeSingle();
  throwIf(error);
  if (existing) return { ok: false as const, error: "That email already has an account." };
  const created = await createStaffUser({ name: String(formData.get("name") || email), email, password, role });
  if (!created.ok) return { ok: false as const, error: created.error };
  await audit({ actorId: access.session.user.id, action: "staff.create", entity: "user", metadata: { email, role } });
  return { ok: true as const };
}

export async function setCustomerBan(userId: string, banned: boolean) {
  const access = await gate("customers.read");
  if (!access.ok) return access;
  if (access.session.user.role !== "super_admin" && access.session.user.role !== "store_manager") {
    return { ok: false as const, error: "Only a manager can suspend an account." };
  }
  await supabaseAdmin().from("User").update({ banned }).eq("id", userId);
  await audit({ actorId: access.session.user.id, action: banned ? "customer.suspend" : "customer.restore", entity: "user", entityId: userId });
  return { ok: true as const };
}
