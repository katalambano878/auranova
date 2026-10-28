"use server";

import { appUrl } from "../env";
import { supabaseAdmin, throwIf } from "../db";
import { supabaseSession } from "../supabase-session";

export async function signInAction(email: string, password: string) {
  const client = await supabaseSession();
  if (!client) return { ok: false as const, error: "Supabase is not configured." };
  const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function signUpAction(name: string, email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const admin = supabaseAdmin();
  const created = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { name: name.trim() },
  });
  if (created.error || !created.data.user) return { ok: false as const, error: created.error?.message || "Could not create the account." };
  const row = await admin.from("User").insert({
    id: created.data.user.id,
    name: name.trim() || cleanEmail.split("@")[0],
    email: cleanEmail,
    emailVerified: true,
    role: "customer",
  });
  if (row.error && !row.error.message.includes("duplicate")) return { ok: false as const, error: row.error.message };
  return signInAction(cleanEmail, password);
}

export async function signOutAction() {
  const client = await supabaseSession();
  if (client) await client.auth.signOut();
  return { ok: true as const };
}

export async function requestPasswordResetAction(email: string) {
  const client = await supabaseSession();
  if (!client) return { ok: false as const, error: "Supabase is not configured." };
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${appUrl()}/account/reset-password`,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function updatePasswordAction(currentPassword: string, nextPassword: string) {
  const client = await supabaseSession();
  if (!client) return { ok: false as const, error: "Supabase is not configured." };
  const { data } = await client.auth.getUser();
  if (!data.user?.email) return { ok: false as const, error: "Sign in to continue." };
  const check = await client.auth.signInWithPassword({ email: data.user.email, password: currentPassword });
  if (check.error) return { ok: false as const, error: "Current password is wrong." };
  const { error } = await client.auth.updateUser({ password: nextPassword });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function setRecoveryPasswordAction(nextPassword: string) {
  const client = await supabaseSession();
  if (!client) return { ok: false as const, error: "Supabase is not configured." };
  const { error } = await client.auth.updateUser({ password: nextPassword });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function createStaffUser(input: { name: string; email: string; password: string; role: string }) {
  const admin = supabaseAdmin();
  const created = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });
  if (created.error || !created.data.user) return { ok: false as const, error: created.error?.message || "Could not create staff." };
  const row = await admin.from("User").upsert({
    id: created.data.user.id,
    name: input.name,
    email: input.email.trim().toLowerCase(),
    emailVerified: true,
    role: input.role,
  });
  throwIf(row.error);
  return { ok: true as const, id: created.data.user.id };
}
