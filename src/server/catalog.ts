import { effectivePrice, type EffectivePrice } from "@/lib/pricing";
import { supabaseAdmin, throwIf } from "./db";
import { getSettings } from "./settings";

export const productEmbed = "*, images:ProductImage(id, url, alt, position, isPrimary), variants:ProductVariant(id, sku, label, options, price, salePrice, onHand, reserved, weightGrams, position), category:Category(id, name, slug, description, imageUrl, position, deletedAt), brand:Brand(id, name, slug, deletedAt)";
export const productInclude = productEmbed;

type Priced = {
  price: number;
  salePrice: number | null;
  saleStartsAt: string | Date | null;
  saleEndsAt: string | Date | null;
};

function when(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export async function priceOf(item: Priced, variant?: { price: number; salePrice: number | null } | null) {
  const settings = await getSettings();
  return effectivePrice({
    price: variant?.price ?? item.price,
    salePrice: variant ? variant.salePrice : item.salePrice,
    saleStartsAt: when(item.saleStartsAt),
    saleEndsAt: when(item.saleEndsAt),
    salePricingEnabled: settings.salePricingEnabled,
  });
}

export function priceWithSettings(
  settings: { salePricingEnabled: boolean },
  item: Priced,
  variant?: { price: number; salePrice: number | null } | null,
): EffectivePrice {
  return effectivePrice({
    price: variant?.price ?? item.price,
    salePrice: variant ? variant.salePrice : item.salePrice,
    saleStartsAt: when(item.saleStartsAt),
    saleEndsAt: when(item.saleEndsAt),
    salePricingEnabled: settings.salePricingEnabled,
  });
}

export function availableUnits(trackInventory: boolean, onHand: number, reserved: number) {
  if (!trackInventory) return Number.POSITIVE_INFINITY;
  return Math.max(onHand - reserved, 0);
}

export type ShopQuery = {
  category?: string;
  brand?: string;
  min?: number;
  max?: number;
  availability?: "in" | "out";
  colour?: string;
  size?: string;
  rating?: number;
  sort?: "featured" | "newest" | "price-asc" | "price-desc" | "popular";
  page?: number;
  q?: string;
};

const pageSize = 12;

export async function searchProductIds(q: string) {
  const { data, error } = await supabaseAdmin().rpc("search_product_ids", { q });
  throwIf(error);
  return ((data || []) as { id: string }[]).map((row) => row.id);
}

type ListedProduct = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  featured: boolean;
  bestseller: boolean;
  unitsSold: number;
  trackInventory: boolean;
  onHand: number;
  reserved: number;
  price: number;
  salePrice: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  images: { url: string; alt: string | null }[];
  variants: { price: number; salePrice: number | null; onHand: number; reserved: number; options: { color?: string; size?: string } }[];
  reviews?: { rating: number }[];
};

export async function listProducts(query: ShopQuery) {
  const settings = await getSettings();
  let request = supabaseAdmin()
    .from("Product")
    .select(`${productEmbed}, reviews:Review(rating)`)
    .eq("status", "PUBLISHED")
    .is("deletedAt", null);
  if (query.category) request = request.eq("category.slug", query.category).is("category.deletedAt", null);
  if (query.brand) request = request.eq("brand.slug", query.brand);
  const { data, error } = await request;
  throwIf(error);
  let products = (data || []) as unknown as ListedProduct[];
  if (query.colour) products = products.filter((product) => product.variants.some((variant) => variant.options?.color === query.colour));
  if (query.size) products = products.filter((product) => product.variants.some((variant) => variant.options?.size === query.size));
  if (query.q) {
    const ids = new Set(await searchProductIds(query.q));
    products = products.filter((product) => ids.has(product.id));
  }
  const decorated = products.map((product) => {
    const prices = product.variants.length
      ? product.variants.map((variant) => priceWithSettings(settings, product, variant))
      : [priceWithSettings(settings, product)];
    const current = Math.min(...prices.map((price) => price.current));
    const units = product.variants.length
      ? product.variants.reduce((sum, variant) => sum + availableUnits(product.trackInventory, variant.onHand, variant.reserved), 0)
      : availableUnits(product.trackInventory, product.onHand, product.reserved);
    const reviews = (product.reviews || []).filter((review) => review.rating != null);
    const ratingCount = reviews.length;
    const ratingAverage = ratingCount ? reviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount : null;
    const cheapest = prices.reduce((best, price) => (price.current < best.current ? price : best));
    return { product, current, units, ratingAverage, ratingCount, onSale: cheapest.onSale, compareAt: cheapest.compareAt };
  });
  const filtered = decorated.filter((item) => {
    if (query.min != null && item.current < query.min) return false;
    if (query.max != null && item.current > query.max) return false;
    if (query.availability === "in" && item.units <= 0) return false;
    if (query.availability === "out" && item.units > 0) return false;
    if (query.rating && (item.ratingAverage == null || item.ratingAverage < query.rating)) return false;
    return true;
  });
  const sort = query.sort ?? "featured";
  filtered.sort((a, b) => {
    if (sort === "newest") return new Date(b.product.createdAt).getTime() - new Date(a.product.createdAt).getTime();
    if (sort === "price-asc") return a.current - b.current;
    if (sort === "price-desc") return b.current - a.current;
    if (sort === "popular") return b.product.unitsSold - a.product.unitsSold;
    if (a.product.featured !== b.product.featured) return a.product.featured ? -1 : 1;
    return new Date(b.product.createdAt).getTime() - new Date(a.product.createdAt).getTime();
  });
  const page = Math.max(query.page ?? 1, 1);
  const start = (page - 1) * pageSize;
  return {
    total: filtered.length,
    page,
    pages: Math.max(Math.ceil(filtered.length / pageSize), 1),
    pageSize,
    items: filtered.slice(start, start + pageSize),
  };
}

export async function getProductBySlug(slug: string) {
  const { data, error } = await supabaseAdmin()
    .from("Product")
    .select(`${productEmbed}, reviews:Review(*)`)
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .is("deletedAt", null)
    .maybeSingle();
  throwIf(error);
  if (data) {
    const relations = await supabaseAdmin()
      .from("ProductRelation")
      .select(`relatedId, related:Product!ProductRelation_relatedId_fkey(${productEmbed})`)
      .eq("productId", data.id);
    throwIf(relations.error);
    return { product: { ...data, relationsFrom: relations.data || [] }, redirectTo: null };
  }
  const redirect = await supabaseAdmin().from("Redirect").select("toPath").eq("fromPath", `/products/${slug}`).maybeSingle();
  throwIf(redirect.error);
  return { product: null, redirectTo: redirect.data?.toPath ?? null };
}

export async function relatedProducts(productId: string, categoryId: string, explicitIds: string[]) {
  const explicit = explicitIds.length
    ? await supabaseAdmin().from("Product").select(productEmbed).in("id", explicitIds).eq("status", "PUBLISHED").is("deletedAt", null)
    : { data: [], error: null };
  throwIf(explicit.error);
  const more = await supabaseAdmin()
    .from("Product")
    .select(productEmbed)
    .eq("categoryId", categoryId)
    .eq("status", "PUBLISHED")
    .is("deletedAt", null)
    .not("id", "in", `(${[productId, ...explicitIds].join(",")})`)
    .order("unitsSold", { ascending: false })
    .limit(Math.max(4 - (explicit.data?.length || 0), 0));
  throwIf(more.error);
  return [...(explicit.data || []), ...(more.data || [])].slice(0, 4);
}

export async function filterOptions() {
  const [categories, brands, variants] = await Promise.all([
    supabaseAdmin().from("Category").select("*").is("deletedAt", null).order("position"),
    supabaseAdmin().from("Brand").select("*").is("deletedAt", null).order("name"),
    supabaseAdmin().from("ProductVariant").select("options, product:Product!inner(status, deletedAt)").eq("product.status", "PUBLISHED").is("product.deletedAt", null),
  ]);
  throwIf(categories.error);
  throwIf(brands.error);
  throwIf(variants.error);
  const colours = new Set<string>();
  const sizes = new Set<string>();
  for (const variant of variants.data || []) {
    const options = variant.options as { color?: string; size?: string };
    if (options?.color) colours.add(options.color);
    if (options?.size) sizes.add(options.size);
  }
  return { categories: categories.data || [], brands: brands.data || [], colours: [...colours], sizes: [...sizes] };
}
