import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/session";

export async function GET() {
  const access = await requirePermission("catalogue.read");
  if (!access.ok) return NextResponse.json({ ok: false }, { status: access.status });
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { category: true },
    orderBy: { sku: "asc" },
  });
  const header = "sku,name,slug,price,salePrice,category,stock,status,shortDescription";
  const lines = products.map((product) => [
    product.sku,
    csv(product.name),
    product.slug,
    (product.price / 100).toFixed(2),
    product.salePrice == null ? "" : (product.salePrice / 100).toFixed(2),
    product.category.slug,
    String(product.onHand),
    product.status,
    csv(product.shortDescription),
  ].join(","));
  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=auranova-products.csv",
    },
  });
}

function csv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
