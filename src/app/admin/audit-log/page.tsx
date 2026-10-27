import { prisma } from "@/server/db";
import { can } from "@/server/permissions";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await getSession();
  if (!session || (!can(session.user.role, "staff.manage") && !can(session.user.role, "settings.write"))) {
    return <main><h1 className="font-serif text-4xl">Audit log</h1><p className="mt-3">You do not have permission to read the audit log.</p></main>;
  }
  const rows = await prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <main>
      <h1 className="font-serif text-4xl">Audit log</h1>
      <table className="mt-6 w-full text-left text-sm">
        <thead><tr className="border-b border-line text-stone"><th className="py-2">When</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line">
              <td className="py-2">{row.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td>
              <td>{row.actor?.email || "system"}</td>
              <td>{row.action}</td>
              <td>{row.entity}{row.entityId ? ` ${row.entityId.slice(0, 8)}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
