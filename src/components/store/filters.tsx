"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function Filters({
  categories,
  brands,
  colours,
  sizes,
}: {
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
  colours: string[];
  sizes: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/shop?${next.toString()}`);
  }
  return (
    <form className="space-y-4 rounded-[2rem] bg-mist p-6 text-sm">
      <Select label="Category" value={params.get("category") || ""} onChange={(value) => update("category", value)} options={categories.map((item) => ({ value: item.slug, label: item.name }))} />
      <Select label="Brand" value={params.get("brand") || ""} onChange={(value) => update("brand", value)} options={brands.map((item) => ({ value: item.slug, label: item.name }))} />
      {colours.length ? <Select label="Colour" value={params.get("colour") || ""} onChange={(value) => update("colour", value)} options={colours.map((item) => ({ value: item, label: item }))} /> : null}
      {sizes.length ? <Select label="Size" value={params.get("size") || ""} onChange={(value) => update("size", value)} options={sizes.map((item) => ({ value: item, label: item }))} /> : null}
      <label className="block">Minimum price (GHS)<input name="min" defaultValue={params.get("min") || ""} className="mt-1 w-full rounded-full border border-line bg-white px-3 py-2" onBlur={(event) => update("min", event.target.value)} /></label>
      <label className="block">Maximum price (GHS)<input name="max" defaultValue={params.get("max") || ""} className="mt-1 w-full rounded-full border border-line bg-white px-3 py-2" onBlur={(event) => update("max", event.target.value)} /></label>
      <Select label="Availability" value={params.get("availability") || ""} onChange={(value) => update("availability", value)} options={[{ value: "in", label: "In stock" }, { value: "out", label: "Out of stock" }]} />
      <Select label="Sort" value={params.get("sort") || "featured"} onChange={(value) => update("sort", value)} options={[{ value: "featured", label: "Featured" }, { value: "newest", label: "Newest" }, { value: "price-asc", label: "Price: low to high" }, { value: "price-desc", label: "Price: high to low" }, { value: "popular", label: "Popularity" }]} />
    </form>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      {label}
      <select className="mt-1 w-full rounded-full border border-line bg-white px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Any</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
