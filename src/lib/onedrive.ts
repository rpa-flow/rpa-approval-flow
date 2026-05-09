const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

type OneDriveConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  driveId: string;
  targetFolder: string;
};

function getConfig(): OneDriveConfig | null {
  const tenantId = process.env.ONEDRIVE_TENANT_ID;
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
  const driveId = process.env.ONEDRIVE_DRIVE_ID;
  const targetFolder = process.env.ONEDRIVE_TARGET_FOLDER ?? "notas-fiscais";

  if (!tenantId || !clientId || !clientSecret || !driveId) return null;

  return { tenantId, clientId, clientSecret, driveId, targetFolder };
}

async function getAccessToken(config: OneDriveConfig) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });

  const tokenResponse = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!tokenResponse.ok) {
    throw new Error(`Falha ao autenticar no Microsoft Graph (${tokenResponse.status})`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

export async function uploadXmlToOneDrive(params: {
  fileName: string;
  xmlContent: string;
}) {
  const config = getConfig();
  if (!config) return null;

  const token = await getAccessToken(config);
  const sanitizedFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${config.targetFolder}/${sanitizedFileName}`;

  const uploadResponse = await fetch(
    `${GRAPH_BASE_URL}/drives/${config.driveId}/root:/${encodeURIComponent(path).replace(/%2F/g, "/") }:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/xml"
      },
      body: params.xmlContent
    }
  );

  if (!uploadResponse.ok) {
    throw new Error(`Falha ao enviar XML para o OneDrive (${uploadResponse.status})`);
  }

  const uploaded = (await uploadResponse.json()) as { webUrl?: string };
  return uploaded.webUrl ?? null;
}
