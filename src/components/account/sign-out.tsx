"use client";

import { useRouter } from "next/navigation";
import { signOutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOut() {
  const router = useRouter();
  return <Button className="mt-8" variant="line" onClick={async () => { await signOutAction(); router.push("/"); router.refresh(); }}>Sign out</Button>;
}
