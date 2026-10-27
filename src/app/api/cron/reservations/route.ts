import { NextResponse } from "next/server";
import { raiseLowStockAlerts, releaseExpiredReservations } from "@/server/reservations";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (!secret || header !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const released = await releaseExpiredReservations();
  const lowStock = await raiseLowStockAlerts();
  return NextResponse.json({ ok: true, released, lowStock });
}
