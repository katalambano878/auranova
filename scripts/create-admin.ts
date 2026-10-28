import "dotenv/config";
import { supabaseAdmin, throwIf } from "../src/server/db";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Store admin";
  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD.");
    process.exit(1);
  }
  const admin = supabaseAdmin();
  const { data: existing, error: existingError } = await admin.from("User").select("id").neq("role", "customer").limit(1).maybeSingle();
  throwIf(existingError);
  if (existing) {
    console.error("An administrator already exists. Refusing to create another.");
    process.exit(1);
  }
  const created = await admin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (created.error || !created.data.user) {
    console.error(created.error?.message || "Could not create administrator.");
    process.exit(1);
  }
  const row = await admin.from("User").upsert({
    id: created.data.user.id,
    name,
    email: email.toLowerCase(),
    emailVerified: true,
    role: "super_admin",
  });
  throwIf(row.error);
  console.log(`Administrator created for ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
