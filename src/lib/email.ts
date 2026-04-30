import { Resend } from "resend";

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

export async function sendResetEmail(to: string, link: string): Promise<void> {
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping send. Reset link:",
      link
    );
    return;
  }
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your KaveLog password",
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0f1115;">
        <h2 style="margin: 0 0 16px;">Reset your KaveLog password</h2>
        <p style="margin: 0 0 16px; line-height: 1.5;">
          Click the link below to choose a new password. The link is valid for 1 hour.
        </p>
        <p style="margin: 0 0 24px;">
          <a href="${link}" style="display: inline-block; background: #0f1115; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none;">Reset password</a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
          Or paste this URL into your browser:
        </p>
        <p style="margin: 0 0 24px; font-size: 13px; word-break: break-all;">
          <a href="${link}" style="color: #2563eb;">${link}</a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
