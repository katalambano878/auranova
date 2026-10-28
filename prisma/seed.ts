import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { nid, supabaseAdmin, throwIf } from "../src/server/db";

const db = supabaseAdmin();

const prisma = {
  category: {
    upsert: async ({ update, create }: { where?: { slug: string }; update?: Record<string, unknown>; create: Record<string, unknown> }) => {
      throwIf((await db.from("Category").upsert({ id: nid(), ...create, ...(update || {}) }, { onConflict: "slug" })).error);
    },
    findMany: async () => {
      const { data, error } = await db.from("Category").select("*");
      throwIf(error);
      return data || [];
    },
  },
  brand: {
    upsert: async ({ update, create }: { where?: { slug: string }; update?: Record<string, unknown>; create: Record<string, unknown> }) => {
      throwIf((await db.from("Brand").upsert({ id: nid(), ...create, ...(update || {}) }, { onConflict: "slug" })).error);
    },
    findMany: async () => {
      const { data, error } = await db.from("Brand").select("*");
      throwIf(error);
      return data || [];
    },
  },
  product: {
    upsert: async ({ where, update, create }: { where: { sku: string }; update: Record<string, unknown>; create: Record<string, unknown> & { images?: { create: Record<string, unknown>[] } } }) => {
      const { data: existing, error: existingError } = await db.from("Product").select("id").eq("sku", where.sku).maybeSingle();
      throwIf(existingError);
      if (existing) {
        throwIf((await db.from("Product").update(update).eq("id", existing.id)).error);
        return { id: existing.id, ...update };
      }
      const productId = nid();
      const { images, ...productRow } = create;
      throwIf((await db.from("Product").insert({ id: productId, ...productRow })).error);
      for (const image of images?.create || []) {
        throwIf((await db.from("ProductImage").insert({ productId, ...image })).error);
      }
      return { id: productId, ...productRow };
    },
    findUnique: async ({ where }: { where: { sku: string } }) => {
      const { data, error } = await db.from("Product").select("*").eq("sku", where.sku).maybeSingle();
      throwIf(error);
      return data;
    },
    findMany: async ({ where }: { where: { isDemo?: boolean } }) => {
      let query = db.from("Product").select("*");
      if (where.isDemo != null) query = query.eq("isDemo", where.isDemo);
      const { data, error } = await query;
      throwIf(error);
      return data || [];
    },
  },
  productVariant: {
    upsert: async ({ where, update, create }: { where: { sku: string }; update: Record<string, unknown>; create: Record<string, unknown> }) => {
      const { data: existing, error } = await db.from("ProductVariant").select("id").eq("sku", where.sku).maybeSingle();
      throwIf(error);
      if (existing) throwIf((await db.from("ProductVariant").update(update).eq("id", existing.id)).error);
      else throwIf((await db.from("ProductVariant").insert(create)).error);
    },
  },
  productRelation: {
    upsert: async ({ create }: { where?: unknown; update?: unknown; create: { productId: string; relatedId: string } }) => {
      throwIf((await db.from("ProductRelation").upsert(create, { onConflict: "productId,relatedId" })).error);
    },
  },
  collection: {
    upsert: async ({ where, create }: { where: { slug: string }; update?: unknown; create: Record<string, unknown> }) => {
      throwIf((await db.from("Collection").upsert({ id: nid(), ...create }, { onConflict: "slug" })).error);
      const { data, error } = await db.from("Collection").select("*").eq("slug", where.slug).single();
      throwIf(error);
      return data;
    },
  },
  collectionProduct: {
    upsert: async ({ update, create }: { where?: unknown; update?: Record<string, unknown>; create: Record<string, unknown> }) => {
      throwIf((await db.from("CollectionProduct").upsert({ ...create, ...(update || {}) }, { onConflict: "collectionId,productId" })).error);
    },
  },
  coupon: {
    upsert: async ({ create }: { where?: unknown; update?: unknown; create: Record<string, unknown> }) => {
      throwIf((await db.from("Coupon").upsert({ id: nid(), ...create }, { onConflict: "code" })).error);
    },
  },
  shippingZone: {
    upsert: async ({ where, create }: { where: { id: string }; update?: unknown; create: Record<string, unknown> }) => {
      throwIf((await db.from("ShippingZone").upsert({ ...create }, { onConflict: "id" })).error);
      const { data, error } = await db.from("ShippingZone").select("*").eq("id", where.id).single();
      throwIf(error);
      return data;
    },
  },
  shippingMethod: {
    upsert: async ({ update, create }: { where?: { id: string }; update?: Record<string, unknown>; create: Record<string, unknown> }) => {
      throwIf((await db.from("ShippingMethod").upsert({ ...create, ...(update || {}) }, { onConflict: "id" })).error);
    },
  },
  promotion: {
    upsert: async ({ create }: { where?: unknown; update?: unknown; create: Record<string, unknown> }) => {
      throwIf((await db.from("Promotion").upsert({ ...create }, { onConflict: "id" })).error);
    },
  },
  review: {
    findFirst: async ({ where }: { where: { productId: string; isSample: boolean } }) => {
      const { data, error } = await db.from("Review").select("id").eq("productId", where.productId).eq("isSample", where.isSample).maybeSingle();
      throwIf(error);
      return data;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      throwIf((await db.from("Review").insert({ id: nid(), ...data })).error);
    },
  },
  contentPage: {
    upsert: async ({ create }: { where?: { slug: string }; update?: unknown; create: Record<string, unknown> }) => {
      throwIf((await db.from("ContentPage").upsert({ id: nid(), ...create }, { onConflict: "slug" })).error);
    },
  },
  faqItem: {
    count: async () => {
      const { count, error } = await db.from("FaqItem").select("id", { count: "exact", head: true });
      throwIf(error);
      return count ?? 0;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      throwIf((await db.from("FaqItem").insert({ id: nid(), ...data })).error);
    },
  },
  order: {
    count: async ({ where }: { where: { isDemo: boolean } }) => {
      const { count, error } = await db.from("Order").select("id", { count: "exact", head: true }).eq("isDemo", where.isDemo);
      throwIf(error);
      return count ?? 0;
    },
    create: async ({ data }: { data: Record<string, unknown> & { items?: { create: Record<string, unknown>[] } } }) => {
      const { items, ...order } = data;
      const orderId = nid();
      throwIf((await db.from("Order").insert({ id: orderId, ...order })).error);
      for (const item of items?.create || []) {
        throwIf((await db.from("OrderItem").insert({ id: nid(), orderId, ...item })).error);
      }
    },
  },
};

function mark(title: string, tone: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
  <rect width="800" height="1000" fill="#F4F7F4"/>
  <rect x="70" y="80" width="660" height="640" fill="${tone}"/>
  <text x="70" y="800" fill="#1A2420" font-family="Georgia, serif" font-size="42">${title}</text>
  <text x="70" y="850" fill="#5C675F" font-family="Georgia, serif" font-size="22">AuraNova catalogue mark</text>
</svg>`;
}

const regionsExceptAccra = [
  "Ashanti", "Western", "Western North", "Central", "Eastern", "Volta", "Oti", "Northern",
  "North East", "Savannah", "Upper East", "Upper West", "Bono", "Bono East", "Ahafo",
];

async function main() {
  await mkdir(path.join(process.cwd(), "public/demo"), { recursive: true });
  await writeFile(path.join(process.cwd(), "public/demo/hero.svg"), mark("Considered goods", "#1B4332"));

  throwIf(
    (
      await db.from("StoreSettings").upsert(
        {
          id: "default",
      storeName: "AuraNova",
      tagline: "Considered goods for everyday living.",
      currency: "GHS",
      supportPhone: "+233200000000",
      supportWhatsapp: "+233200000000",
      supportEmail: "hello@auranova.test",
      addressLine: "14 Independence Avenue, Accra",
      heroTitle: "Goods chosen with care.",
      heroSubtitle: "Home, electronics, beauty, and everyday pieces, packed for delivery across Ghana.",
      heroImageUrl: "/demo/hero.svg",
      heroCtaLabel: "Shop the catalogue",
      heroCtaHref: "/shop",
      heroSecondaryLabel: "New arrivals",
      heroSecondaryHref: "/collections/new-arrivals",
      valueJson: [
        { title: "Secure checkout", body: "Online payments are confirmed with the provider before an order is marked paid." },
        { title: "Delivery you can read", body: "Fees and estimated windows come from the methods configured for your region." },
        { title: "A person answers", body: "Phone, WhatsApp, and email are the contacts saved in store settings." },
        { title: "Clear returns", body: "The returns window is the one published on the returns page." },
      ],
      announcement: "Demonstration catalogue. Sample products, prices, and reviews are not live customer claims.",
      announcementEnabled: true,
      demoBanner: true,
      metaTitle: "AuraNova",
      metaDescription: "AuraNova sells considered general merchandise for delivery across Ghana.",
      payOnDeliveryEnabled: true,
        },
        { onConflict: "id" },
      )
    ).error,
  );

  const categorySeed = [
    ["home", "Home", "Textiles, tableware, and furniture."],
    ["electronics", "Electronics", "Small devices for desks and listening."],
    ["beauty", "Beauty", "Body care in short ingredient lists."],
    ["accessories", "Accessories", "Leather and cloth you carry."],
    ["appliances", "Appliances", "Compact machines for the kitchen."],
  ] as const;
  for (const [index, [slug, name, description]] of categorySeed.entries()) {
    await writeFile(path.join(process.cwd(), `public/demo/category-${slug}.svg`), mark(name, index % 2 ? "#E7F2EA" : "#1B4332"));
    await prisma.category.upsert({
      where: { slug },
      update: { name, description, imageUrl: `/demo/category-${slug}.svg`, position: index },
      create: { slug, name, description, imageUrl: `/demo/category-${slug}.svg`, position: index },
    });
  }
  for (const [slug, name] of [["northline", "Northline"], ["harbour", "Harbour"], ["atelier-forma", "Atelier Forma"]] as const) {
    await prisma.brand.upsert({ where: { slug }, update: { name }, create: { slug, name } });
  }

  const categories = Object.fromEntries((await prisma.category.findMany()).map((category) => [category.slug, category.id]));
  const brands = Object.fromEntries((await prisma.brand.findMany()).map((brand) => [brand.slug, brand.id]));

  const products = [
    { slug: "linen-throw", name: "Linen throw", sku: "AN-HOME-THROW", category: "home", brand: "atelier-forma", price: 28000, salePrice: 24000, featured: true, stock: 18, tone: "#C4B6A6", short: "A washed linen throw for the sofa or the foot of the bed.", features: ["180 × 130 cm", "Machine wash cold"], specs: { Material: "Linen", Origin: "Demonstration" } },
    { slug: "ceramic-pourer", name: "Ceramic pourer", sku: "AN-HOME-POUR", category: "home", brand: "atelier-forma", price: 9500, stock: 24, tone: "#E7E0D6", short: "A small pourer for oil or cream.", features: ["Holds 300 ml"], specs: { Material: "Stoneware" } },
    { slug: "oak-side-table", name: "Oak side table", sku: "AN-HOME-TABLE", category: "home", brand: "northline", price: 145000, stock: 0, tone: "#8C6A4A", short: "A compact side table in two finishes.", features: ["Height 48 cm"], specs: { Width: "40 cm" }, variants: [{ sku: "AN-HOME-TABLE-NAT", label: "Natural", options: { color: "Natural" }, price: 145000, stock: 4 }, { sku: "AN-HOME-TABLE-WAL", label: "Walnut", options: { color: "Walnut" }, price: 152000, stock: 2 }] },
    { slug: "desk-lamp", name: "Desk lamp", sku: "AN-ELEC-LAMP", category: "electronics", brand: "northline", price: 32000, featured: true, stock: 15, tone: "#1A1814", short: "A dimmable lamp with a weighted base.", features: ["LED", "Three brightness steps"], specs: { Power: "8 W" } },
    { slug: "harbour-speaker", name: "Harbour speaker", sku: "AN-ELEC-SPK", category: "electronics", brand: "harbour", price: 45000, salePrice: 39900, bestseller: true, stock: 0, tone: "#57534E", short: "A compact speaker for a room, not a hall.", features: ["Bluetooth", "12 hour battery"], specs: { Weight: "680 g" }, variants: [{ sku: "AN-ELEC-SPK-BLK", label: "Black", options: { color: "Black" }, price: 45000, salePrice: 39900, stock: 8 }, { sku: "AN-ELEC-SPK-SND", label: "Sand", options: { color: "Sand" }, price: 45000, salePrice: 39900, stock: 5 }] },
    { slug: "kitchen-scale", name: "Kitchen scale", sku: "AN-ELEC-SCALE", category: "electronics", brand: "northline", price: 18000, stock: 20, tone: "#D6D3D1", short: "A 5 kg scale with a tare button.", features: ["1 g resolution"], specs: { Capacity: "5 kg" } },
    { slug: "shea-body-oil", name: "Shea body oil", sku: "AN-BEA-OIL", category: "beauty", brand: "atelier-forma", price: 8500, stock: 0, tone: "#C2410C", short: "A light oil for dry skin. Demonstration formula, not a clinical claim.", features: ["Unscented"], specs: { Base: "Shea and sunflower" }, variants: [{ sku: "AN-BEA-OIL-50", label: "50 ml", options: { capacity: "50 ml" }, price: 8500, stock: 30 }, { sku: "AN-BEA-OIL-100", label: "100 ml", options: { capacity: "100 ml" }, price: 14500, stock: 16 }] },
    { slug: "clay-soap-trio", name: "Clay soap trio", sku: "AN-BEA-SOAP", category: "beauty", brand: "atelier-forma", price: 6000, stock: 40, tone: "#A8A29E", short: "Three small bars for the sink.", features: ["3 × 40 g"], specs: { Clay: "Kaolin" } },
    { slug: "leather-card-holder", name: "Leather card holder", sku: "AN-ACC-CARD", category: "accessories", brand: "harbour", price: 15000, stock: 0, tone: "#7C2D12", short: "Four card slots and a note pocket.", features: ["Vegetable-tanned leather"], specs: { Size: "10 × 8 cm" }, variants: [{ sku: "AN-ACC-CARD-COG", label: "Cognac", options: { color: "Cognac" }, price: 15000, stock: 12 }, { sku: "AN-ACC-CARD-BLK", label: "Black", options: { color: "Black" }, price: 15000, stock: 9 }] },
    { slug: "cotton-scarf", name: "Cotton scarf", sku: "AN-ACC-SCARF", category: "accessories", brand: "atelier-forma", price: 12000, stock: 22, tone: "#E7E5E4", short: "A light scarf in undyed cotton.", features: ["70 × 180 cm"], specs: { Material: "Cotton" } },
    { slug: "kettle", name: "1.7 L kettle", sku: "AN-APP-KETTLE", category: "appliances", brand: "northline", price: 26000, stock: 0, tone: "#44403C", short: "A stainless kettle with a concealed element.", features: ["Boil-dry cut-off"], specs: { Capacity: "1.7 L" }, variants: [{ sku: "AN-APP-KETTLE-STL", label: "Steel", options: { color: "Steel" }, price: 26000, stock: 7 }, { sku: "AN-APP-KETTLE-BLK", label: "Black", options: { color: "Black" }, price: 27000, stock: 6 }] },
    { slug: "compact-blender", name: "Compact blender", sku: "AN-APP-BLEND", category: "appliances", brand: "harbour", price: 54000, bestseller: true, featured: true, stock: 11, tone: "#292524", short: "A 600 W blender for small batches.", features: ["Two speeds", "Glass jar"], specs: { Power: "600 W" } },
  ];

  for (const product of products) {
    const image = `/demo/${product.slug}.svg`;
    await writeFile(path.join(process.cwd(), "public/demo", `${product.slug}.svg`), mark(product.name, product.tone));
    const searchText = [product.name, product.sku, product.short, product.category, product.brand].join(" ");
    const saved = await prisma.product.upsert({
      where: { sku: product.sku },
      update: { name: product.name, price: product.price, salePrice: product.salePrice ?? null, onHand: product.variants ? 0 : product.stock, searchText },
      create: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        shortDescription: product.short,
        description: `${product.short}\n\nThis is demonstration catalogue copy for AuraNova. Replace it from the product editor.`,
        categoryId: categories[product.category],
        brandId: brands[product.brand],
        price: product.price,
        salePrice: product.salePrice ?? null,
        onHand: product.variants ? 0 : product.stock,
        lowStockThreshold: 5,
        status: "PUBLISHED",
        featured: Boolean(product.featured),
        bestseller: Boolean(product.bestseller),
        isDemo: true,
        features: product.features,
        specs: product.specs,
        searchText,
        images: { create: [{ url: image, alt: `${product.name} catalogue mark`, isPrimary: true, position: 0 }] },
      },
    });
    if (product.variants) {
      for (const [position, variant] of product.variants.entries()) {
        const sale = "salePrice" in variant && typeof variant.salePrice === "number" ? variant.salePrice : null;
        await prisma.productVariant.upsert({
          where: { sku: variant.sku },
          update: { onHand: variant.stock, price: variant.price, salePrice: sale },
          create: { productId: saved.id, sku: variant.sku, label: variant.label, options: variant.options, price: variant.price, salePrice: sale, onHand: variant.stock, position },
        });
      }
    }
  }

  const speaker = await prisma.product.findUnique({ where: { sku: "AN-ELEC-SPK" } });
  const lamp = await prisma.product.findUnique({ where: { sku: "AN-ELEC-LAMP" } });
  if (speaker && lamp) {
    await prisma.productRelation.upsert({
      where: { productId_relatedId: { productId: speaker.id, relatedId: lamp.id } },
      update: {},
      create: { productId: speaker.id, relatedId: lamp.id },
    });
  }

  const arrivals = await prisma.collection.upsert({
    where: { slug: "new-arrivals" },
    update: {},
    create: { slug: "new-arrivals", name: "New arrivals", description: "Pieces added to the demonstration catalogue.", imageUrl: "/demo/category-home.svg", position: 0 },
  });
  const under = await prisma.collection.upsert({
    where: { slug: "under-200" },
    update: {},
    create: { slug: "under-200", name: "Under GHS 200", description: "Smaller purchases from the demonstration catalogue.", imageUrl: "/demo/category-beauty.svg", position: 1 },
  });
  const all = await prisma.product.findMany({ where: { isDemo: true } });
  for (const [position, product] of all.slice(0, 4).entries()) {
    await prisma.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId: arrivals.id, productId: product.id } },
      update: { position },
      create: { collectionId: arrivals.id, productId: product.id, position },
    });
  }
  for (const [position, product] of all.filter((product) => product.price < 20000).entries()) {
    await prisma.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId: under.id, productId: product.id } },
      update: { position },
      create: { collectionId: under.id, productId: product.id, position },
    });
  }

  await prisma.coupon.upsert({
    where: { code: "DEMO10" },
    update: {},
    create: { code: "DEMO10", type: "PERCENT", amount: 1000, maxDiscount: 5000, minSubtotal: 10000, perCustomerLimit: 3, active: true },
  });
  await prisma.coupon.upsert({
    where: { code: "FREESHIP" },
    update: {},
    create: { code: "FREESHIP", type: "FREE_SHIPPING", minSubtotal: 15000, active: true },
  });

  const accra = await prisma.shippingZone.upsert({
    where: { id: "zone-accra" },
    update: {},
    create: { id: "zone-accra", name: "Greater Accra", regions: ["Greater Accra"], cities: [] },
  });
  const nationwide = await prisma.shippingZone.upsert({
    where: { id: "zone-nationwide" },
    update: {},
    create: { id: "zone-nationwide", name: "Nationwide", regions: regionsExceptAccra, cities: [] },
  });
  const methods = [
    { id: "ship-accra-standard", zoneId: accra.id, name: "Accra standard", fee: 2500, freeThreshold: 50000, estimateMinDays: 1, estimateMaxDays: 3, position: 0 },
    { id: "ship-accra-express", zoneId: accra.id, name: "Accra express", fee: 4500, estimateMinDays: 1, estimateMaxDays: 1, position: 1 },
    { id: "ship-pickup", zoneId: accra.id, name: "Store pickup", fee: 0, pickup: true, pickupInstructions: "Collect from the store address after we confirm the order is ready.", estimateMinDays: 1, estimateMaxDays: 2, position: 2 },
    { id: "ship-nationwide", zoneId: nationwide.id, name: "Nationwide standard", fee: 5500, freeThreshold: 80000, estimateMinDays: 3, estimateMaxDays: 7, position: 0 },
  ];
  for (const method of methods) {
    await prisma.shippingMethod.upsert({ where: { id: method.id }, update: method, create: method });
  }

  await prisma.promotion.upsert({
    where: { id: "promo-demo" },
    update: {},
    create: {
      id: "promo-demo",
      title: "Delivery across Ghana",
      subtitle: "Accra methods and a nationwide rate are configured in shipping settings. Estimates are ranges, not guarantees.",
      ctaLabel: "See delivery",
      ctaHref: "/shipping",
      active: true,
    },
  });

  if (speaker) {
    const existingReview = await prisma.review.findFirst({ where: { productId: speaker.id, isSample: true } });
    if (!existingReview) {
      await prisma.review.create({
        data: {
          productId: speaker.id,
          authorName: "Sample note",
          rating: 4,
          body: "Demonstration review. This is not a verified purchase and should not be read as a customer testimonial.",
          status: "PUBLISHED",
          isSample: true,
          verifiedPurchase: false,
        },
      });
    }
  }

  const pages = [
    ["about", "About AuraNova", [{ type: "paragraph", text: "AuraNova is a demonstration storefront for a single-vendor shop in Ghana. Replace this page with the real story of the business before going live." }, { type: "paragraph", text: "The catalogue, reviews, and sample order are labelled as demonstration data." }]],
    ["contact", "Contact", [{ type: "paragraph", text: "Use the form on this page. Messages are stored for staff. Email is sent only when an email provider is configured." }]],
    ["shipping", "Shipping and delivery", [{ type: "paragraph", text: "Delivery fees, regions, and estimated ranges are the ones configured under Shipping. A missing estimate means one has not been set." }, { type: "paragraph", text: "Postal codes are optional. A GhanaPost digital address can be added when you have one." }]],
    ["returns", "Returns and refunds", [{ type: "paragraph", text: "This starter policy does not promise a return window. Write the window you actually offer before accepting live orders." }, { type: "paragraph", text: "Refunds of online payments follow the provider. Stock is not returned automatically unless a staff member chooses restock." }]],
    ["privacy", "Privacy", [{ type: "paragraph", text: "AuraNova stores account, order, and address details to fulfil purchases. This starter text is not legal advice. Review it against Ghana’s Data Protection Act, 2012 (Act 843) before launch." }, { type: "paragraph", text: "Signed-in customers can request an export or deletion of profile fields. Orders are retained for accounting and personal fields can be anonymised." }]],
    ["terms", "Terms", [{ type: "paragraph", text: "Orders are offers until payment is confirmed or a pay-on-delivery order is accepted. Prices are calculated on the server in Ghana cedis." }, { type: "paragraph", text: "Replace these starter terms with terms your business is prepared to stand behind." }]],
  ] as const;
  for (const [slug, title, blocks] of pages) {
    await prisma.contentPage.upsert({
      where: { slug },
      update: {},
      create: { slug, title, blocks, seoTitle: title, seoDescription: `${title} for AuraNova.` },
    });
  }
  const faqs = [
    ["Where do you deliver?", "To the Ghana regions covered by an active shipping method. If your region has no method, checkout will say so."],
    ["When is a payment successful?", "Only after AuraNova verifies the transaction with the payment provider. Returning from a payment page is not enough."],
    ["Are the reviews real?", "Sample reviews are marked as demonstration notes. A review is labelled a verified purchase only when the account bought that product."],
  ];
  if ((await prisma.faqItem.count()) === 0) {
    for (const [position, [question, answer]] of faqs.entries()) {
      await prisma.faqItem.create({ data: { question, answer, position, published: true } });
    }
  }

  const blender = all.find((product) => product.sku === "AN-APP-BLEND");
  if (blender && (await prisma.order.count({ where: { isDemo: true } })) === 0) {
    await prisma.order.create({
      data: {
        number: "AN-DEMO-0001",
        email: "demo@auranova.test",
        phone: "+233200000000",
        customerName: "Demonstration Customer",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        paymentStatus: "PAID",
        fulfilmentStatus: "CONFIRMED",
        subtotal: blender.price,
        total: blender.price + 2500,
        shippingFee: 2500,
        shippingMethodName: "Accra standard",
        shippingAddress: { firstName: "Demonstration", lastName: "Customer", phone: "+233200000000", country: "GH", region: "Greater Accra", city: "Accra", line1: "14 Independence Avenue" },
        paidAt: new Date(),
        isDemo: true,
        provider: "pay_on_delivery",
        items: { create: [{ productId: blender.id, name: blender.name, sku: blender.sku, unitPrice: blender.price, quantity: 1, lineTotal: blender.price }] },
      },
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
