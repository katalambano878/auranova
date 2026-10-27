"use server";

import { parseMoney } from "@/lib/money";
import { slugify, uniqueSuffix } from "@/lib/utils";
import { audit } from "../audit";
import { prisma } from "../db";
import { requirePermission } from "../session";

export async function previewProductCsv(formData: FormData) {
  const access = await requirePermission("catalogue.write");
  if (!access.ok) return access;
  const text = String(formData.get("csv") || "");
  const apply = formData.get("apply") === "yes";
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { ok: false as const, error: "Paste a header row and at least one product." };
  const header = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  const required = ["sku", "name", "price", "category"];
  if (required.some((key) => !header.includes(key))) {
    return { ok: false as const, error: "The header must include sku, name, price, and category." };
  }
  const rows: { sku: string; name: string; action: string; detail: string }[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line);
    const record = Object.fromEntries(header.map((key, index) => [key, cells[index] || ""]));
    const price = parseMoney(record.price || "");
    const category = await prisma.category.findFirst({ where: { slug: slugify(record.category || ""), deletedAt: null } });
    if (!record.sku || !record.name || price == null || !category) {
      rows.push({ sku: record.sku || "—", name: record.name || "—", action: "skip", detail: "Missing SKU, name, price, or a known category slug." });
      continue;
    }
    const existing = await prisma.product.findUnique({ where: { sku: record.sku } });
    rows.push({
      sku: record.sku,
      name: record.name,
      action: existing ? "update" : "create",
      detail: `${category.name} · ${record.price}`,
    });
    if (!apply) continue;
    const salePrice = record.saleprice ? parseMoney(record.saleprice) : null;
    const stock = Number(record.stock || 0);
    const status = record.status === "PUBLISHED" || record.status === "ARCHIVED" ? record.status : "DRAFT";
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { name: record.name, price, salePrice, onHand: Number.isInteger(stock) ? stock : existing.onHand, status, shortDescription: record.shortdescription || existing.shortDescription, categoryId: category.id },
      });
    } else {
      let slug = slugify(record.slug || record.name);
      if (await prisma.product.findUnique({ where: { slug } })) slug = `${slug}-${uniqueSuffix()}`;
      await prisma.product.create({
        data: {
          name: record.name,
          slug,
          sku: record.sku,
          price,
          salePrice,
          onHand: Number.isInteger(stock) ? stock : 0,
          status,
          shortDescription: record.shortdescription || "",
          categoryId: category.id,
          searchText: `${record.name} ${record.sku}`,
        },
      });
    }
  }
  if (apply) await audit({ actorId: access.session.user.id, action: "product.csv", entity: "product", metadata: { rows: rows.length } });
  return { ok: true as const, rows, applied: apply, message: apply ? "Import applied." : "Dry run only. Nothing was written." };
}

export async function attachProductImage(formData: FormData) {
  const access = await requirePermission("media.write");
  if (!access.ok) return access;
  const productId = String(formData.get("productId") || "");
  const mediaId = String(formData.get("mediaId") || "");
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!media) return { ok: false as const, error: "Choose an uploaded image." };
  const count = await prisma.productImage.count({ where: { productId } });
  await prisma.productImage.create({
    data: { productId, url: media.url, alt: media.alt || String(formData.get("alt") || ""), position: count, isPrimary: count === 0 },
  });
  return { ok: true as const };
}

export async function resolveDataRequest(formData: FormData) {
  const access = await requirePermission("customers.read");
  if (!access.ok) return access;
  if (access.session.user.role !== "super_admin" && access.session.user.role !== "store_manager") {
    return { ok: false as const, error: "Only a manager can complete a data request." };
  }
  const request = await prisma.dataRequest.findUnique({ where: { id: String(formData.get("id") || "") }, include: { user: true } });
  if (!request || request.status !== "PENDING") return { ok: false as const, error: "That request is no longer pending." };
  const decision = String(formData.get("decision") || "");
  if (decision === "reject") {
    await prisma.dataRequest.update({ where: { id: request.id }, data: { status: "REJECTED" } });
    await audit({ actorId: access.session.user.id, action: "data.reject", entity: "data_request", entityId: request.id });
    return { ok: true as const, message: "Request rejected." };
  }
  if (request.type === "DELETION") {
    const placeholder = `removed+${request.userId.slice(0, 8)}@invalid.auranova`;
    await prisma.$transaction(async (tx) => {
      await tx.address.deleteMany({ where: { userId: request.userId } });
      await tx.user.update({
        where: { id: request.userId },
        data: { name: "Removed customer", email: placeholder, phone: null, image: null, banned: true },
      });
      const orders = await tx.order.findMany({ where: { userId: request.userId } });
      for (const order of orders) {
        await tx.order.update({
          where: { id: order.id },
          data: { email: placeholder, phone: "", customerName: "Removed customer", shippingAddress: { country: "GH", redacted: true } },
        });
      }
      await tx.dataRequest.update({ where: { id: request.id }, data: { status: "COMPLETED" } });
    });
    await audit({ actorId: access.session.user.id, action: "data.delete", entity: "user", entityId: request.userId, metadata: { manual: false } });
    return { ok: true as const, message: "Personal fields were anonymised. Orders remain for accounting." };
  }
  await prisma.dataRequest.update({ where: { id: request.id }, data: { status: "COMPLETED" } });
  await audit({ actorId: access.session.user.id, action: "data.export", entity: "user", entityId: request.userId });
  return { ok: true as const, message: "Export marked complete. Download it from the customer page." };
}

export async function markNotificationRead(id: string) {
  const access = await requirePermission("orders.read");
  if (!access.ok) return access;
  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  return { ok: true as const };
}

function splitCsv(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}
