export const cataloguePhotos: Record<string, string> = {
  "compact-blender": "/featured/blender.jpg",
  "desk-lamp": "/featured/lamp.jpg",
  "linen-throw": "/featured/throw.jpg",
};

export function catalogueImage(slug: string | undefined, fallback?: string | null) {
  if (slug && cataloguePhotos[slug]) return cataloguePhotos[slug];
  return fallback ?? null;
}
