import { uploadMedia } from "@/server/actions/admin";
import { supabaseAdmin, throwIf } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const { data: assets, error } = await supabaseAdmin().from("MediaAsset").select("*").order("createdAt", { ascending: false }).limit(60);
  throwIf(error);
  return (
    <main>
      <h1 className="font-serif text-4xl">Media</h1>
      <p className="mt-2 text-sm text-stone">JPEG, PNG, WebP, or GIF, up to 5 MB. Files are stored on the local volume unless S3 credentials are set.</p>
      <div className="mt-6 max-w-md">
        <AdminForm action={uploadMedia} submit="Upload">
          <Label>Image<Input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /></Label>
          <Label>Alt text<Input name="alt" /></Label>
        </AdminForm>
      </div>
      <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {(assets || []).map((asset) => (
          <li key={asset.id} className="border border-line bg-card p-2">
            <img src={asset.url} alt={asset.alt} className="aspect-square w-full object-cover" />
            <p className="mt-2 truncate text-xs text-stone">{asset.alt || asset.url}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
