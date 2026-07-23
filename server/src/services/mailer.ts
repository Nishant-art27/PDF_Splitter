import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SMTP_FILE = path.resolve(__dirname, "../../config/smtp.json");

/**
 * SMTP settings live in config/smtp.json (gitignored — it contains a
 * mail password). See config/smtp.example.json. For Gmail: enable
 * 2-step verification, create an App Password, and use that here.
 *
 * Until the file exists, OTP emails are printed to the server console
 * instead, so the whole reset flow can be tried without any mail setup.
 */
interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from?: string;
}

async function readSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(SMTP_FILE, "utf8"));
    if (
      typeof parsed.host === "string" &&
      typeof parsed.port === "number" &&
      typeof parsed.user === "string" &&
      typeof parsed.pass === "string"
    ) {
      return { secure: parsed.port === 465, from: undefined, ...parsed };
    }
    return null;
  } catch {
    return null;
  }
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const config = await readSmtpConfig();
  if (!config) {
    console.warn(
      `[mail] SMTP not configured (config/smtp.json missing) — password reset code for ${to}: ${code}`
    );
    return;
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  await transporter.sendMail({
    from: config.from ?? config.user,
    to,
    subject: "Your password reset code — Legal PDF Splitter",
    text:
      `Your password reset code is: ${code}\n\n` +
      `It expires in 10 minutes.\n\n` +
      `If you did not request this, you can ignore this email — your password is unchanged.`,
  });
}
