"use client";

import { useState } from "react";
import { toast } from "sonner";
import { retryPaymentAction } from "@/server/actions/checkout";
import { Button } from "@/components/ui/button";

export function RetryPayment({ reference }: { reference: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button className="mt-6" disabled={pending} onClick={async () => {
      setPending(true);
      const result = await retryPaymentAction(reference);
      setPending(false);
      if (!result.ok) return toast.error(result.error);
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
      else toast.success("Payment is already recorded.");
    }}>{pending ? "Starting payment…" : "Try payment again"}</Button>
  );
}
