import nodemailer, { type Transporter } from "nodemailer";

export type EmailAddress = string | { name?: string; address: string };

export interface SendEmailOptions {
  to: EmailAddress | EmailAddress[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: EmailAddress;
  cc?: EmailAddress | EmailAddress[];
  bcc?: EmailAddress | EmailAddress[];
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  error?: string;
  code?: string;
}

export class EmailError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EmailError";
    this.code = code;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export function getEmailConfig() {
  const host = process.env.ZOHO_SMTP_HOST || "smtp.zohocloud.ca";
  const port = Number(process.env.ZOHO_SMTP_PORT || 465);
  const secure =
    String(process.env.ZOHO_SMTP_SECURE ?? "true").toLowerCase() !== "false";
  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || user;

  return { host, port, secure, user, pass, from };
}

export function isEmailConfigured(): boolean {
  const { user, pass } = getEmailConfig();
  return Boolean(user && pass);
}

let cachedTransport: Transporter | null | undefined;
let cachedConfigKey: string | null = null;

function getTransport(): Transporter | null {
  const cfg = getEmailConfig();
  if (!cfg.user || !cfg.pass) return null;

  const key = `${cfg.host}|${cfg.port}|${cfg.secure}|${cfg.user}|${cfg.pass}`;
  if (cachedTransport && cachedConfigKey === key) return cachedTransport;

  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    tls: { rejectUnauthorized: true },
  });
  cachedConfigKey = key;
  return cachedTransport;
}

function normalizeAddress(value: EmailAddress): string {
  if (typeof value === "string") return value;
  if (value.name) return `"${value.name}" <${value.address}>`;
  return value.address;
}

function validateAddresses(
  field: string,
  value: EmailAddress | EmailAddress[] | undefined
): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const errors: string[] = [];
  for (const item of list) {
    const address = typeof item === "string" ? item : item.address;
    if (!isValidEmail(address)) {
      errors.push(`${field}: invalid address "${address}"`);
    }
  }
  return errors;
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const cfg = getEmailConfig();

  if (!cfg.user || !cfg.pass) {
    return {
      ok: false,
      error: "Zoho SMTP is not configured. Set ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD in environment variables.",
      code: "NOT_CONFIGURED",
    };
  }

  if (!cfg.from) {
    return {
      ok: false,
      error: "EMAIL_FROM is not set. Set EMAIL_FROM (or ZOHO_SMTP_USER) in environment variables.",
      code: "NO_FROM",
    };
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  if (recipients.length === 0) {
    return { ok: false, error: "No recipient address provided", code: "NO_RECIPIENT" };
  }

  const validationErrors = [
    ...validateAddresses("to", options.to),
    ...validateAddresses("cc", options.cc),
    ...validateAddresses("bcc", options.bcc),
  ];
  if (validationErrors.length > 0) {
    return {
      ok: false,
      error: validationErrors.join("; "),
      code: "INVALID_ADDRESS",
    };
  }

  const transport = getTransport();
  if (!transport) {
    return { ok: false, error: "Failed to create SMTP transport", code: "TRANSPORT" };
  }

  try {
    const info = await transport.sendMail({
      from: cfg.from,
      to: recipients.map(normalizeAddress),
      subject: options.subject,
      html: options.html,
      text: options.text ?? options.html.replace(/<[^>]+>/g, ""),
      ...(options.replyTo ? { replyTo: normalizeAddress(options.replyTo) } : {}),
      ...(options.cc ? { cc: (Array.isArray(options.cc) ? options.cc : [options.cc]).map(normalizeAddress) } : {}),
      ...(options.bcc ? { bcc: (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).map(normalizeAddress) } : {}),
      ...(options.attachments ? { attachments: options.attachments } : {}),
    });

    return {
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted as string[] | undefined,
      rejected: info.rejected as string[] | undefined,
    };
  } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    const errorObj = err as Record<string, unknown> | null;
    const code = typeof errorObj?.code === "string" ? errorObj.code : "SEND_FAILED";
    const message = err instanceof Error ? err.message : String(errorObj?.message || "Failed to send email");

    if (code === "EAUTH" || code === "EENVELOPE") {
      return {
        ok: false,
        error: `Zoho authentication failed: ${message}. Check ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD.`,
        code,
      };
    }
    if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ECONNREFUSED") {
      return {
        ok: false,
        error: `Cannot reach Zoho SMTP (${cfg.host}:${cfg.port}): ${message}`,
        code,
      };
    }
    if (code === "EHOSTUNREACH" || code === "ENOTFOUND" || code === "ENETUNREACH") {
      return {
        ok: false,
        error: `Network unreachable to Zoho SMTP: ${message}`,
        code,
      };
    }

    return { ok: false, error: message, code };
  }
}

export async function verifyEmailConnection(): Promise<{
  ok: boolean;
  host?: string;
  port?: number;
  user?: string;
  error?: string;
  code?: string;
}> {
  const cfg = getEmailConfig();
  if (!cfg.user || !cfg.pass) {
    return {
      ok: false,
      error: "Zoho SMTP credentials not set (ZOHO_SMTP_USER / ZOHO_SMTP_PASSWORD)",
      code: "NOT_CONFIGURED",
    };
  }

  const transport = getTransport();
  if (!transport) {
    return { ok: false, error: "Failed to create transport", code: "TRANSPORT" };
  }

  try {
    await transport.verify();
    return { ok: true, host: cfg.host, port: cfg.port, user: cfg.user };
  } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    const errorObj = err as Record<string, unknown> | null;
    return {
      ok: false,
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      error: err instanceof Error ? err.message : String(errorObj?.message || "SMTP verification failed"),
      code: typeof errorObj?.code === "string" ? errorObj.code : "VERIFY_FAILED",
    };
  }
}

export const BRAND = {
  name: "Cooper Fitness",
  replyTo: process.env.EMAIL_REPLY_TO || "evan@cooper.fitness",
} as const;
