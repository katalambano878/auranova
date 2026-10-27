import { redirect } from "next/navigation";
import { SecurityPanel } from "@/components/account/security-panel";
import { getSession } from "@/server/session";
import { PageIntro } from "@/components/store/page-intro";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) redirect("/account/login");
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Security" />
      <div className="mt-10 max-w-3xl rounded-[2rem] bg-mist p-8">
      <SecurityPanel />
      </div>
    </main>
  );
}
