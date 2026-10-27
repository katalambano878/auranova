import type { MetadataRoute } from "next";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "http://localhost:3000";
  const [products, categories, collections, pages] = await Promise.all([
    prisma.product.findMany({ where: { status: "PUBLISHED", deletedAt: null }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { deletedAt: null }, select: { slug: true } }),
    prisma.collection.findMany({ where: { active: true }, select: { slug: true } }),
    prisma.contentPage.findMany({ select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((category) => ({ url: `${base}/categories/${category.slug}` })),
    ...collections.map((collection) => ({ url: `${base}/collections/${collection.slug}` })),
    ...products.map((product) => ({ url: `${base}/products/${product.slug}`, lastModified: product.updatedAt })),
    ...pages.map((page) => ({ url: `${base}/${page.slug}`, lastModified: page.updatedAt })),
  ];
}
