"use client";

import { useState } from "react";
import { requestData } from "@/server/actions/account";
import { updatePasswordAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";

export function SecurityPanel() {
  const [message, setMessage] = useState("");
  return (
    <div className="mt-8 space-y-8">
      <form className="max-w-md space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const result = await updatePasswordAction(String(data.get("current") || ""), String(data.get("next") || ""));
        setMessage(result.ok ? "Password updated." : result.error);
      }}>
        <h2 className="font-serif text-2xl">Password</h2>
        <Label>Current password<Input name="current" type="password" required /></Label>
        <Label>New password<Input name="next" type="password" required minLength={8} /></Label>
        <Button type="submit">Update password</Button>
      </form>
      <div className="flex flex-wrap gap-3">
        <Button variant="line" onClick={async () => setMessage((await requestData("EXPORT")).ok ? "Export requested." : "Sign in required.")}>Request data export</Button>
        <Button variant="line" onClick={async () => setMessage((await requestData("DELETION")).message || "Requested.")}>Request deletion</Button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
