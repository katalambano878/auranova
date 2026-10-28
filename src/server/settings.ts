import { supabaseAdmin, throwIf } from "./db";

const fallback = {
  id: "default",
  storeName: "AuraNova",
  tagline: "Considered goods for everyday living.",
  logoUrl: null,
  currency: "GHS",
  locale: "en",
  timezone: "Africa/Accra",
  country: "GH",
  supportPhone: null,
  supportWhatsapp: null,
  supportEmail: null,
  addressLine: null,
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
  salePricingEnabled: true,
  maintenanceMode: false,
  reservationMinutes: 30,
  pricesIncludeTax: true,
  taxRateBps: 0,
  legalName: null,
  tin: null,
  payOnDeliveryEnabled: true,
  moolreEnabled: false,
  flutterwaveEnabled: false,
  paystackEnabled: false,
  hubtelEnabled: false,
  heroTitle: "Goods chosen with care.",
  heroSubtitle: "Home, electronics, beauty, and everyday pieces, delivered across Ghana.",
  heroImageUrl: "/demo/hero.svg",
  heroCtaLabel: "Shop the catalogue",
  heroCtaHref: "/shop",
  heroSecondaryLabel: "New arrivals",
  heroSecondaryHref: "/collections/new-arrivals",
  valueJson: [],
  announcement: "Demonstration catalogue. Sample products, prices, and reviews are not live store claims.",
  announcementEnabled: true,
  metaTitle: "AuraNova",
  metaDescription: "AuraNova sells considered general merchandise for delivery across Ghana.",
  demoBanner: true,
  lowStockDefault: 5,
  updatedAt: new Date(),
};

export async function getSettings() {
  const { data, error } = await supabaseAdmin().from("StoreSettings").select("*").eq("id", "default").maybeSingle();
  throwIf(error);
  return data ?? fallback;
}

export type StoreSettingsRecord = Awaited<ReturnType<typeof getSettings>>;
