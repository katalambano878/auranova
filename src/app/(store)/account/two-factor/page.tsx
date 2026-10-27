"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { PageIntro } from "@/components/store/page-intro";

export default function TwoFactorPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Authenticator" body="Enter the six-digit code from your authenticator app." />
      <form className="mt-10 max-w-md space-y-4 rounded-[2rem] bg-mist p-8" onSubmit={async (event) => {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get("code") || "");
        const result = await authClient.twoFactor.verifyTotp({ code });
        if (result.error) return setError(result.error.message || "That code was not accepted.");
        router.push("/account");
        router.refresh();
      }}>
        <Label>Code<Input name="code" inputMode="numeric" autoComplete="one-time-code" required /></Label>
        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
        <Button type="submit">Continue</Button>
      </form>
    </main>
  );
}
