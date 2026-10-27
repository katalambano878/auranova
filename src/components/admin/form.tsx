"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Result = { ok: boolean; error?: string; message?: string } | void;

export function AdminForm({
  action,
  children,
  submit = "Save",
}: {
  action: (formData: FormData) => Promise<Result>;
  children: React.ReactNode;
  submit?: string;
}) {
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const result = await action(new FormData(event.currentTarget));
        setPending(false);
        if (result && "ok" in result && !result.ok) {
          setError(result.error || "Could not save.");
          setNote("");
          return;
        }
        setNote(result && "message" in result && result.message ? result.message : "Saved.");
      }}
    >
      {children}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      {note ? <p className="text-sm text-moss" role="status">{note}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : submit}</Button>
    </form>
  );
}
