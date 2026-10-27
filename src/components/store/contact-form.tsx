"use client";

import { useState } from "react";
import { sendContact } from "@/server/actions/storefront";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/fields";

export function ContactForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form className="mt-8 space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      const data = new FormData(event.currentTarget);
      const result = await sendContact({
        name: String(data.get("name") || ""),
        email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
        message: String(data.get("message") || ""),
      });
      setPending(false);
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) event.currentTarget.reset();
    }}>
      <Label>Name<Input name="name" required /></Label>
      <Label>Email<Input name="email" type="email" required /></Label>
      <Label>Phone<Input name="phone" /></Label>
      <Label>Message<Textarea name="message" required rows={5} /></Label>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</Button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
