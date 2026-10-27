import { saveProduct } from "@/server/actions/admin";
import { AdminForm } from "@/components/admin/form";
import { Input, Label, Textarea } from "@/components/ui/fields";

type Product = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  brandId: string | null;
  price: number;
  salePrice: number | null;
  onHand: number;
  lowStockThreshold: number;
  status: string;
  featured: boolean;
  bestseller: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  features: string[];
};

export function ProductEditor({
  product,
  categories,
  brands,
}: {
  product?: Product;
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
}) {
  const major = (value: number | null | undefined) => (value == null ? "" : (value / 100).toFixed(2));
  return (
    <AdminForm action={saveProduct}>
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Label>Name<Input name="name" required defaultValue={product?.name} /></Label>
        <Label>Slug<Input name="slug" defaultValue={product?.slug} /></Label>
        <Label>SKU<Input name="sku" required defaultValue={product?.sku} /></Label>
        <Label>Status
          <select name="status" defaultValue={product?.status || "DRAFT"} className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm">
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Label>
        <Label>Category
          <select name="categoryId" required defaultValue={product?.categoryId || ""} className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm">
            <option value="">Choose</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </Label>
        <Label>Brand
          <select name="brandId" defaultValue={product?.brandId || ""} className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm">
            <option value="">None</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </Label>
        <Label>Price (GHS)<Input name="price" required defaultValue={major(product?.price)} /></Label>
        <Label>Sale price (GHS)<Input name="salePrice" defaultValue={major(product?.salePrice)} /></Label>
        <Label>Stock on hand<Input name="onHand" type="number" defaultValue={product?.onHand ?? 0} /></Label>
        <Label>Low-stock threshold<Input name="lowStockThreshold" type="number" defaultValue={product?.lowStockThreshold ?? 5} /></Label>
      </div>
      <Label>Short description<Input name="shortDescription" defaultValue={product?.shortDescription} /></Label>
      <Label>Description (Markdown)<Textarea name="description" rows={6} defaultValue={product?.description} /></Label>
      <Label>Features, one per line<Textarea name="features" rows={4} defaultValue={product?.features.join("\n")} /></Label>
      <Label>SEO title<Input name="seoTitle" defaultValue={product?.seoTitle || ""} /></Label>
      <Label>SEO description<Input name="seoDescription" defaultValue={product?.seoDescription || ""} /></Label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={product?.featured} /> Featured</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bestseller" defaultChecked={product?.bestseller} /> Bestseller</label>
    </AdminForm>
  );
}
