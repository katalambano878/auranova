import { NextResponse } from "next/server";
import { supabaseAdmin, throwIf } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 40);
  if (!ids.length) return NextResponse.json({ products: [] });
  const { data: products, error } = await supabaseAdmin()
    .from("Product")
    .select("id, name, slug, images:ProductImage(url)")
    .in("id", ids)
    .eq("status", "PUBLISHED")
    .is("deletedAt", null);
  throwIf(error);
  return NextResponse.json({
    products: (products || []).map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      image: product.images?.[0]?.url,
    })),
  });
}
