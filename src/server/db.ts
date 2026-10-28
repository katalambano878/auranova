import ws from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as { supabase?: SupabaseClient };

export function nid() {
  return crypto.randomUUID();
}

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

export function supabaseAdmin() {
  if (!globalForSupabase.supabase) globalForSupabase.supabase = createAdmin();
  return globalForSupabase.supabase;
}

export function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
