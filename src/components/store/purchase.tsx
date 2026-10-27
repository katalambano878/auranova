"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/store/product-card";
import { addToCart, toggleWishlist } from "@/server/actions/storefront";

type Option = {
  id: string;
  label: string;
  current: number;
  compareAt: number | null;
  available: number;
};

export function ProductPurchase({
  productId,
  currency,
  options,
  simple,
}: {
  productId: string;
  currency: string;
  options: Option[];
  simple: Option | null;
}) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(options[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const selected = useMemo(() => options.find((option) => option.id === variantId) ?? simple, [options, simple, variantId]);
  if (!selected) return null;
  const soldOut = selected.available <= 0;
  return (
    <div className="mt-6 space-y-5">
      <Price currency={currency} current={selected.current} compareAt={selected.compareAt} />
      {options.length ? (
        <fieldset>
          <legend className="mb-2 text-sm text-stone">Options</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === variantId}
                className={`rounded-full border px-3 py-2 text-sm ${option.id === variantId ? "border-forest bg-forest text-white" : "border-line bg-white"}`}
                onClick={() => setVariantId(option.id)}
              >
                {option.label}{option.available <= 0 ? " · Out of stock" : ""}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="flex items-center gap-3">
        <label className="text-sm text-stone" htmlFor="qty">Quantity</label>
        <input id="qty" type="number" min={1} max={Math.max(selected.available, 1)} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="w-20 rounded-full border border-line bg-white px-3 py-2" />
        <p className="text-sm text-stone">{soldOut ? "Out of stock" : selected.available < 6 ? `Only ${selected.available} left` : "In stock"}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={pending || soldOut}
          onClick={async () => {
            setPending(true);
            const result = await addToCart(productId, options.length ? variantId : null, quantity);
            setPending(false);
            if (!result.ok) { toast.error(result.error); return; }
            toast.success("Added to bag");
            router.refresh();
          }}
        >
          {pending ? "Adding…" : "Add to bag"}
        </Button>
        <Button variant="line" onClick={() => router.push("/checkout")}>Checkout</Button>
        <Button
          variant="ghost"
          onClick={async () => {
            const result = await toggleWishlist(productId);
            if (!result.ok) {
              const current = JSON.parse(window.localStorage.getItem("auranova-wishlist") || "[]") as string[];
              const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId];
              window.localStorage.setItem("auranova-wishlist", JSON.stringify(next));
              toast.success("Saved on this device");
              return;
            }
            toast.success(result.saved ? "Saved to your wishlist" : "Removed from wishlist");
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
