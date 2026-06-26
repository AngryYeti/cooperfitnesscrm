const encoder = new TextEncoder();

export interface IpSessionPayload {
  email: string;
  ip: string;
  expiresAt: number;
}

function getSecret(): string {
  return (
    process.env.DOCUSEAL_API_TOKEN ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "cooper-crm-fallback-secret-2026"
  ) + "-salt-ip-session";
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signPayload(payload: IpSessionPayload): Promise<string> {
  const secret = getSecret();
  const dataStr = JSON.stringify(payload);
  const dataBytes = encoder.encode(dataStr);
  const key = await getCryptoKey(secret);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, dataBytes);
  const signatureBytes = new Uint8Array(signatureBuffer);
  
  // Convert signature and data to base64 safely
  const dataB64 = btoa(unescape(encodeURIComponent(dataStr)));
  const signatureB64 = btoa(String.fromCharCode(...signatureBytes));
  return `${dataB64}.${signatureB64}`;
}

export async function verifyToken(token: string): Promise<IpSessionPayload | null> {
  try {
    const secret = getSecret();
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [dataB64, signatureB64] = parts;
    
    const dataStr = decodeURIComponent(escape(atob(dataB64)));
    const payload = JSON.parse(dataStr) as IpSessionPayload;
    
    // Verify signature
    const key = await getCryptoKey(secret);
    const dataBytes = encoder.encode(JSON.stringify(payload));
    const sigStr = atob(signatureB64);
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) {
      sigBytes[i] = sigStr.charCodeAt(i);
    }
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
    return isValid ? payload : null;
  } catch (err) {
    console.error("IP session token verification error:", err);
    return null;
  }
}

export function getClientIpFromHeaders(headers: Headers): string {
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  const xRealIp = headers.get("x-real-ip");
  if (xRealIp) return xRealIp;
  return "127.0.0.1";
}
