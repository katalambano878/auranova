import "dotenv/config";
import { prisma } from "../src/server/db";
import { auth } from "../src/server/auth";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Store admin";
  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD.");
    process.exit(1);
  }
  const existing = await prisma.user.findFirst({ where: { role: { not: "customer" } } });
  if (existing) {
    console.error("An administrator already exists. Refusing to create another.");
    process.exit(1);
  }
  await auth.api.signUpEmail({ body: { email, password, name } });
  await prisma.user.update({ where: { email: email.toLowerCase() }, data: { role: "super_admin", emailVerified: true } });
  console.log(`Administrator created for ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
