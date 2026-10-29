"use server";

import { redirect } from "next/navigation";
import { appUrl } from "../env";
import { requirePermission } from "../session";
import { startSmsCheckout } from "../sms";

export async function buySmsPackage(formData: FormData) {
  const access = await requirePermission("settings.write");
  if (!access.ok) redirect("/admin/sms?error=You%20do%20not%20have%20permission%20to%20buy%20SMS.");
  const packageId = String(formData.get("packageId") || "").trim();
  if (!packageId) redirect("/admin/sms?error=Choose%20a%20package.");
  const result = await startSmsCheckout({
    packageId,
    email: access.session.user.email,
    successUrl: `${appUrl()}/admin/sms`,
  });
  if (!result.ok) redirect(`/admin/sms?error=${encodeURIComponent(result.error)}`);
  redirect(result.checkoutUrl);
}
