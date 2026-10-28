import type { MetadataRoute } from "next";
import { supabaseAdmin, throwIf } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "http://localhost:3000";
  const db = supabaseAdmin();
  const [productsRes, categoriesRes, collectionsRes, pagesRes] = await Promise.all([
    db.from("Product").select("slug, updatedAt").eq("status", "PUBLISHED").is("deletedAt", null),
    db.from("Category").select("slug").is("deletedAt", null),
    db.from("Collection").select("slug").eq("active", true),
    db.from("ContentPage").select("slug, updatedAt"),
  ]);
  throwIf(productsRes.error);
  throwIf(categoriesRes.error);
  throwIf(collectionsRes.error);
  throwIf(pagesRes.error);
  const products = productsRes.data || [];
  const categories = categoriesRes.data || [];
  const collections = collectionsRes.data || [];
  const pages = pagesRes.data || [];
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((category) => ({ url: `${base}/categories/${category.slug}` })),
    ...collections.map((collection) => ({ url: `${base}/collections/${collection.slug}` })),
    ...products.map((product) => ({ url: `${base}/products/${product.slug}`, lastModified: new Date(product.updatedAt) })),
    ...pages.map((page) => ({ url: `${base}/${page.slug}`, lastModified: new Date(page.updatedAt) })),
  ];
}
