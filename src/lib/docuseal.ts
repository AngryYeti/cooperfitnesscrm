const DOCUSEAL_API_URL =
  process.env.DOCUSEAL_API_URL || "https://api.docuseal.com";

function getHeaders(): Record<string, string> {
  return {
    "X-Auth-Token": process.env.DOCUSEAL_API_TOKEN || "",
    "Content-Type": "application/json",
  };
}

async function docusealFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${DOCUSEAL_API_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  });
}

export async function createSubmissionFromHtml(
  htmlContent: string,
  documentName: string,
  signerName: string,
  signerEmail: string,
  fields?: DocuSealField[],
  webhookUrl?: string
): Promise<{ submissionId: number; submitterId: number; embedSrc: string }> {
  const body: Record<string, unknown> = {
    name: documentName,
    documents: [
      {
        name: documentName,
        html: htmlContent,
        fields: fields || [
          {
            name: "Signature",
            type: "signature",
            required: true,
            areas: [{ x: 50, y: 700, w: 200, h: 50, page: 1 }],
          },
          {
            name: "Date",
            type: "date",
            required: true,
            areas: [{ x: 300, y: 700, w: 150, h: 30, page: 1 }],
          },
        ],
      },
    ],
    submitters: [
      {
        role: "Signer",
        name: signerName,
        email: signerEmail,
      },
    ],
    send_email: true,
  };

  if (webhookUrl) {
    body.webhook_url = webhookUrl;
  }

  const res = await docusealFetch("/submissions/html", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSeal create submission failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  const submitter = data.submitters?.[0] || {};

  return {
    submissionId: data.id,
    submitterId: submitter.id,
    embedSrc: submitter.embed_src || "",
  };
}

export async function createSubmissionFromPdf(
  pdfBase64: string,
  documentName: string,
  signerName: string,
  signerEmail: string,
  fields?: DocuSealField[],
  webhookUrl?: string
): Promise<{ submissionId: number; submitterId: number; embedSrc: string }> {
  const body: Record<string, unknown> = {
    name: documentName,
    documents: [
      {
        name: documentName,
        file: pdfBase64,
        fields: fields || [
          {
            name: "Signature",
            type: "signature",
            required: true,
            areas: [{ x: 50, y: 700, w: 200, h: 50, page: 1 }],
          },
          {
            name: "Date",
            type: "date",
            required: true,
            areas: [{ x: 300, y: 700, w: 150, h: 30, page: 1 }],
          },
        ],
      },
    ],
    submitters: [
      {
        role: "Signer",
        name: signerName,
        email: signerEmail,
      },
    ],
    send_email: true,
  };

  if (webhookUrl) {
    body.webhook_url = webhookUrl;
  }

  const res = await docusealFetch("/submissions/pdf", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSeal create PDF submission failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  const submitter = data.submitters?.[0] || {};

  return {
    submissionId: data.id,
    submitterId: submitter.id,
    embedSrc: submitter.embed_src || "",
  };
}

export async function getSubmissionStatus(
  submissionId: number
): Promise<{
  id: number;
  name: string;
  status: string;
  completedAt: string | null;
  submitters: {
    id: number;
    name: string;
    email: string;
    status: string;
    completedAt: string | null;
    embedSrc: string;
    documents: { name: string; url: string }[];
  }[];
}> {
  const res = await docusealFetch(`/submissions/${submissionId}`);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSeal get submission failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  return {
    id: data.id,
    name: data.name,
    status: data.status,
    completedAt: data.completed_at,
    submitters: (data.submitters || []).map(
      (s: {
        id: number;
        name: string;
        email: string;
        status: string;
        completed_at: string | null;
        embed_src: string;
        documents: { name: string; url: string }[];
      }) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        status: s.status,
        completedAt: s.completed_at,
        embedSrc: s.embed_src,
        documents: s.documents || [],
      })
    ),
  };
}

export async function getSubmissionDocuments(
  submissionId: number,
  merge = false
): Promise<{ name: string; url: string }[]> {
  const path = `/submissions/${submissionId}/documents${merge ? "?merge=true" : ""}`;
  const res = await docusealFetch(path);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSeal get documents failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.documents || [];
}

export function isConfigured(): boolean {
  return !!process.env.DOCUSEAL_API_TOKEN;
}

export interface DocuSealField {
  name: string;
  type: "signature" | "initials" | "date" | "text" | "number" | "checkbox" | "image";
  required?: boolean;
  areas: { x: number; y: number; w: number; h: number; page: number }[];
  default_value?: string;
}

export function createSignatureField(
  page: number,
  x: number,
  y: number
): DocuSealField {
  return {
    name: "Signature",
    type: "signature",
    required: true,
    areas: [{ x, y, w: 200, h: 50, page }],
  };
}

export function createDateField(
  page: number,
  x: number,
  y: number
): DocuSealField {
  return {
    name: "Date",
    type: "date",
    required: true,
    areas: [{ x, y, w: 150, h: 30, page }],
  };
}
