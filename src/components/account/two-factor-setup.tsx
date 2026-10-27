"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";

export function TwoFactorSetup() {
  const [uri, setUri] = useState("");
  const [message, setMessage] = useState("");
  return (
    <section className="max-w-md space-y-3">
      <h2 className="font-serif text-2xl">Authenticator</h2>
      <p className="text-sm text-stone">Staff accounts should enrol an authenticator. Production can require it with ADMIN_2FA_REQUIRED.</p>
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get("password") || "");
        const result = await authClient.twoFactor.enable({ password });
        if (result.error) return setMessage(result.error.message || "Could not start enrolment.");
        const data = result.data;
        setUri(data && "totpURI" in data ? data.totpURI : "");
        setMessage("Scan the address below, then confirm with a code.");
      }}>
        <Label>Current password<Input name="password" type="password" required /></Label>
        <Button type="submit" variant="line">Start enrolment</Button>
      </form>
      {uri ? <p className="break-all text-xs">{uri}</p> : null}
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get("code") || "");
        const result = await authClient.twoFactor.verifyTotp({ code });
        setMessage(result.error ? result.error.message || "Code was not accepted." : "Authenticator is on for this account.");
      }}>
        <Label>Confirmation code<Input name="code" inputMode="numeric" /></Label>
        <Button type="submit" variant="line">Confirm code</Button>
      </form>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </section>
  );
}
