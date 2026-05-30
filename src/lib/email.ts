type EmailSendResult = {
  simulated: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  simulationReason?: string;
  missingEnvVars?: string[];
};

type GraphAccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

function appBaseUrl() {
  return (process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderUser: string;
};

type EnvOption = {
  key: keyof GraphConfig;
  names: string[];
};

const GRAPH_ENV_OPTIONS: EnvOption[] = [
  { key: "tenantId", names: ["MS_GRAPH_TENANT_ID", "GRAPH_TENANT_ID"] },
  { key: "clientId", names: ["MS_GRAPH_CLIENT_ID", "GRAPH_CLIENT_ID"] },
  { key: "clientSecret", names: ["MS_GRAPH_CLIENT_SECRET", "GRAPH_CLIENT_SECRET"] },
  { key: "senderUser", names: ["MS_GRAPH_SENDER_USER", "GRAPH_SENDER_USER"] }
];

function envValue(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  return undefined;
}

function graphConfig() {
  const missingEnvVars: string[] = [];
  const config = {} as Partial<GraphConfig>;

  for (const option of GRAPH_ENV_OPTIONS) {
    const value = envValue(option.names);

    if (value) {
      config[option.key] = value;
    } else {
      missingEnvVars.push(option.names.join(" ou "));
    }
  }

  if (missingEnvVars.length) {
    return { config: null, missingEnvVars };
  }

  return { config: config as GraphConfig, missingEnvVars };
}

async function getGraphAccessToken(config: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}) {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao autenticar no Microsoft Graph (${response.status}): ${errorText}`);
  }

  return (await response.json()) as GraphAccessTokenResponse;
}

async function sendMailWithGraph(params: {
  recipients: string[];
  subject: string;
  text: string;
  html?: string;
}) {
  const { config, missingEnvVars } = graphConfig();

  if (!config) {
    const simulationReason = `Microsoft Graph não configurado. Variáveis ausentes: ${missingEnvVars.join(", ")}.`;
    console.warn(`[email:config] ${simulationReason}`);
    console.log(`[email:simulado] ${params.subject} -> ${params.recipients.join(", ")}\n${params.text}`);
    return {
      simulated: true,
      simulationReason,
      missingEnvVars,
      accepted: params.recipients,
      rejected: [] as string[]
    };
  }

  const token = await getGraphAccessToken(config);

  const payload = {
    message: {
      subject: params.subject,
      body: {
        contentType: params.html ? "HTML" : "Text",
        content: params.html ?? params.text
      },
      toRecipients: params.recipients.map((address) => ({
        emailAddress: { address }
      }))
    },
    saveToSentItems: true
  };

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.senderUser)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao enviar e-mail via Microsoft Graph (${response.status}): ${errorText}`);
  }

  return { simulated: false, accepted: params.recipients, rejected: [] as string[] };
}

export async function sendInvoiceCreatedEmail(params: {
  invoiceNumber: string;
  supplierName: string;
  managers: Array<{ email: string }>;
}) {
  const recipients = ["lipemiranda159@gmail.com"];//params.managers.map((m) => m.email).filter(Boolean);

  if (!recipients.length) return;

  await sendMailWithGraph({
    recipients,
    subject: `Nova nota fiscal recebida: ${params.invoiceNumber}`,
    text: `Uma nova nota fiscal foi recebida para ${params.supplierName}. Número: ${params.invoiceNumber}.`
  });
}

export async function sendTestEmail(params: {
  recipient: string;
  subject?: string;
  message?: string;
}): Promise<EmailSendResult> {
  const subject = params.subject ?? "Teste de recebimento de e-mail";
  const text =
    params.message ??
    [
      "Este é um e-mail de teste do RPA Approval Flow.",
      "Se você recebeu esta mensagem, a configuração Microsoft Graph está funcionando."
    ].join("\n");

  return sendMailWithGraph({
    recipients: [params.recipient],
    subject,
    text
  });
}

export async function sendApprovalRequestEmail(params: {
  invoiceNumber: string;
  codigoIdentificador: string;
  supplierName: string;
  recipients: string[];
  invoiceId?: string;
  invoiceValue?: string;
  issueDate?: string;
  competenceDate?: string;
  prestadorCnpj?: string;
  extraMessage?: string;
}) {
  if (!params.recipients.length) {
    throw new Error("Nenhum destinatário informado para envio de aprovação.");
  }

  const subject = `Aprovação pendente NF ${params.invoiceNumber}`;
  const approvalUrl = params.invoiceId ? `${appBaseUrl()}/notas/${params.invoiceId}` : `${appBaseUrl()}/dashboard`;
  const text = [
    `Solicitação de aprovação para a nota fiscal ${params.invoiceNumber}.`,
    `Fornecedor: ${params.supplierName}.`,
    `Código identificador: ${params.codigoIdentificador}.`,
    params.invoiceValue ? `Valor da nota: ${params.invoiceValue}.` : "",
    params.issueDate ? `Data de emissão: ${params.issueDate}.` : "",
    params.competenceDate ? `Data de competência: ${params.competenceDate}.` : "",
    params.prestadorCnpj ? `CNPJ do prestador: ${params.prestadorCnpj}.` : "",
    params.extraMessage ? `Mensagem adicional: ${params.extraMessage}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const html = [
    `<p>Solicitação de aprovação para a nota fiscal <strong>${escapeHtml(params.invoiceNumber)}</strong>.</p>`,
    "<ul>",
    `<li><strong>Fornecedor:</strong> ${escapeHtml(params.supplierName)}</li>`,
    `<li><strong>Código identificador:</strong> ${escapeHtml(params.codigoIdentificador)}</li>`,
    params.invoiceValue ? `<li><strong>Valor da nota:</strong> ${escapeHtml(params.invoiceValue)}</li>` : "",
    params.issueDate ? `<li><strong>Data de emissão:</strong> ${escapeHtml(params.issueDate)}</li>` : "",
    params.competenceDate ? `<li><strong>Data de competência:</strong> ${escapeHtml(params.competenceDate)}</li>` : "",
    params.prestadorCnpj ? `<li><strong>CNPJ do prestador:</strong> ${escapeHtml(params.prestadorCnpj)}</li>` : "",
    "</ul>",
    params.extraMessage ? `<p><strong>Mensagem adicional:</strong> ${escapeHtml(params.extraMessage)}</p>` : "",
    `<p><a href=\"${approvalUrl}\">Abrir a nota e aprovar</a></p>`
  ]
    .filter(Boolean)
    .join("");

  await sendMailWithGraph({
    recipients: params.recipients,
    subject,
    text: `${text}\n\nAbra a nota para ver os detalhes, consultar o histórico e aprovar: ${approvalUrl}`,
    html
  });
}
