export const authClient = {
  resetPassword: async () => ({
    error: { message: "Use the password reset link from your email in this browser, then submit a new password here." },
  }),
  twoFactor: {
    enable: async () => ({ error: { message: "Two-factor sign-in is not configured for this store." } }),
    verifyTotp: async () => ({ error: { message: "Two-factor sign-in is not configured for this store." } }),
  },
};
