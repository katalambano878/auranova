"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function GuestWishlist() {
  const [products, setProducts] = useState<{ id: string; name: string; slug: string; image?: string }[]>([]);
  useEffect(() => {
    const ids = JSON.parse(window.localStorage.getItem("auranova-wishlist") || "[]") as string[];
    if (!ids.length) return;
    void fetch(`/api/catalogue?ids=${ids.join(",")}`).then((response) => response.json()).then((data) => setProducts(data.products || []));
  }, []);
  if (!products.length) return <p className="mt-4 text-stone">Nothing saved on this device. <Link href="/account/login" className="underline">Sign in</Link> to keep a wishlist.</p>;
  return (
    <ul className="mt-6 space-y-3">
      {products.map((product) => <li key={product.id}><Link href={`/products/${product.slug}`} className="underline">{product.name}</Link></li>)}
    </ul>
  );
}
