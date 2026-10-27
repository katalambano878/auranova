import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/server/db";
import { CsvImport } from "@/components/admin/csv-import";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { category: true, images: { take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <main>
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-serif text-4xl">Products</h1>
        <Link href="/admin/products/new" className="rounded-full bg-forest px-4 py-2 text-sm text-white">New product</Link>
      </div>
      <p className="mt-2 text-sm"><a className="underline" href="/api/admin/products.csv">Export CSV</a></p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-line text-stone"><th className="py-2">Product</th><th>SKU</th><th>Status</th><th>Price</th><th>Stock</th></tr></thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-line">
                <td className="py-3">
                  <Link href={`/admin/products/${product.id}`} className="underline">{product.name}</Link>
                  <span className="block text-xs text-stone">{product.category.name}{product.isDemo ? " · demonstration" : ""}</span>
                </td>
                <td>{product.sku}</td>
                <td>{product.status.toLowerCase()}</td>
                <td>{formatMoney(product.salePrice ?? product.price)}</td>
                <td>{product.onHand - product.reserved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="mt-10 max-w-2xl">
        <h2 className="font-serif text-2xl">CSV import</h2>
        <p className="mt-2 text-sm text-stone">Header: sku,name,price,category,stock,status,shortDescription,salePrice. Category is a slug. Run a dry preview before applying.</p>
        <CsvImport />
      </section>
    </main>
  );
}
