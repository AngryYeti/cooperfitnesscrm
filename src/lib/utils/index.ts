import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function lightenHex(hex: string, amount = 0.65): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  const mix = (c: number) => Math.round(c + (255 - c) * amount);

  const toHex = (n: number) => n.toString(16).padStart(2, "0");

  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export { getFullName } from "./getFullName";

export function getReadableTextColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#ffffff";

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0a0a0a" : "#ffffff";
}

export function normalizeSubject(subject: string): string {
  if (!subject) return "";
  // Remove common prefixes: Re:, Fw:, Fwd:, etc. (case insensitive)
  return subject.replace(/^(re|fw|fwd|forward):\s*/i, "").trim().toLowerCase();
}

export function groupCommunicationsIntoThreads<T extends { subject: string; date_received: string | Date; contact_id: string }>(
  comms: T[]
): T[][] {
  const threadsMap = new Map<string, T[]>();

  // Sort chronologically first so threads are built from oldest to newest
  const sortedComms = [...comms].sort(
    (a, b) => new Date(a.date_received).getTime() - new Date(b.date_received).getTime()
  );

  sortedComms.forEach((comm) => {
    const key = `${comm.contact_id}|${normalizeSubject(comm.subject)}`;
    if (!threadsMap.has(key)) {
      threadsMap.set(key, []);
    }
    threadsMap.get(key)!.push(comm);
  });

  // Sort threads by the date of their most recent message, descending (newest threads first)
  const threads = Array.from(threadsMap.values());
  threads.sort((a, b) => {
    const latestA = new Date(a[a.length - 1].date_received).getTime();
    const latestB = new Date(b[b.length - 1].date_received).getTime();
    return latestB - latestA;
  });

  return threads;
}
