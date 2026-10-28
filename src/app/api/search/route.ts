import { NextResponse } from "next/server";
import { searchProductIds } from "@/server/catalog";
import { supabaseAdmin, throwIf } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ products: [] });
  const limited = await rateLimit(`search:${request.headers.get("x-forwarded-for") || "local"}`, 60, 60_000);
  if (!limited.ok) return NextResponse.json({ products: [] }, { status: 429 });
  const ids = await searchProductIds(q);
  const { data: products, error } = await supabaseAdmin()
    .from("Product")
    .select("name, slug")
    .in("id", ids.slice(0, 6))
    .eq("status", "PUBLISHED")
    .is("deletedAt", null);
  throwIf(error);
  return NextResponse.json({ products: products || [] });
}
