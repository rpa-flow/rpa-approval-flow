type EmailSendResult = {
  simulated: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
};

type GraphAccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

function graphConfig() {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const senderUser = process.env.MS_GRAPH_SENDER_USER;

  if (!tenantId || !clientId || !clientSecret || !senderUser) {
    return null;
  }

  return { tenantId, clientId, clientSecret, senderUser };
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
  const config = graphConfig();

  if (!config) {
    console.log(`[email:simulado] ${params.subject} -> ${params.recipients.join(", ")}\n${params.text}`);
    return { simulated: true, accepted: params.recipients, rejected: [] as string[] };
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
  const recipients = params.managers.map((m) => m.email).filter(Boolean);

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
  const loginUrl = `${(process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/login`;
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
    `<p>Solicitação de aprovação para a nota fiscal <strong>${params.invoiceNumber}</strong>.</p>`,
    "<ul>",
    `<li><strong>Fornecedor:</strong> ${params.supplierName}</li>`,
    `<li><strong>Código identificador:</strong> ${params.codigoIdentificador}</li>`,
    params.invoiceValue ? `<li><strong>Valor da nota:</strong> ${params.invoiceValue}</li>` : "",
    params.issueDate ? `<li><strong>Data de emissão:</strong> ${params.issueDate}</li>` : "",
    params.competenceDate ? `<li><strong>Data de competência:</strong> ${params.competenceDate}</li>` : "",
    params.prestadorCnpj ? `<li><strong>CNPJ do prestador:</strong> ${params.prestadorCnpj}</li>` : "",
    "</ul>",
    params.extraMessage ? `<p><strong>Mensagem adicional:</strong> ${params.extraMessage}</p>` : "",
    `<p><a href=\"${loginUrl}\">Acessar o sistema para aprovar a nota</a></p>`
  ]
    .filter(Boolean)
    .join("");

  await sendMailWithGraph({
    recipients: params.recipients,
    subject,
    text: `${text}\n\nAcesse o sistema para aprovar a nota: ${loginUrl}`,
    html
  });
}
