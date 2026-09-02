import "server-only";
import type { FoundingEmailDetails } from "./types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function displayDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: timezone,
  }).format(new Date(value));
}

export function renderFoundingWelcomeEmail(
  details: FoundingEmailDetails,
  input: { supportEmail: string; serviceTimezone: string },
) {
  const firstName = escapeHtml(details.firstName);
  const start = displayDate(details.serviceStartAt, input.serviceTimezone);
  const end = displayDate(details.serviceEndAt, input.serviceTimezone);
  const support = escapeHtml(input.supportEmail);
  const subject = "Welcome to the Cooper Fitness Founding Cohort";
  const text = [
    `Hi ${details.firstName},`,
    "Your 12-week Cooper Fitness founding membership is confirmed.",
    `Your term runs from ${start} through ${end}. We will reach out to begin onboarding, with your start expected within 14 days.`,
    "Next step: reply to this email with your preferred onboarding times, or use the onboarding link your coach sends you.",
    `Questions? Contact ${input.supportEmail}.`,
  ].join("\n\n");
  const html = `<p>Hi ${firstName},</p>
<p>Your 12-week Cooper Fitness founding membership is confirmed.</p>
<p>Your term runs from <strong>${escapeHtml(start)}</strong> through <strong>${escapeHtml(end)}</strong>. We will reach out to begin onboarding, with your start expected within 14 days.</p>
<p><strong>Next step:</strong> reply to this email with your preferred onboarding times, or use the onboarding link your coach sends you.</p>
<p>Questions? Contact <a href="mailto:${support}">${support}</a>.</p>
<p>— Cooper Fitness</p>`;
  return { subject, text, html, to: details.recipient };
}
