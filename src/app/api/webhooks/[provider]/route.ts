import { NextResponse } from "next/server";
import { acceptWebhook } from "@/server/payments/settle";
import type { ProviderName } from "@/server/payments/adapters";

const providers = new Set<ProviderName>(["moolre", "flutterwave", "paystack", "hubtel"]);

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!providers.has(provider as ProviderName)) return NextResponse.json({ ok: false }, { status: 404 });
  const rawBody = await request.text();
  const result = await acceptWebhook(provider as ProviderName, rawBody, request.headers);
  return new NextResponse(null, { status: result.status });
}
