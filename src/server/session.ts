import { headers } from "next/headers";
import { auth, type SessionUser } from "./auth";
import { can } from "./permissions";

export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = session.user as SessionUser;
  if (user.banned) return null;
  return { ...session, user };
}

export async function requirePermission(permission: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Sign in to continue.", status: 401 };
  if (!can(session.user.role, permission)) {
    return { ok: false as const, error: "You do not have permission for that action.", status: 403 };
  }
  return { ok: true as const, session };
}
