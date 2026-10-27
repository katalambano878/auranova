import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "./db";
import { sendPasswordReset } from "./notifications";

export const auth = betterAuth({
  appName: "AuraNova",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.APP_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordReset(user.email, url);
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "customer", input: false },
      phone: { type: "string", required: false },
      banned: { type: "boolean", defaultValue: false, input: false },
    },
  },
  plugins: [twoFactor(), nextCookies()],
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  banned?: boolean;
  twoFactorEnabled?: boolean;
};
