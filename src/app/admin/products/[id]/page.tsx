import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { addVariant } from "@/server/actions/admin";
import { attachProductImage } from "@/server/actions/admin-ops";
import { prisma } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { ProductEditor } from "@/components/admin/product-editor";
import { Input, Label } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, brands, media] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { variants: true, images: { orderBy: { position: "asc" } } } }),
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  if (!product) notFound();
  return (
    <main className="max-w-3xl">
      <p className="text-sm"><Link href="/admin/products" className="underline">Products</Link></p>
      <h1 className="mt-2 font-serif text-4xl">{product.name}</h1>
      {product.isDemo ? <p className="mt-2 text-sm text-copper">Demonstration product.</p> : null}
      <div className="mt-6"><ProductEditor product={product} categories={categories} brands={brands} /></div>
      <section className="mt-12">
        <h2 className="font-serif text-2xl">Images</h2>
        <ul className="mt-3 grid grid-cols-3 gap-3">
          {product.images.map((image) => <li key={image.id}><img src={image.url} alt={image.alt} className="aspect-square w-full object-cover" /></li>)}
        </ul>
        <div className="mt-4">
          <AdminForm action={attachProductImage} submit="Attach image">
            <input type="hidden" name="productId" value={product.id} />
            <Label>Library image
              <select name="mediaId" className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm" required>
                <option value="">Choose</option>
                {media.map((asset) => <option key={asset.id} value={asset.id}>{asset.alt || asset.url}</option>)}
              </select>
            </Label>
          </AdminForm>
        </div>
      </section>
      <section className="mt-12">
        <h2 className="font-serif text-2xl">Variants</h2>
        <ul className="mt-3 text-sm">
          {product.variants.map((variant) => (
            <li key={variant.id} className="border-b border-line py-2">{variant.label} · {variant.sku} · {formatMoney(variant.price)} · {variant.onHand - variant.reserved} available</li>
          ))}
        </ul>
        <div className="mt-4">
          <AdminForm action={addVariant} submit="Add variant">
            <input type="hidden" name="productId" value={product.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <Label>Label<Input name="label" required /></Label>
              <Label>SKU<Input name="sku" required /></Label>
              <Label>Price (GHS)<Input name="price" required /></Label>
              <Label>Sale price (GHS)<Input name="salePrice" /></Label>
              <Label>Stock<Input name="onHand" type="number" defaultValue={0} /></Label>
              <Label>Colour<Input name="color" /></Label>
              <Label>Size<Input name="size" /></Label>
              <Label>Capacity<Input name="capacity" /></Label>
            </div>
          </AdminForm>
        </div>
      </section>
    </main>
  );
}
