import jwt from "jsonwebtoken";

const DOCUSIGN_AUTH_SERVERS: Record<string, string> = {
  demo: "account-d.docusign.net",
  production: "account.docusign.com",
};

const DOCUSIGN_API_SERVERS: Record<string, string> = {
  demo: "demo.docusign.net",
  production: "na1.docusign.net",
};

function getConfig() {
  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY!,
    userId: process.env.DOCUSIGN_USER_ID!,
    privateKey: (process.env.DOCUSIGN_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    accountId: process.env.DOCUSIGN_ACCOUNT_ID!,
    env: (process.env.DOCUSIGN_ENV || "demo") as "demo" | "production",
  };
}

async function getAccessToken(): Promise<string> {
  const config = getConfig();
  const now = Math.floor(Date.now() / 1000);

  const assertion = jwt.sign(
    {
      iss: config.integrationKey,
      sub: config.userId,
      aud: DOCUSIGN_AUTH_SERVERS[config.env],
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    },
    config.privateKey,
    { algorithm: "RS256" }
  );

  const res = await fetch(
    `https://${DOCUSIGN_AUTH_SERVERS[config.env]}/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSign auth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function dsFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const config = getConfig();
  const accessToken = await getAccessToken();
  const base = `https://${DOCUSIGN_API_SERVERS[config.env]}/restapi/v2.1/accounts/${config.accountId}`;

  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });
}

export async function createEnvelope(
  contactName: string,
  contactEmail: string,
  documents: { name: string; htmlContent: string; formId: string }[],
  webhookUrl: string
): Promise<{ envelopeId: string }> {
  const envelopeDefinition = {
    emailSubject: "Cooper Fitness - Please Complete Your Intake Forms",
    emailBlurb: `Hi ${contactName}, please complete and sign your intake forms for Cooper Fitness.`,
    documents: documents.map((doc, index) => ({
      documentBase64: Buffer.from(doc.htmlContent).toString("base64"),
      name: doc.name,
      fileExtension: "html",
      documentId: String(index + 1),
    })),
    recipients: {
      signers: [
        {
          email: contactEmail,
          name: contactName,
          recipientId: "1",
          routingOrder: "1",
          clientUserId: "cooper-fitness-client",
          tabs: {
            signHereTabs: documents.map((_, index) => ({
              documentId: String(index + 1),
              pageNumber: "1",
              xPosition: "350",
              yPosition: "700",
            })),
            dateSignedTabs: documents.map((_, index) => ({
              documentId: String(index + 1),
              pageNumber: "1",
              xPosition: "50",
              yPosition: "700",
              font: "helvetica",
              fontSize: "size10",
            })),
          },
        },
      ],
    },
    status: "sent",
    eventNotification: {
      url: webhookUrl,
      loggingEnabled: "true",
      requireAcknowledgment: "true",
      envelopeEvents: [
        { envelopeEventStatusCode: "completed" },
        { envelopeEventStatusCode: "declined" },
        { envelopeEventStatusCode: "voided" },
      ],
      recipientEvents: [{ recipientEventStatusCode: "completed" }],
    },
  };

  const res = await dsFetch("/envelopes", {
    method: "POST",
    body: JSON.stringify(envelopeDefinition),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create envelope: ${res.status} ${err}`);
  }

  const data = await res.json();
  return { envelopeId: data.envelopeId };
}

export async function createSigningUrl(
  envelopeId: string,
  contactName: string,
  contactEmail: string,
  returnUrl: string
): Promise<string> {
  const viewRequest = {
    authenticationMethod: "email",
    clientUserId: "cooper-fitness-client",
    recipientId: "1",
    returnUrl,
    userName: contactName,
    email: contactEmail,
  };

  const res = await dsFetch(`/envelopes/${envelopeId}/views/recipient`, {
    method: "POST",
    body: JSON.stringify(viewRequest),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create signing URL: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.url;
}

export async function getEnvelopeStatus(
  envelopeId: string
): Promise<{ status: string; statusDateTime: string }> {
  const res = await dsFetch(`/envelopes/${envelopeId}`);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get envelope status: ${res.status} ${err}`);
  }

  const data = await res.json();
  return { status: data.status, statusDateTime: data.statusDateTime };
}

export async function getSignedDocument(
  envelopeId: string,
  documentId: string
): Promise<Buffer> {
  const res = await dsFetch(
    `/envelopes/${envelopeId}/documents/${documentId}`,
    { headers: { Accept: "application/pdf" } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get document: ${res.status} ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function listEnvelopeDocuments(
  envelopeId: string
): Promise<{ documentId: string; name: string; type: string }[]> {
  const res = await dsFetch(`/envelopes/${envelopeId}/documents`);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list documents: ${res.status} ${err}`);
  }

  const data = await res.json();
  return (data.envelopeDocuments || []).map(
    (doc: { documentId: string; name: string; type: string }) => ({
      documentId: doc.documentId,
      name: doc.name,
      type: doc.type,
    })
  );
}

export function isDocuSignConfigured(): boolean {
  return !!(
    process.env.DOCUSIGN_INTEGRATION_KEY &&
    process.env.DOCUSIGN_USER_ID &&
    process.env.DOCUSIGN_PRIVATE_KEY &&
    process.env.DOCUSIGN_ACCOUNT_ID
  );
}
