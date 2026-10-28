import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { supabaseAdmin, throwIf } from "@/server/db";
import { requirePermission } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requirePermission("catalogue.read");
  if (!access.ok) return NextResponse.json({ ok: false }, { status: access.status });
  const { data: products, error } = await supabaseAdmin()
    .from("Product")
    .select("*, category:Category(slug)")
    .is("deletedAt", null)
    .order("sku");
  throwIf(error);
  const header = "sku,name,slug,price,salePrice,category,stock,status,shortDescription";
  const lines = (products || []).map((product) => [
    product.sku,
    product.name,
    product.slug,
    (product.price / 100).toFixed(2),
    product.salePrice == null ? "" : (product.salePrice / 100).toFixed(2),
    product.category?.slug,
    String(product.onHand),
    product.status,
    product.shortDescription,
  ].map(csvCell).join(","));
  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=auranova-products.csv",
    },
  });
}
