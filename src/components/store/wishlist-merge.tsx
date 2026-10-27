"use client";

import { useEffect } from "react";
import { mergeWishlist } from "@/server/actions/storefront";

export function WishlistMerge({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (!signedIn) return;
    const raw = window.localStorage.getItem("auranova-wishlist");
    if (!raw) return;
    const ids = JSON.parse(raw) as string[];
    if (!Array.isArray(ids) || !ids.length) return;
    void mergeWishlist(ids).then((result) => {
      if (result.ok) window.localStorage.removeItem("auranova-wishlist");
    });
  }, [signedIn]);
  return null;
}
