import { adjustStock } from "@/server/actions/admin";
import { prisma } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { variants: true },
    orderBy: { name: "asc" },
  });
  const movements = await prisma.inventoryMovement.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <main>
      <h1 className="font-serif text-4xl">Inventory</h1>
      <p className="mt-2 text-sm text-stone">Available is on hand minus reserved. Adjustments are whole units and are written to the movement log.</p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-line text-stone"><th className="py-2">Item</th><th>On hand</th><th>Reserved</th><th>Available</th><th></th></tr></thead>
          <tbody>
            {products.flatMap((product) => {
              const rows = product.variants.length
                ? product.variants.map((variant) => ({ key: variant.id, productId: product.id, variantId: variant.id, name: `${product.name} · ${variant.label}`, onHand: variant.onHand, reserved: variant.reserved }))
                : [{ key: product.id, productId: product.id, variantId: "", name: product.name, onHand: product.onHand, reserved: product.reserved }];
              return rows.map((row) => (
                <tr key={row.key} className="border-b border-line">
                  <td className="py-3">{row.name}</td>
                  <td>{row.onHand}</td>
                  <td>{row.reserved}</td>
                  <td>{row.onHand - row.reserved}</td>
                  <td>
                    <AdminForm action={adjustStock} submit="Adjust">
                      <input type="hidden" name="productId" value={row.productId} />
                      <input type="hidden" name="variantId" value={row.variantId} />
                      <div className="flex gap-2">
                        <Input name="delta" type="number" aria-label={`Adjustment for ${row.name}`} className="w-24" required />
                        <Input name="note" placeholder="Note" aria-label={`Note for ${row.name}`} />
                      </div>
                    </AdminForm>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
      <h2 className="mt-10 font-serif text-2xl">Recent movements</h2>
      <ul className="mt-3 text-sm">
        {movements.map((movement) => <li key={movement.id} className="border-b border-line py-2">{movement.delta > 0 ? "+" : ""}{movement.delta} · {movement.reason} · {movement.createdAt.toISOString().slice(0, 16)}</li>)}
      </ul>
    </main>
  );
}
