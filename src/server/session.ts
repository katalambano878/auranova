import { supabaseAdmin, throwIf } from "./db";
import { can } from "./permissions";
import { supabaseSession } from "./supabase-session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  banned?: boolean;
  twoFactorEnabled?: boolean;
};

export async function getSession() {
  const client = await supabaseSession();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  const email = data.user?.email;
  if (error || !email || !data.user) return null;
  const authUser = data.user;
  const db = supabaseAdmin();
  const existing = await db.from("User").select("id, name, email, role, phone, banned, twoFactorEnabled").eq("id", authUser.id).maybeSingle();
  throwIf(existing.error);
  let profile = existing.data;
  if (!profile) {
    const byEmail = await db.from("User").select("id, name, email, role, phone, banned, twoFactorEnabled").eq("email", email.toLowerCase()).maybeSingle();
    throwIf(byEmail.error);
    profile = byEmail.data;
  }
  if (!profile) {
    const created = await db.from("User").insert({
      id: authUser.id,
      name: String(authUser.user_metadata?.name || email.split("@")[0]),
      email: email.toLowerCase(),
      emailVerified: Boolean(authUser.email_confirmed_at),
      role: "customer",
    }).select("id, name, email, role, phone, banned, twoFactorEnabled").single();
    throwIf(created.error);
    profile = created.data;
  }
  if (!profile || profile.banned) return null;
  return {
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      phone: profile.phone,
      banned: profile.banned,
      twoFactorEnabled: profile.twoFactorEnabled,
    } satisfies SessionUser,
  };
}

export async function requirePermission(permission: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Sign in to continue.", status: 401 };
  if (!can(session.user.role, permission)) {
    return { ok: false as const, error: "You do not have permission for that action.", status: 403 };
  }
  return { ok: true as const, session };
}
