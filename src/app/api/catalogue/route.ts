import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 40);
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, status: "PUBLISHED", deletedAt: null },
    select: { id: true, name: true, slug: true, images: { take: 1, select: { url: true } } },
  });
  return NextResponse.json({
    products: products.map((product) => ({ id: product.id, name: product.name, slug: product.slug, image: product.images[0]?.url })),
  });
}
