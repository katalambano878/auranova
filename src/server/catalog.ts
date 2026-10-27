import { effectivePrice, type EffectivePrice } from "@/lib/pricing";
import { prisma } from "./db";
import { getSettings } from "./settings";

export const productInclude = {
  images: { orderBy: { position: "asc" as const } },
  variants: { orderBy: { position: "asc" as const } },
  category: true,
  brand: true,
} as const;

type Priced = {
  price: number;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
};

export async function priceOf(item: Priced, variant?: { price: number; salePrice: number | null } | null) {
  const settings = await getSettings();
  return effectivePrice({
    price: variant?.price ?? item.price,
    salePrice: variant ? variant.salePrice : item.salePrice,
    saleStartsAt: item.saleStartsAt,
    saleEndsAt: item.saleEndsAt,
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
    saleStartsAt: item.saleStartsAt,
    saleEndsAt: item.saleEndsAt,
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
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL
      AND to_tsvector('english', "searchText") @@ plainto_tsquery('english', ${q})
  `;
  return rows.map((row) => row.id);
}

export async function listProducts(query: ShopQuery) {
  const settings = await getSettings();
  const where = {
    status: "PUBLISHED" as const,
    deletedAt: null,
    ...(query.category ? { category: { slug: query.category, deletedAt: null } } : {}),
    ...(query.brand ? { brand: { slug: query.brand, deletedAt: null } } : {}),
    ...(query.colour ? { variants: { some: { options: { path: ["color"], equals: query.colour } } } } : {}),
    ...(query.size ? { variants: { some: { options: { path: ["size"], equals: query.size } } } } : {}),
  };
  let products = await prisma.product.findMany({
    where,
    include: {
      ...productInclude,
      reviews: { where: { status: "PUBLISHED", isSample: false }, select: { rating: true } },
    },
  });
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
    const ratingCount = product.reviews.length;
    const ratingAverage = ratingCount
      ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount
      : null;
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
    if (sort === "newest") return b.product.createdAt.getTime() - a.product.createdAt.getTime();
    if (sort === "price-asc") return a.current - b.current;
    if (sort === "price-desc") return b.current - a.current;
    if (sort === "popular") return b.product.unitsSold - a.product.unitsSold;
    if (a.product.featured !== b.product.featured) return a.product.featured ? -1 : 1;
    return b.product.createdAt.getTime() - a.product.createdAt.getTime();
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
  const product = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: {
      ...productInclude,
      reviews: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" } },
      relationsFrom: { include: { related: { include: productInclude } } },
    },
  });
  if (product) return { product, redirectTo: null };
  const redirect = await prisma.redirect.findUnique({ where: { fromPath: `/products/${slug}` } });
  return { product: null, redirectTo: redirect?.toPath ?? null };
}

export async function relatedProducts(productId: string, categoryId: string, explicitIds: string[]) {
  const explicit = explicitIds.length
    ? await prisma.product.findMany({
        where: { id: { in: explicitIds }, status: "PUBLISHED", deletedAt: null },
        include: productInclude,
      })
    : [];
  const more = await prisma.product.findMany({
    where: { categoryId, status: "PUBLISHED", deletedAt: null, id: { notIn: [productId, ...explicit.map((item) => item.id)] } },
    include: productInclude,
    orderBy: { unitsSold: "desc" },
    take: Math.max(4 - explicit.length, 0),
  });
  return [...explicit, ...more].slice(0, 4);
}

export async function filterOptions() {
  const [categories, brands, variants] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { position: "asc" } }),
    prisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({
      where: { product: { status: "PUBLISHED", deletedAt: null } },
      select: { options: true },
    }),
  ]);
  const colours = new Set<string>();
  const sizes = new Set<string>();
  for (const variant of variants) {
    const options = variant.options as { color?: string; size?: string };
    if (options.color) colours.add(options.color);
    if (options.size) sizes.add(options.size);
  }
  return { categories, brands, colours: [...colours], sizes: [...sizes] };
}
