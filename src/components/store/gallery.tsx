"use client";

import { useState } from "react";

export function Gallery({ images }: { images: { url: string; alt: string }[] }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const image = images[active] || images[0];
  if (!image) return null;
  return (
    <div>
      <button type="button" className="block w-full overflow-hidden rounded-[1.75rem] bg-mist" onClick={() => setOpen(true)} aria-label="Enlarge image">
        <img src={image.url} alt={image.alt} className={image.url.startsWith("/demo/") ? "aspect-[4/5] w-full scale-[2.2] object-cover object-[center_40%]" : "aspect-[4/5] w-full object-cover"} />
      </button>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-2">
          {images.map((item, index) => (
            <button key={item.url} type="button" className={`h-16 w-14 overflow-hidden rounded-xl border ${index === active ? "border-forest" : "border-transparent"}`} onClick={() => setActive(index)}>
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6" role="dialog" aria-modal="true" aria-label="Enlarged product image">
          <button type="button" className="absolute right-4 top-4 text-paper" onClick={() => setOpen(false)}>Close</button>
          <img src={image.url} alt={image.alt} className="max-h-[85vh] max-w-full object-contain" />
        </div>
      ) : null}
    </div>
  );
}
