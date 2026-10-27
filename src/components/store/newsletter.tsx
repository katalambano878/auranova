"use client";

import { useState } from "react";
import { subscribeNewsletter } from "@/server/actions/storefront";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="flex w-full flex-col gap-3 sm:flex-row"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const email = new FormData(event.currentTarget).get("email");
        const result = await subscribeNewsletter(String(email || ""));
        setPending(false);
        setMessage(result.ok ? result.message : result.error);
      }}
    >
      <label className="sr-only" htmlFor="newsletter-email">Email</label>
      <input id="newsletter-email" name="email" type="email" required placeholder="Enter your email address" className="w-full rounded-full border border-line bg-white px-4 py-3" />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Subscribe"}</Button>
      {message ? <p className="self-center text-sm" role="status">{message}</p> : null}
    </form>
  );
}
