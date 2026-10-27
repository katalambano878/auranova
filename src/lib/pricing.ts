export type PriceInput = {
  price: number;
  salePrice: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
  salePricingEnabled: boolean;
  now?: Date;
};

export type EffectivePrice = {
  current: number;
  compareAt: number | null;
  onSale: boolean;
};

export function effectivePrice(input: PriceInput): EffectivePrice {
  const now = input.now ?? new Date();
  const sale = input.salePrice;
  const windowOpen =
    (!input.saleStartsAt || input.saleStartsAt <= now) &&
    (!input.saleEndsAt || input.saleEndsAt >= now);
  const saleIsLower = sale != null && sale >= 0 && sale < input.price;
  if (input.salePricingEnabled && saleIsLower && windowOpen) {
    return { current: sale, compareAt: input.price, onSale: true };
  }
  return { current: input.price, compareAt: null, onSale: false };
}

export function taxPortion(amount: number, rateBps: number, inclusive: boolean) {
  if (rateBps <= 0 || amount <= 0) return 0;
  if (inclusive) return Math.round((amount * rateBps) / (10000 + rateBps));
  return Math.round((amount * rateBps) / 10000);
}
