const OPENSIGN_API_URL =
  process.env.OPENSIGN_API_URL || "https://api.opensignlabs.com/api/v1.1";

function getHeaders(): Record<string, string> {
  return {
    "x-api-token": process.env.OPENSIGN_API_TOKEN || "",
    "Content-Type": "application/json",
  };
}

async function opensignFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${OPENSIGN_API_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  });
}

export async function createDocument(
  pdfBase64: string,
  fileName: string,
  signerName: string,
  signerEmail: string,
  widgets: OpenSignWidget[],
  webhookUrl?: string
): Promise<{ documentId: string; signingUrl?: string }> {
  const body: Record<string, unknown> = {
    title: fileName,
    file: pdfBase64,
    signers: [
      {
        name: signerName,
        email: signerEmail,
        widgets,
      },
    ],
    send_email: true,
    enable_reassign: false,
  };

  if (webhookUrl) {
    body.webhook = webhookUrl;
  }

  const res = await opensignFetch("/createdocument", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenSign create document failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  return {
    documentId: data.objectId || data.documentId || data.id,
    signingUrl: data.signingUrl || data.url,
  };
}

export async function getSigningLinks(
  documentId: string
): Promise<{ name: string; email: string; url: string }[]> {
  const res = await opensignFetch(`/signinglinks/${documentId}`);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenSign get signing links failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.signers || data || [];
}

export async function getDocumentStatus(
  documentId: string
): Promise<{
  objectId: string;
  title: string;
  status: string;
  file?: string;
  signers?: { name: string; email: string; status: string }[];
}> {
  const res = await opensignFetch(`/document/${documentId}`);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenSign get document failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.results || data;
}

export async function setWebhook(webhookUrl: string): Promise<void> {
  const res = await opensignFetch("/webhook", {
    method: "POST",
    body: JSON.stringify({ url: webhookUrl }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenSign set webhook failed: ${res.status} ${err}`);
  }
}

export function isConfigured(): boolean {
  return !!process.env.OPENSIGN_API_TOKEN;
}

export interface OpenSignWidget {
  type: "signature" | "date" | "textbox" | "checkbox" | "initials" | "name" | "email";
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  options?: Record<string, unknown>;
}

export function createSignatureWidget(
  page: number,
  x: number,
  y: number
): OpenSignWidget {
  return {
    type: "signature",
    page,
    x,
    y,
    w: 150,
    h: 40,
    options: { required: true },
  };
}

export function createDateWidget(
  page: number,
  x: number,
  y: number
): OpenSignWidget {
  return {
    type: "date",
    page,
    x,
    y,
    w: 120,
    h: 20,
    options: {
      required: true,
      format: "mm-dd-yyyy",
      signing_date: true,
    },
  };
}
