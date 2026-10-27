"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { trackOrder } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";

export function TrackForm({ initialOrder = "" }: { initialOrder?: string }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof trackOrder>> | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div>
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const data = new FormData(event.currentTarget);
        setResult(await trackOrder(String(data.get("number") || ""), String(data.get("email") || "")));
        setPending(false);
      }}>
        <Label>Order number<Input name="number" defaultValue={initialOrder} required /></Label>
        <Label>Email<Input name="email" type="email" required /></Label>
        <Button type="submit" disabled={pending}>{pending ? "Looking up…" : "Look up"}</Button>
      </form>
      {result && !result.ok ? <p className="mt-4 text-danger" role="alert">{result.error}</p> : null}
      {result && result.ok ? (
        <div className="mt-6 border border-line p-4">
          <p className="font-medium">{result.order.number}</p>
          <p className="text-sm text-stone">Payment {result.order.paymentStatus.toLowerCase()} · {result.order.fulfilmentStatus.toLowerCase().replaceAll("_", " ")}</p>
          <p className="mt-2">{formatMoney(result.order.total, result.order.currency)}</p>
          {result.order.trackingRef ? <p className="mt-2">Tracking {result.order.trackingRef}</p> : <p className="mt-2 text-sm text-stone">No tracking reference yet.</p>}
          <ul className="mt-3 text-sm">{result.order.items.map((item) => <li key={item.name}>{item.quantity} × {item.name}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
