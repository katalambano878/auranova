import { TrackForm } from "@/components/store/track-form";
import { PageIntro } from "@/components/store/page-intro";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Orders" title="Track an order" body="Use the order number and the email from checkout." />
      <div className="mt-10 max-w-md rounded-[2rem] bg-mist p-8"><TrackForm initialOrder={order} /></div>
    </main>
  );
}
