import { describe, expect, it } from "vitest";
import { evaluateCoupon } from "./coupons";
import { majorToMinor, parseMoney } from "./money";
import { decidePayment } from "./payments/decision";
import { effectivePrice, taxPortion } from "./pricing";
import { canTransitionFulfilment } from "./order-status";
import { quoteShipping } from "./shipping";
import { startOfDayInTimeZone } from "./time";

const line = { productId: "p1", categoryId: "c1", quantity: 2, unitPrice: 5000 };

describe("money", () => {
  it("parses cedis into pesewas", () => {
    expect(parseMoney("10.50")).toBe(1050);
    expect(parseMoney("10.5")).toBe(1050);
    expect(parseMoney("10.501")).toBeNull();
    expect(majorToMinor("10.50")).toBe(1050);
  });
});

describe("pricing", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  it("ignores a stored sale when the global toggle is off", () => {
    expect(effectivePrice({ price: 1000, salePrice: 800, salePricingEnabled: false, now }).current).toBe(1000);
  });
  it("applies a sale inside its window", () => {
    const price = effectivePrice({
      price: 1000,
      salePrice: 800,
      saleStartsAt: new Date("2026-10-01"),
      saleEndsAt: new Date("2026-10-31"),
      salePricingEnabled: true,
      now,
    });
    expect(price).toEqual({ current: 800, compareAt: 1000, onSale: true });
  });
  it("keeps tax from going negative", () => {
    expect(taxPortion(11500, 1500, true)).toBe(1500);
    expect(taxPortion(10000, 0, true)).toBe(0);
  });
});

describe("coupons", () => {
  const base = {
    type: "PERCENT" as const,
    amount: 1000,
    minSubtotal: null,
    maxDiscount: 1500,
    startsAt: null,
    endsAt: null,
    active: true,
    usageLimit: null,
    usageCount: 0,
    perCustomerLimit: 1,
    customerUses: 0,
    firstOrderOnly: false,
    isFirstOrder: true,
    productIds: [],
    categoryIds: [],
    excludedProductIds: [],
  };
  it("caps a percentage and never discounts more than the eligible subtotal", () => {
    const decision = evaluateCoupon(base, [line]);
    expect(decision.ok && decision.discount).toBe(1000);
  });
  it("rejects an expired coupon", () => {
    const decision = evaluateCoupon({ ...base, endsAt: new Date("2020-01-01") }, [line], new Date("2026-01-01"));
    expect(decision.ok).toBe(false);
  });
});

describe("shipping and orders", () => {
  it("zeroes the fee above the free threshold", () => {
    const [quote] = quoteShipping([
      {
        id: "m",
        zoneId: "z",
        name: "Standard",
        fee: 2500,
        freeThreshold: 50000,
        minOrder: null,
        maxWeightGrams: null,
        estimateMinDays: 1,
        estimateMaxDays: 3,
        pickup: false,
        pickupInstructions: null,
        regions: ["Greater Accra"],
        cities: [],
      },
    ], { region: "Greater Accra", city: "Accra", subtotal: 60000, weightGrams: 100 });
    expect(quote.calculatedFee).toBe(0);
  });
  it("blocks an illegal fulfilment jump", () => {
    expect(canTransitionFulfilment("PENDING", "SHIPPED")).toBe(false);
    expect(canTransitionFulfilment("READY_FOR_DISPATCH", "SHIPPED")).toBe(true);
  });
});

describe("payment decisions", () => {
  it("rejects a mismatched amount or currency", () => {
    expect(decidePayment({ expectedMinor: 1000, expectedCurrency: "GHS", reportedMinor: 900, reportedCurrency: "GHS", status: "successful" })).toBe("reject_amount");
    expect(decidePayment({ expectedMinor: 1000, expectedCurrency: "GHS", reportedMinor: 1000, reportedCurrency: "NGN", status: "successful" })).toBe("reject_currency");
    expect(decidePayment({ expectedMinor: 1000, expectedCurrency: "GHS", reportedMinor: 1000, reportedCurrency: "GHS", status: "successful" })).toBe("accept");
  });
});

describe("Accra days", () => {
  it("starts the Accra day at local midnight", () => {
    const start = startOfDayInTimeZone(new Date("2026-10-26T23:30:00Z"), "Africa/Accra");
    expect(start.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});
