import { redirect } from "next/navigation";
import { supabaseAdmin, throwIf } from "@/server/db";
import { cartView } from "@/server/cart";
import { enabledPaymentMethods } from "@/server/checkout";
import { getSettings } from "@/server/settings";
import { getSession } from "@/server/session";
import { isStaffRole } from "@/server/permissions";
import { Footer } from "@/components/store/footer";
import { HeaderBar } from "@/components/store/header";
import { WishlistMerge } from "@/components/store/wishlist-merge";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, cart, session, payments, categories] = await Promise.all([
    getSettings(),
    cartView(),
    getSession(),
    enabledPaymentMethods(),
    supabaseAdmin().from("Category").select("*").is("deletedAt", null).order("position").limit(6).then((result) => {
      throwIf(result.error);
      return result.data || [];
    }),
  ]);
  if (settings.maintenanceMode && !isStaffRole(session?.user.role || "")) {
    return (
      <main id="content" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
        <p className="text-xs uppercase tracking-[0.16em] text-copper">{settings.storeName}</p>
        <h1 className="mt-3 font-serif text-5xl">The shop is paused.</h1>
        <p className="mt-4 text-stone">Orders are not being taken while maintenance mode is on. The store team can still sign in.</p>
      </main>
    );
  }
  const socials = [
    settings.instagramUrl ? { href: settings.instagramUrl, label: "Instagram" } : null,
    settings.facebookUrl ? { href: settings.facebookUrl, label: "Facebook" } : null,
    settings.tiktokUrl ? { href: settings.tiktokUrl, label: "TikTok" } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));
  return (
    <>
      <HeaderBar
        storeName={settings.storeName}
        phone={settings.supportPhone}
        announcement={settings.announcementEnabled ? settings.announcement : null}
        links={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
          ...categories
            .filter((category) => !["home", "shop", "about"].includes(category.name.toLowerCase()))
            .slice(0, 3)
            .map((category) => ({ href: `/categories/${category.slug}`, label: category.name })),
          { href: "/about", label: "About" },
        ]}
        categories={categories.map((category) => ({ href: `/categories/${category.slug}`, label: category.name }))}
        cartCount={cart.count}
        signedIn={Boolean(session)}
      />
      <WishlistMerge signedIn={Boolean(session)} />
      <div id="content">{children}</div>
      <Footer
        storeName={settings.storeName}
        tagline={settings.tagline}
        phone={settings.supportPhone}
        email={settings.supportEmail}
        address={settings.addressLine}
        whatsapp={settings.supportWhatsapp}
        socials={socials}
        year={new Date().getFullYear()}
        payments={payments.map((method) => method.label)}
      />
    </>
  );
}

export function staffRedirect(role: string | undefined) {
  if (role && isStaffRole(role)) redirect("/admin");
}
