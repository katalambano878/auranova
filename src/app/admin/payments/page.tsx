import { savePaymentFlags } from "@/server/actions/admin";
import { getSettings } from "@/server/settings";
import { AdminForm } from "@/components/admin/form";

export const dynamic = "force-dynamic";

const providers = [
  { key: "payOnDeliveryEnabled", label: "Pay on delivery", note: "Leaves the order unpaid until you collect payment." },
  { key: "moolreEnabled", label: "Moolre", note: "Needs MOOLRE_API_USER, MOOLRE_API_PUBKEY, MOOLRE_ACCOUNT_NUMBER, and MOOLRE_MERCHANT_EMAIL. Refunds stay pending for a manual confirmation." },
  { key: "flutterwaveEnabled", label: "Flutterwave", note: "Needs FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_WEBHOOK_HASH." },
  { key: "paystackEnabled", label: "Paystack", note: "Needs PAYSTACK_SECRET_KEY. Webhooks are checked with that secret." },
  { key: "hubtelEnabled", label: "Hubtel", note: "Needs HUBTEL_CLIENT_ID, HUBTEL_CLIENT_SECRET, and HUBTEL_MERCHANT_ACCOUNT_NUMBER. No refund call is implemented." },
] as const;

export default async function PaymentsPage() {
  const settings = await getSettings();
  return (
    <main className="max-w-2xl">
      <h1 className="font-serif text-4xl">Payments</h1>
      <p className="mt-2 text-sm text-stone">A method appears at checkout only when this switch is on and the server credentials exist. Sandbox success is not simulated. Providers stay unverified until a real initiate-and-verify cycle is run.</p>
      <AdminForm action={savePaymentFlags} submit="Save payment switches">
        <ul className="space-y-4">
          {providers.map((provider) => (
            <li key={provider.key} className="border border-line p-4">
              <label className="flex items-center gap-2 font-medium"><input type="checkbox" name={provider.key} defaultChecked={settings[provider.key]} /> {provider.label}</label>
              <p className="mt-2 text-sm text-stone">{provider.note}</p>
            </li>
          ))}
        </ul>
      </AdminForm>
    </main>
  );
}
