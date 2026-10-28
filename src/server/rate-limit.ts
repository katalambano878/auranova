import { supabaseAdmin } from "./db";

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const resetAt = new Date(Date.now() + windowMs).toISOString();
  const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", { p_key: key, p_reset: resetAt });
  if (error) throw new Error(error.message);
  return Number(data) <= limit ? { ok: true as const } : { ok: false as const };
}
