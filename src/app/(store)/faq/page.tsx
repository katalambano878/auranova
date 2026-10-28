import { supabaseAdmin, throwIf } from "@/server/db";
import { PageIntro } from "@/components/store/page-intro";

export const dynamic = "force-dynamic";

export const metadata = { title: "FAQ" };

export default async function FaqPage() {
  const { data: items, error } = await supabaseAdmin().from("FaqItem").select("*").eq("published", true).order("position");
  throwIf(error);
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Help" title="Questions" />
      <div className="mt-10 max-w-3xl space-y-3">
        {(items || []).map((item) => (
          <details key={item.id} className="rounded-[1.5rem] bg-mist p-5">
            <summary className="cursor-pointer font-medium">{item.question}</summary>
            <p className="mt-3 text-stone">{item.answer}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
