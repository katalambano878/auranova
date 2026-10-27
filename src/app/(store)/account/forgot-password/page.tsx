import { Suspense } from "react";
import { AuthForm } from "@/components/account/auth-form";
import { PageIntro } from "@/components/store/page-intro";

export default function ForgotPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Reset password" />
      <div className="mt-10 max-w-md rounded-[2rem] bg-mist p-8"><Suspense><AuthForm mode="forgot" /></Suspense></div>
    </main>
  );
}
