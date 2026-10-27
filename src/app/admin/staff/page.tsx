import { staffRoles } from "@/server/permissions";
import { createStaff } from "@/server/actions/admin";
import { prisma } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const staff = await prisma.user.findMany({ where: { role: { not: "customer" } }, orderBy: { createdAt: "asc" } });
  return (
    <main className="max-w-xl">
      <h1 className="font-serif text-4xl">Staff</h1>
      <ul className="mt-6 text-sm">
        {staff.map((person) => <li key={person.id} className="border-b border-line py-2">{person.name} · {person.email} · {person.role.replaceAll("_", " ")}{person.twoFactorEnabled ? " · authenticator on" : ""}</li>)}
      </ul>
      <div className="mt-8">
        <h2 className="font-serif text-2xl">Add a staff account</h2>
        <p className="mt-2 text-sm text-stone">There is no public admin signup. Super admin can create the roles below. Turn on ADMIN_2FA_REQUIRED in production so admin accounts must enrol an authenticator.</p>
        <AdminForm action={createStaff} submit="Create staff account">
          <Label>Name<Input name="name" required /></Label>
          <Label>Email<Input name="email" type="email" required /></Label>
          <Label>Temporary password<Input name="password" type="password" required minLength={8} /></Label>
          <Label>Role
            <select name="role" className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm">
              {staffRoles.filter((role) => role !== "super_admin").map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
            </select>
          </Label>
        </AdminForm>
      </div>
    </main>
  );
}
