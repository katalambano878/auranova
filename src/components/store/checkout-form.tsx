"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { GHANA_REGIONS } from "@/lib/ghana";
import { deliveryOptionsAction, paymentMethodsAction, placeOrderAction, quoteCheckoutAction } from "@/server/actions/checkout";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";

type Method = { id: string; name: string; fee: number; available: boolean; reason: string | null; estimateMinDays: number | null; estimateMaxDays: number | null; pickupInstructions: string | null };
type Pay = { id: string; label: string };

const steps = ["Details", "Delivery", "Method", "Payment", "Review"];

export function CheckoutForm({ coupon, addresses }: { coupon: string; addresses: { id: string; label: string; firstName: string; lastName: string; phone: string; region: string; city: string; line1: string; landmark: string | null; digitalAddress: string | null; postalCode: string | null }[] }) {
  const router = useRouter();
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [methods, setMethods] = useState<Method[]>([]);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [quote, setQuote] = useState<{ subtotal: number; discount: number; shippingFee: number; tax: number; total: number; currency: string; methodName: string } | null>(null);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", region: "Greater Accra", city: "", line1: "", landmark: "", digitalAddress: "", postalCode: "", instructions: "", notes: "", shippingMethodId: "", paymentMethod: "", couponCode: coupon,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function next() {
    if (step === 0 && (!form.firstName.trim() || !form.lastName.trim() || !form.email.includes("@") || !form.phone.trim())) {
      return toast.error("Enter your name, email, and a Ghana phone number.");
    }
    if (step === 1 && (!form.city.trim() || form.line1.trim().length < 3)) {
      return toast.error("Enter a city and a street address.");
    }
    if (step === 1) {
      const options = await deliveryOptionsAction(form.region, form.city);
      setMethods(options);
      if (!options.some((method) => method.available)) toast.error("No delivery method is configured for that address.");
    }
    if (step === 2 && !form.shippingMethodId) return toast.error("Choose a delivery method.");
    let paymentMethod = form.paymentMethod;
    if (step === 2) {
      const available = await paymentMethodsAction();
      setPayments(available);
      paymentMethod = paymentMethod || available[0]?.id || "";
      if (paymentMethod) set("paymentMethod", paymentMethod);
    }
    if (step === 3) {
      const quoted = await quoteCheckoutAction({ ...form, paymentMethod, idempotencyKey });
      if (!quoted.ok) return toast.error("error" in quoted ? quoted.error : quoted.reason);
      setQuote(quoted);
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <form className="space-y-6" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      const result = await placeOrderAction({ ...form, idempotencyKey });
      setPending(false);
      if (!result.ok) return toast.error("error" in result ? String(result.error) : result.reason);
      if ("error" in result && typeof result.error === "string" && result.error) toast.error(result.error);
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
      else router.push(`/checkout/confirmation?attempt=${result.attemptReference}`);
    }}>
      <ol className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.14em] text-stone">
        {steps.map((label, index) => <li key={label} className={index === step ? "text-ink" : ""}>{index + 1}. {label}</li>)}
      </ol>
      {step === 0 ? (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="font-serif text-3xl sm:col-span-2">Customer</legend>
          {addresses.length ? (
            <label className="sm:col-span-2 text-sm">Saved address
              <select className="mt-1 w-full rounded-full border border-line bg-white px-4 py-2" defaultValue="" onChange={(event) => {
                const address = addresses.find((item) => item.id === event.target.value);
                if (!address) return;
                setForm((current) => ({ ...current, ...address, landmark: address.landmark || "", digitalAddress: address.digitalAddress || "", postalCode: address.postalCode || "" }));
              }}>
                <option value="">Enter a new address</option>
                {addresses.map((address) => <option key={address.id} value={address.id}>{address.label}</option>)}
              </select>
            </label>
          ) : null}
          <Field label="First name" value={form.firstName} onChange={(value) => set("firstName", value)} />
          <Field label="Last name" value={form.lastName} onChange={(value) => set("lastName", value)} />
          <Field label="Email" type="email" value={form.email} onChange={(value) => set("email", value)} />
          <Field label="Phone" value={form.phone} onChange={(value) => set("phone", value)} />
        </fieldset>
      ) : null}
      {step === 1 ? (
        <fieldset className="grid gap-4">
          <legend className="font-serif text-3xl">Delivery address</legend>
          <label className="text-sm">Region
            <select className="mt-1 w-full rounded-full border border-line bg-white px-4 py-2" value={form.region} onChange={(event) => set("region", event.target.value)}>
              {GHANA_REGIONS.map((region) => <option key={region}>{region}</option>)}
            </select>
          </label>
          <Field label="City or town" value={form.city} onChange={(value) => set("city", value)} />
          <Field label="Address" value={form.line1} onChange={(value) => set("line1", value)} />
          <Field label="Landmark" value={form.landmark} onChange={(value) => set("landmark", value)} />
          <Field label="GhanaPost digital address" value={form.digitalAddress} onChange={(value) => set("digitalAddress", value)} />
          <Field label="Postal code (optional)" value={form.postalCode} onChange={(value) => set("postalCode", value)} />
          <Field label="Delivery notes" value={form.instructions} onChange={(value) => set("instructions", value)} />
        </fieldset>
      ) : null}
      {step === 2 ? (
        <fieldset className="space-y-3">
          <legend className="font-serif text-3xl">Delivery method</legend>
          {methods.map((method) => (
            <label key={method.id} className="flex items-start gap-3 border border-line p-3">
              <input type="radio" name="shipping" disabled={!method.available} checked={form.shippingMethodId === method.id} onChange={() => set("shippingMethodId", method.id)} />
              <span>
                <span className="block">{method.name} · {formatMoney(method.fee, "GHS")}</span>
                <span className="text-sm text-stone">{method.available ? estimate(method) || "No estimate configured" : method.reason}</span>
                {method.pickupInstructions ? <span className="block text-sm text-stone">{method.pickupInstructions}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {step === 3 ? (
        <fieldset className="space-y-3">
          <legend className="font-serif text-3xl">Payment</legend>
          <Field label="Coupon" value={form.couponCode} onChange={(value) => set("couponCode", value)} />
          <Field label="Order notes" value={form.notes} onChange={(value) => set("notes", value)} />
          {payments.map((method) => (
            <label key={method.id} className="flex items-center gap-3 border border-line p-3">
              <input type="radio" name="payment" checked={form.paymentMethod === method.id} onChange={() => set("paymentMethod", method.id)} />
              {method.label}
            </label>
          ))}
          {!payments.length ? <p>No payment method is enabled.</p> : null}
        </fieldset>
      ) : null}
      {step === 4 && quote ? (
        <section>
          <h2 className="font-serif text-3xl">Review</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={formatMoney(quote.subtotal, quote.currency)} />
            <Row label="Discount" value={formatMoney(quote.discount, quote.currency)} />
            <Row label={quote.methodName} value={formatMoney(quote.shippingFee, quote.currency)} />
            <Row label="Tax" value={formatMoney(quote.tax, quote.currency)} />
            <Row label="Total" value={formatMoney(quote.total, quote.currency)} />
          </dl>
          <p className="mt-4 text-sm text-stone">{form.line1}, {form.city}, {form.region}. Payment: {payments.find((method) => method.id === form.paymentMethod)?.label}</p>
        </section>
      ) : null}
      <div className="flex gap-3">
        {step > 0 ? <Button type="button" variant="line" onClick={() => setStep((current) => current - 1)}>Back</Button> : null}
        {step < 4 ? <Button type="button" onClick={() => void next()}>Continue</Button> : <Button type="submit" disabled={pending}>{pending ? "Placing order…" : "Place order"}</Button>}
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <Label>{label}<Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></Label>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt>{label}</dt><dd>{value}</dd></div>;
}
function estimate(method: { estimateMinDays: number | null; estimateMaxDays: number | null }) {
  if (method.estimateMinDays == null && method.estimateMaxDays == null) return null;
  if (method.estimateMinDays != null && method.estimateMaxDays != null && method.estimateMinDays !== method.estimateMaxDays) return `Estimated ${method.estimateMinDays}–${method.estimateMaxDays} days`;
  const day = method.estimateMinDays ?? method.estimateMaxDays;
  return `Estimated ${day} day${day === 1 ? "" : "s"}`;
}
