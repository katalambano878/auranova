import { saveFaq, savePage } from "@/server/actions/admin";
import { prisma } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label, Textarea } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function PagesAdmin() {
  const [pages, faqs] = await Promise.all([
    prisma.contentPage.findMany({ orderBy: { slug: "asc" } }),
    prisma.faqItem.findMany({ orderBy: { position: "asc" } }),
  ]);
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">Pages</h1>
      {pages.map((page) => {
        const blocks = Array.isArray(page.blocks) ? page.blocks as { text?: string }[] : [];
        return (
          <section key={page.slug} className="mt-8 border border-line p-4">
            <AdminForm action={savePage}>
              <input type="hidden" name="slug" value={page.slug} />
              <Label>Title<Input name="title" defaultValue={page.title} /></Label>
              <Label>Body, paragraphs separated by a blank line<Textarea name="body" rows={8} defaultValue={blocks.map((block) => block.text || "").join("\n\n")} /></Label>
            </AdminForm>
          </section>
        );
      })}
      <h2 className="mt-10 font-serif text-2xl">FAQ</h2>
      <ul className="mt-3 text-sm">{faqs.map((item) => <li key={item.id} className="border-b border-line py-2"><span className="font-medium">{item.question}</span><span className="block text-stone">{item.answer}</span></li>)}</ul>
      <div className="mt-4">
        <AdminForm action={saveFaq} submit="Add question">
          <Label>Question<Input name="question" required /></Label>
          <Label>Answer<Textarea name="answer" required rows={3} /></Label>
        </AdminForm>
      </div>
    </main>
  );
}
