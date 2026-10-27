export type ShippingMethodRule = {
  id: string;
  zoneId: string;
  name: string;
  fee: number;
  freeThreshold: number | null;
  minOrder: number | null;
  maxWeightGrams: number | null;
  estimateMinDays: number | null;
  estimateMaxDays: number | null;
  pickup: boolean;
  pickupInstructions: string | null;
  regions: string[];
  cities: string[];
};

export type ShippingQuote = ShippingMethodRule & {
  calculatedFee: number;
  available: boolean;
  reason?: string;
};

export function quoteShipping(
  methods: ShippingMethodRule[],
  input: { region: string; city: string; subtotal: number; weightGrams: number },
): ShippingQuote[] {
  const quotes: ShippingQuote[] = [];
  for (const method of methods) {
    const regionOk = method.regions.length === 0 || method.regions.includes(input.region);
    const cityOk =
      method.cities.length === 0 ||
      method.cities.some((city) => city.toLowerCase() === input.city.trim().toLowerCase());
    if (!regionOk || !cityOk) continue;
    if (method.minOrder != null && input.subtotal < method.minOrder) {
      quotes.push({ ...method, calculatedFee: method.fee, available: false, reason: "Order is below the minimum for this method." });
      continue;
    }
    if (method.maxWeightGrams != null && input.weightGrams > method.maxWeightGrams) {
      quotes.push({ ...method, calculatedFee: method.fee, available: false, reason: "This method cannot carry the weight of the cart." });
      continue;
    }
    const calculatedFee = method.freeThreshold != null && input.subtotal >= method.freeThreshold ? 0 : method.fee;
    quotes.push({ ...method, calculatedFee, available: true });
  }
  return quotes;
}

export function estimateLabel(method: { estimateMinDays: number | null; estimateMaxDays: number | null }) {
  if (method.estimateMinDays == null && method.estimateMaxDays == null) return null;
  if (method.estimateMinDays != null && method.estimateMaxDays != null && method.estimateMinDays !== method.estimateMaxDays) {
    return `Estimated ${method.estimateMinDays}–${method.estimateMaxDays} days`;
  }
  const day = method.estimateMinDays ?? method.estimateMaxDays;
  return `Estimated ${day} day${day === 1 ? "" : "s"}`;
}
