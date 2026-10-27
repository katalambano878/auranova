"use client";

import { useEffect, useState } from "react";

const HOLD_MS = 5000;
const MOVE_MS = 700;

export function HeroSlider({ images }: { images: { src: string; alt: string }[] }) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const slides = images.length > 1 ? [...images, images[0]] : images;

  useEffect(() => {
    if (images.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = window.setInterval(() => {
      setAnimate(true);
      setIndex((current) => current + 1);
    }, HOLD_MS);
    return () => window.clearInterval(timer);
  }, [images.length]);

  useEffect(() => {
    if (index !== images.length || images.length < 2) return;
    const timer = window.setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, MOVE_MS);
    return () => window.clearTimeout(timer);
  }, [index, images.length]);

  if (!images.length) return null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-sage">
      <div
        className={`flex h-full ${animate ? "transition-transform duration-700 ease-out" : ""}`}
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((image, slideIndex) => (
          <div key={`${image.src}-${slideIndex}`} className="relative h-full w-full shrink-0">
            <img src={image.src} alt={slideIndex === images.length ? "" : image.alt} className="absolute inset-0 h-full w-full object-cover" />
            {slideIndex > 0 ? <span className="absolute inset-y-0 left-0 z-10 w-0.5 bg-white" aria-hidden="true" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
