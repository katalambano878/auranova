import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { can, isStaffRole } from "@/server/permissions";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

const links = [
  { href: "/admin", label: "Overview", permission: "orders.read" },
  { href: "/admin/products", label: "Products", permission: "catalogue.read" },
  { href: "/admin/categories", label: "Categories", permission: "catalogue.read" },
  { href: "/admin/brands", label: "Brands", permission: "catalogue.read" },
  { href: "/admin/inventory", label: "Inventory", permission: "inventory.write" },
  { href: "/admin/orders", label: "Orders", permission: "orders.read" },
  { href: "/admin/customers", label: "Customers", permission: "customers.read" },
  { href: "/admin/coupons", label: "Coupons", permission: "promotions.write" },
  { href: "/admin/promotions", label: "Promotions", permission: "promotions.write" },
  { href: "/admin/reviews", label: "Reviews", permission: "reviews.moderate" },
  { href: "/admin/pages", label: "Pages", permission: "content.write" },
  { href: "/admin/media", label: "Media", permission: "media.write" },
  { href: "/admin/shipping", label: "Shipping", permission: "shipping.write" },
  { href: "/admin/payments", label: "Payments", permission: "settings.write" },
  { href: "/admin/reports", label: "Reports", permission: "reports.read" },
  { href: "/admin/notifications", label: "Notifications", permission: "orders.read" },
  { href: "/admin/sms", label: "SMS", permission: "settings.write" },
  { href: "/admin/staff", label: "Staff", permission: "staff.manage" },
  { href: "/admin/settings", label: "Settings", permission: "settings.write" },
  { href: "/admin/audit-log", label: "Audit log", permission: "staff.manage" },
];

const rules: [string, string][] = [
  ["/admin/products", "catalogue.read"],
  ["/admin/categories", "catalogue.read"],
  ["/admin/brands", "catalogue.read"],
  ["/admin/inventory", "inventory.write"],
  ["/admin/orders", "orders.read"],
  ["/admin/customers", "customers.read"],
  ["/admin/coupons", "promotions.write"],
  ["/admin/promotions", "promotions.write"],
  ["/admin/reviews", "reviews.moderate"],
  ["/admin/pages", "content.write"],
  ["/admin/media", "media.write"],
  ["/admin/shipping", "shipping.write"],
  ["/admin/payments", "settings.write"],
  ["/admin/reports", "reports.read"],
  ["/admin/notifications", "orders.read"],
  ["/admin/sms", "settings.write"],
  ["/admin/staff", "staff.manage"],
  ["/admin/settings", "settings.write"],
  ["/admin/audit-log", "settings.write"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !isStaffRole(session.user.role)) redirect("/account/login?next=/admin");
  if (process.env.ADMIN_2FA_REQUIRED === "true" && !session.user.twoFactorEnabled) {
    redirect("/account/security");
  }
  const path = (await headers()).get("x-auranova-path") || "";
  const rule = rules.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  const denied = !path.startsWith("/admin") || (rule ? !can(session.user.role, rule[1]) : false);
  const visible = links.filter((link) => link.href === "/admin" || can(session.user.role, link.permission) || (link.href === "/admin/audit-log" && can(session.user.role, "settings.write")));
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="bg-forest text-white md:min-h-screen">
        <div className="px-4 py-5">
          <Link href="/admin" className="font-serif text-2xl">AuraNova</Link>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/70">{session.user.role.replaceAll("_", " ")}</p>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:px-3 md:pb-8">
          {visible.map((link) => (
            <Link key={link.href} href={link.href} className="block whitespace-nowrap rounded-full px-3 py-2 text-sm hover:bg-white/10">
              {link.label}
            </Link>
          ))}
          <Link href="/" className="block whitespace-nowrap rounded-full px-3 py-2 text-sm text-white/70">View shop</Link>
        </nav>
      </aside>
      <div id="content" className="bg-mist px-4 py-8 md:px-8">
        {denied ? <main><h1 className="font-serif text-4xl">Not allowed</h1><p className="mt-3 text-stone">Your role does not include this part of the shop.</p></main> : children}
      </div>
    </div>
  );
}
