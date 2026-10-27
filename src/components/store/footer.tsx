import Link from "next/link";

export function Footer({
  storeName,
  tagline,
  phone,
  email,
  address,
  whatsapp,
  socials,
  year,
  payments,
}: {
  storeName: string;
  tagline: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  whatsapp?: string | null;
  socials: { href: string; label: string }[];
  year: number;
  payments: string[];
}) {
  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : null;
  return (
    <footer className="bg-forest text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-28 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="flex items-center gap-2 font-serif text-2xl">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm text-forest">A</span>
            {storeName}
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/75">{tagline}</p>
          {socials.length ? (
            <div className="mt-4 flex gap-2">
              {socials.map((social) => (
                <a key={social.href} href={social.href} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs" aria-label={social.label}>
                  {social.label.slice(0, 1)}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <FooterColumn title="Quick links" links={[
          ["/", "Home"],
          ["/shop", "Shop"],
          ["/about", "About"],
          ["/faq", "FAQ"],
          ["/contact", "Contact"],
        ]} />
        <FooterColumn title="Customer service" links={[
          ["/shipping", "Shipping"],
          ["/returns", "Returns"],
          ["/track-order", "Track an order"],
          ["/privacy", "Privacy"],
          ["/terms", "Terms"],
        ]} />
        <FooterColumn title="My account" links={[
          ["/account", "Account"],
          ["/account/orders", "Orders"],
          ["/account/addresses", "Addresses"],
          ["/wishlist", "Saved"],
          ["/cart", "Bag"],
        ]} />
        <div className="text-sm">
          <p className="mb-3 font-medium">Contact us</p>
          <div className="space-y-2 text-white/80">
            {address ? <p>{address}</p> : null}
            {phone ? <p><a href={`tel:${phone}`}>{phone}</a></p> : null}
            {email ? <p><a href={`mailto:${email}`}>{email}</a></p> : null}
            {whatsappHref ? <p><a href={whatsappHref}>WhatsApp</a></p> : null}
          </div>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-white/70">
          <p>© {year} {storeName}</p>
          <p>{payments.length ? payments.join(" · ") : "Payment methods appear when they are enabled."}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="text-sm">
      <p className="mb-3 font-medium">{title}</p>
      <div className="flex flex-col gap-2 text-white/80">
        {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </div>
    </div>
  );
}
