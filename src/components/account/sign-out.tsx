"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOut() {
  const router = useRouter();
  return <Button className="mt-8" variant="line" onClick={async () => { await authClient.signOut(); router.push("/"); router.refresh(); }}>Sign out</Button>;
}
