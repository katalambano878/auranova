"use server";

import { z } from "zod";
import { prisma } from "../db";
import { getSession } from "../session";
import { rateLimit } from "../rate-limit";
import { normalizeGhanaPhone, isDigitalAddress, GHANA_REGIONS } from "@/lib/ghana";

export async function trackOrder(orderNumber: string, email: string) {
  const limited = await rateLimit(`track:${email.toLowerCase()}`, 8, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false as const, error: "Too many lookups." };
  const order = await prisma.order.findUnique({
    where: { number: orderNumber.trim() },
    include: { items: true, shipment: true },
  });
  if (!order || order.email !== email.trim().toLowerCase()) {
    return { ok: false as const, error: "No order matched that number and email." };
  }
  return {
    ok: true as const,
    order: {
      number: order.number,
      paymentStatus: order.paymentStatus,
      fulfilmentStatus: order.fulfilmentStatus,
      total: order.total,
      currency: order.currency,
      trackingRef: order.shipment?.trackingRef || null,
      items: order.items.map((item) => ({ name: item.name, quantity: item.quantity, variantName: item.variantName })),
    },
  };
}

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(8),
  region: z.string(),
  city: z.string().trim().min(1),
  line1: z.string().trim().min(3),
  landmark: z.string().optional().default(""),
  digitalAddress: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  isDefault: z.boolean().optional(),
});

export async function saveAddress(input: unknown, id?: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Sign in to save an address." };
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the address." };
  if (!GHANA_REGIONS.includes(parsed.data.region as (typeof GHANA_REGIONS)[number])) return { ok: false as const, error: "Choose a Ghana region." };
  const phone = normalizeGhanaPhone(parsed.data.phone);
  if (!phone) return { ok: false as const, error: "Enter a valid Ghana phone number." };
  if (parsed.data.digitalAddress && !isDigitalAddress(parsed.data.digitalAddress)) return { ok: false as const, error: "Check the GhanaPost address." };
  if (parsed.data.isDefault) await prisma.address.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } });
  const data = { ...parsed.data, phone, userId: session.user.id, landmark: parsed.data.landmark || null, digitalAddress: parsed.data.digitalAddress || null, postalCode: parsed.data.postalCode || null };
  if (id) {
    const owned = await prisma.address.findFirst({ where: { id, userId: session.user.id } });
    if (!owned) return { ok: false as const, error: "Address not found." };
    await prisma.address.update({ where: { id }, data });
  } else {
    await prisma.address.create({ data });
  }
  return { ok: true as const };
}

export async function deleteAddress(id: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Sign in required." };
  await prisma.address.deleteMany({ where: { id, userId: session.user.id } });
  return { ok: true as const };
}

export async function requestData(type: "EXPORT" | "DELETION") {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Sign in required." };
  await prisma.dataRequest.create({ data: { userId: session.user.id, type } });
  return { ok: true as const, message: type === "EXPORT" ? "Export requested. Staff will prepare it." : "Deletion requested. Orders stay for accounting; personal fields can be anonymised after review." };
}
