import { prisma } from "./db";

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!bucket || bucket.resetAt <= now) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) },
      update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
    });
    return { ok: true as const };
  }
  if (bucket.count >= limit) return { ok: false as const };
  await prisma.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
  return { ok: true as const };
}
