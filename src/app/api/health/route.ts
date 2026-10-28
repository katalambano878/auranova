import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await supabaseAdmin().from("StoreSettings").select("id").eq("id", "default").limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
