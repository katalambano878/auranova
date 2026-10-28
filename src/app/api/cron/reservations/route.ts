import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { raiseLowStockAlerts, releaseExpiredReservations } from "@/server/reservations";

export async function POST(request: Request) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const header = request.headers.get("authorization") || "";
  if (!secret || header !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const released = await releaseExpiredReservations();
  const lowStock = await raiseLowStockAlerts();
  return NextResponse.json({ ok: true, released, lowStock });
}
