export const fulfilmentStatuses = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_DISPATCH",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type FulfilmentStatus = (typeof fulfilmentStatuses)[number];

const transitions: Record<FulfilmentStatus, FulfilmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransitionFulfilment(from: FulfilmentStatus, to: FulfilmentStatus) {
  return transitions[from].includes(to);
}

export function fulfilmentLabel(status: FulfilmentStatus) {
  return status.toLowerCase().replaceAll("_", " ");
}
