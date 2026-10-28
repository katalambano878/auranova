import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Authentication uses Supabase server actions." }, { status: 404 });
}

export const POST = GET;
