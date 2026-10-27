import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { searchProductIds } from "@/server/catalog";
import { prisma } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ products: [] });
  const limited = await rateLimit(`search:${request.headers.get("x-forwarded-for") || "local"}`, 60, 60_000);
  if (!limited.ok) return NextResponse.json({ products: [] }, { status: 429 });
  const ids = await searchProductIds(q);
  const products = await prisma.product.findMany({
    where: { id: { in: ids.slice(0, 6) }, status: "PUBLISHED", deletedAt: null },
    select: { name: true, slug: true },
  });
  return NextResponse.json({ products });
}
