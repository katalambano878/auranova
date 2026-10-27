"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";

type LinkItem = { href: string; label: string };

export function HeaderBar({
  storeName,
  phone,
  announcement,
  links,
  categories,
  cartCount,
  signedIn,
}: {
  storeName: string;
  phone?: string | null;
  announcement?: string | null;
  links: LinkItem[];
  categories: LinkItem[];
  cartCount: number;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40">
      <div className="overflow-hidden bg-forest text-xs text-white">
        <div className="marquee-track flex w-max">
          {[0, 1].map((copy) => (
            <p key={copy} className="flex shrink-0 items-center py-2" aria-hidden={copy === 1}>
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} className="flex items-center gap-8 px-4">
                  <span>{phone ? <a href={`tel:${phone}`}>Call us · {phone}</a> : storeName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{announcement || "Delivery across Ghana"}</span>
                  <span aria-hidden="true">·</span>
                  <Link href={signedIn ? "/account" : "/account/login"}>{signedIn ? "Account" : "Sign in / Register"}</Link>
                  <span aria-hidden="true">·</span>
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>
      <div className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 md:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-full p-2 md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-2 font-serif text-2xl text-forest" aria-label={storeName}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm text-white">A</span>
            </Link>
          </div>
          <nav className="hidden items-center justify-center gap-6 text-sm md:flex">
            {links.map((link) => <Link key={link.href} href={link.href} className="hover:text-leaf">{link.label}</Link>)}
          </nav>
          <div className="flex items-center justify-end gap-1">
            <button type="button" className="rounded-full p-2" aria-label="Search" onClick={() => setSearchOpen((value) => !value)}>
              <Search className="h-5 w-5" />
            </button>
            <Link href={signedIn ? "/account" : "/account/login"} className="rounded-full p-2" aria-label="Account"><UserRound className="h-5 w-5" /></Link>
            <Link href="/wishlist" className="hidden rounded-full p-2 sm:inline" aria-label="Saved"><Heart className="h-5 w-5" /></Link>
            <Link href="/cart" aria-label={`Bag, ${cartCount} items`} className="relative rounded-full p-2">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-forest px-1 text-[10px] text-white">{cartCount}</span>
            </Link>
          </div>
        </div>
        {searchOpen ? (
          <form action="/search" className="mx-auto flex max-w-7xl gap-2 px-4 pb-3">
            <label className="sr-only" htmlFor="header-search">Search products</label>
            <input id="header-search" name="q" placeholder="Search products" className="w-full rounded-full border border-line px-4 py-2 text-sm" />
            <button className="rounded-full bg-forest px-4 text-sm text-white">Search</button>
          </form>
        ) : null}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 bg-forest/40 md:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-[min(100%,20rem)] bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Close menu" className="mb-6 p-2" onClick={() => setOpen(false)}><X /></button>
            <nav className="flex flex-col gap-4 font-serif text-2xl">
              {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
              {categories.map((link) => <Link key={link.href} href={link.href} className="text-lg" onClick={() => setOpen(false)}>{link.label}</Link>)}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
