"use client";

import { Suspense, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { PageIntro } from "@/components/store/page-intro";

function browser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
}

function ResetForm() {
  const params = useSearchParams();
  const [message, setMessage] = useState("");
  return (
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      const password = String(new FormData(event.currentTarget).get("password") || "");
      const client = browser();
      const code = params.get("code");
      if (code) {
        const exchanged = await client.auth.exchangeCodeForSession(code);
        if (exchanged.error) return setMessage(exchanged.error.message);
      }
      const result = await client.auth.updateUser({ password });
      setMessage(result.error ? result.error.message : "Password updated. You can sign in.");
    }}>
      <Label>New password<Input name="password" type="password" required minLength={8} /></Label>
      <Button type="submit">Update password</Button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

export default function ResetPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Choose a new password" />
      <div className="mt-10 max-w-md rounded-[2rem] bg-mist p-8"><Suspense><ResetForm /></Suspense></div>
    </main>
  );
}
