import { Resend } from "resend";
import { nid, supabaseAdmin, throwIf } from "./db";
import { getSettings } from "./settings";
import { sendSms } from "./sms";

function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function notify(input: {
  kind: string;
  title: string;
  body: string;
  email?: { to: string; subject: string; text: string };
  sms?: { to: string; text: string };
}) {
  const settings = await getSettings();
  let emailed = false;
  let emailNote = "Email provider is not configured.";
  if (input.email && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: input.email.to,
        subject: input.email.subject,
        html: `<div style="font-family:Georgia,serif;color:#1A1814;background:#F6F3EE;padding:24px"><h1 style="font-size:22px">${escape(settings.storeName)}</h1><p>${escape(input.email.text).replaceAll("\n", "<br>")}</p></div>`,
      });
      emailed = true;
      emailNote = "Sent.";
    } catch {
      emailNote = "The email provider rejected the message.";
    }
  }
  const sms = input.sms ? await sendSms(input.sms) : null;
  const { error } = await supabaseAdmin().from("Notification").insert({
    id: nid(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    emailed,
    emailNote: input.email ? emailNote : null,
    smsSent: sms?.sent ?? false,
    smsNote: sms?.note ?? null,
  });
  throwIf(error);
  return { emailed, emailNote, smsSent: sms?.sent ?? false, smsNote: sms?.note ?? null };
}

export async function sendPasswordReset(email: string, url: string) {
  await notify({
    kind: "password_reset",
    title: "Password reset requested",
    body: `A password reset was requested for ${email}.`,
    email: {
      to: email,
      subject: "Reset your AuraNova password",
      text: `Use this link to reset your password:\n${url}\n\nIf you did not ask for this, you can ignore the message.`,
    },
  });
}

export async function sendOrderNotice(input: {
  email: string;
  phone?: string | null;
  orderNumber: string;
  totalLabel: string;
  paymentStatus: string;
}) {
  const text = `Your AuraNova order ${input.orderNumber} is recorded.\nPayment status: ${input.paymentStatus}.\nTotal: ${input.totalLabel}.\n\nWe only mark an online payment as paid after the provider confirms it.`;
  await notify({
    kind: "order",
    title: `Order ${input.orderNumber}`,
    body: `${input.orderNumber} is ${input.paymentStatus}. Total ${input.totalLabel}.`,
    email: {
      to: input.email,
      subject: `Order ${input.orderNumber}`,
      text,
    },
    sms: input.phone ? { to: input.phone, text: `AuraNova order ${input.orderNumber}: ${input.paymentStatus}. Total ${input.totalLabel}.` } : undefined,
  });
}
