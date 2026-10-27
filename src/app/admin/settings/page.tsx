import { saveSettings } from "@/server/actions/admin";
import { getSettings } from "@/server/settings";
import { AdminForm } from "@/components/admin/form";
import { Input, Label, Textarea } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <main className="max-w-2xl">
      <h1 className="font-serif text-4xl">Settings</h1>
      <p className="mt-2 text-sm text-stone">Starter copy is editable here. Tax stays at zero until an accountant confirms a rate. Prices are tax-inclusive.</p>
      <div className="mt-6">
        <AdminForm action={saveSettings}>
          <Label>Store name<Input name="storeName" defaultValue={settings.storeName} /></Label>
          <Label>Tagline<Input name="tagline" defaultValue={settings.tagline} /></Label>
          <Label>Support phone<Input name="supportPhone" defaultValue={settings.supportPhone || ""} /></Label>
          <Label>WhatsApp number<Input name="supportWhatsapp" defaultValue={settings.supportWhatsapp || ""} /></Label>
          <Label>Support email<Input name="supportEmail" defaultValue={settings.supportEmail || ""} /></Label>
          <Label>Address<Input name="addressLine" defaultValue={settings.addressLine || ""} /></Label>
          <Label>Hero title<Input name="heroTitle" defaultValue={settings.heroTitle} /></Label>
          <Label>Hero subtitle<Textarea name="heroSubtitle" defaultValue={settings.heroSubtitle} rows={3} /></Label>
          <Label>Announcement<Input name="announcement" defaultValue={settings.announcement || ""} /></Label>
          <Label>Legal name<Input name="legalName" defaultValue={settings.legalName || ""} /></Label>
          <Label>TIN<Input name="tin" defaultValue={settings.tin || ""} /></Label>
          <Label>Tax percent<Input name="taxPercent" defaultValue={(settings.taxRateBps / 100).toString()} /></Label>
          <Label>Instagram<Input name="instagramUrl" defaultValue={settings.instagramUrl || ""} /></Label>
          <Label>Facebook<Input name="facebookUrl" defaultValue={settings.facebookUrl || ""} /></Label>
          <Label>TikTok<Input name="tiktokUrl" defaultValue={settings.tiktokUrl || ""} /></Label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="announcementEnabled" defaultChecked={settings.announcementEnabled} /> Show announcement</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="salePricingEnabled" defaultChecked={settings.salePricingEnabled} /> Global sale pricing</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="maintenanceMode" defaultChecked={settings.maintenanceMode} /> Maintenance mode</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="demoBanner" defaultChecked={settings.demoBanner} /> Demonstration banner</label>
          {settings.payOnDeliveryEnabled ? <input type="hidden" name="payOnDeliveryEnabled" value="on" /> : null}
          {settings.moolreEnabled ? <input type="hidden" name="moolreEnabled" value="on" /> : null}
          {settings.flutterwaveEnabled ? <input type="hidden" name="flutterwaveEnabled" value="on" /> : null}
          {settings.paystackEnabled ? <input type="hidden" name="paystackEnabled" value="on" /> : null}
          {settings.hubtelEnabled ? <input type="hidden" name="hubtelEnabled" value="on" /> : null}
        </AdminForm>
      </div>
    </main>
  );
}
