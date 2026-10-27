export type PaymentDecision =
  | "accept"
  | "pending"
  | "fail"
  | "reject_amount"
  | "reject_currency";

export function decidePayment(input: {
  expectedMinor: number;
  expectedCurrency: string;
  reportedMinor?: number | null;
  reportedCurrency?: string | null;
  status: "successful" | "failed" | "pending" | "cancelled" | "expired";
}): PaymentDecision {
  if (input.status === "pending") return "pending";
  if (input.status === "failed" || input.status === "cancelled" || input.status === "expired") return "fail";
  if (input.reportedCurrency && input.reportedCurrency.toUpperCase() !== input.expectedCurrency.toUpperCase()) {
    return "reject_currency";
  }
  if (input.reportedMinor == null || input.reportedMinor !== input.expectedMinor) return "reject_amount";
  return "accept";
}
