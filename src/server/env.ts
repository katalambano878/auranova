import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  CRON_SECRET: z.string().min(16),
});

export function assertServerEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid server environment: ${missing}`);
  }
}
