"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestPasswordResetAction, signInAction, signUpAction } from "@/server/actions/auth";
import { syncCart } from "@/server/actions/storefront";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";

export function AuthForm({ mode }: { mode: "login" | "register" | "forgot" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState("");
  return (
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      setError("");
      const data = new FormData(event.currentTarget);
      const email = String(data.get("email") || "");
      const password = String(data.get("password") || "");
      const name = String(data.get("name") || "");
      if (mode === "forgot") {
        const result = await requestPasswordResetAction(email);
        setPending(false);
        setDone(result.ok ? "If an account exists, a reset link is on its way." : "");
        if (!result.ok) setError(result.error);
        return;
      }
      const result = mode === "login" ? await signInAction(email, password) : await signUpAction(name, email, password);
      setPending(false);
      if (!result.ok) return setError(result.error);
      try {
        await syncCart();
      } catch {
        // The session is already saved. A cart problem must not leave the person on the sign-in form.
      }
      router.push(destination);
      router.refresh();
    }}>
      {mode === "register" ? <Label>Name<Input name="name" required /></Label> : null}
      <Label>Email<Input name="email" type="email" required /></Label>
      {mode !== "forgot" ? <Label>Password<Input name="password" type="password" required minLength={8} /></Label> : null}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      {done ? <p className="text-sm" role="status">{done}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}</Button>
    </form>
  );
}
