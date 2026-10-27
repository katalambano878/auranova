import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isContentBlocks } from "@/lib/markdown";
import { prisma } from "@/server/db";
import { PageIntro } from "@/components/store/page-intro";

export async function contentMetadata(slug: string): Promise<Metadata> {
  const page = await prisma.contentPage.findUnique({ where: { slug } });
  return { title: page?.seoTitle || page?.title || "Page", description: page?.seoDescription || undefined };
}

export async function ContentPage({ slug, extra }: { slug: string; extra?: React.ReactNode }) {
  const page = await prisma.contentPage.findUnique({ where: { slug } });
  if (!page || !isContentBlocks(page.blocks)) notFound();
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="AuraNova" title={page.title} body="Starter copy for the store owner to replace. It is not legal advice." />
      <div className="mt-10 max-w-2xl space-y-4 rounded-[2rem] bg-mist p-8 text-ink">
        {page.blocks.map((block, index) => {
          if (block.type === "heading") return <h2 key={index} className="font-serif text-2xl">{block.text}</h2>;
          if (block.type === "list") return <ul key={index} className="list-disc pl-5">{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
          return <p key={index}>{block.text}</p>;
        })}
      </div>
      {extra}
    </main>
  );
}
