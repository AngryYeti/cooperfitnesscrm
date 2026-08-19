import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Purchaser } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function constantTimeEqual(actual: string | null | undefined, expected: string): boolean {
  const actualDigest = createHash("sha256").update(actual ?? "", "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function hasValidBearer(request: Request, secret: string): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  return match !== null && constantTimeEqual(match[1], secret);
}

export function parsePurchaser(input: unknown): Purchaser {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid purchaser");
  }
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "name" && key !== "email")) {
    throw new Error("Invalid purchaser fields");
  }
  if (typeof value.name !== "string" || typeof value.email !== "string") {
    throw new Error("Name and email are required");
  }
  const name = value.name.trim().replace(/\s+/g, " ");
  const email = value.email.trim().toLowerCase();
  if (name.length < 1 || name.length > 100 || !EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new Error("Invalid purchaser");
  }
  return { name, email };
}

export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "Founding",
    lastName: parts.slice(1).join(" ") || "Member",
  };
}

export function genericErrorResponse(status = 503): Response {
  return Response.json({ error: "Founding checkout is temporarily unavailable" }, { status });
}
