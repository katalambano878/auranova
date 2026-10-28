import { markNotificationRead } from "@/server/actions/admin-ops";
import { supabaseAdmin, throwIf } from "@/server/db";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { data: notes, error } = await supabaseAdmin().from("Notification").select("*").order("createdAt", { ascending: false }).limit(80);
  throwIf(error);
  return (
    <main>
      <h1 className="font-serif text-4xl">Notifications</h1>
      <p className="mt-2 text-sm text-stone">If Resend is not configured, the row says email was not sent.</p>
      <ul className="mt-6 space-y-3">
        {(notes || []).map((note) => (
          <li key={note.id} className="border border-line p-4 text-sm">
            <p className="font-medium">{note.title}</p>
            <p className="mt-1">{note.body}</p>
            <p className="mt-1 text-stone">{note.emailNote || "No email was attempted."} · {note.readAt ? "Read" : "Unread"}</p>
            {!note.readAt ? (
              <form className="mt-2" action={async () => { "use server"; await markNotificationRead(note.id); }}>
                <Button type="submit" variant="line" size="sm">Mark read</Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
