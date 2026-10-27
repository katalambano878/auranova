const matrix: Record<string, string[]> = {
  super_admin: ["*"],
  store_manager: [
    "catalogue.read",
    "catalogue.write",
    "inventory.write",
    "orders.read",
    "orders.fulfil",
    "orders.refund",
    "orders.note",
    "customers.read",
    "promotions.write",
    "reviews.moderate",
    "content.write",
    "shipping.write",
    "reports.read",
    "settings.write",
    "media.write",
  ],
  product_manager: ["catalogue.read", "catalogue.write", "inventory.write", "media.write", "reviews.moderate"],
  order_manager: ["orders.read", "orders.fulfil", "orders.refund", "orders.note", "customers.read", "shipping.read"],
  customer_support: ["orders.read", "orders.note", "customers.read"],
  analyst: ["reports.read", "orders.read", "catalogue.read", "customers.read"],
  customer: [],
};

export function can(role: string, permission: string) {
  const granted = matrix[role] ?? [];
  return granted.includes("*") || granted.includes(permission);
}

export const staffRoles = [
  "super_admin",
  "store_manager",
  "product_manager",
  "order_manager",
  "customer_support",
  "analyst",
] as const;

export type StaffRole = (typeof staffRoles)[number];

export function isStaffRole(role: string): role is StaffRole {
  return staffRoles.includes(role as StaffRole);
}
