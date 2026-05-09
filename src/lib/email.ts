import nodemailer from "nodemailer";

type EmailSendResult = {
  simulated: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
};

function buildTransport() {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  return null;
}

function normalizeMailAddresses(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

export async function sendInvoiceCreatedEmail(params: {
  invoiceNumber: string;
  supplierName: string;
  managers: Array<{ email: string }>;
}) {
  const recipients = params.managers.map((m) => m.email).filter(Boolean);

  if (!recipients.length) return;

  const transport = buildTransport();

  if (!transport) {
    console.log(
      `[email:simulado] Nota ${params.invoiceNumber} do fornecedor ${params.supplierName} enviada para: ${recipients.join(", ")}`
    );
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "notificacoes@rpa-flow.local",
    to: recipients,
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
      "Se você recebeu esta mensagem, a configuração SMTP está funcionando."
    ].join("\n");

  const transport = buildTransport();

  if (!transport) {
    console.log(`[email:simulado] ${subject} -> ${params.recipient}\n${text}`);
    return { simulated: true, accepted: [params.recipient], rejected: [] };
  }

  const info = await transport.sendMail({
    from: process.env.SMTP_FROM ?? "notificacoes@rpa-flow.local",
    to: params.recipient,
    subject,
    text
  });

  return {
    simulated: false,
    messageId: info.messageId,
    accepted: normalizeMailAddresses(info.accepted),
    rejected: normalizeMailAddresses(info.rejected)
  };
}

export async function sendApprovalRequestEmail(params: {
  invoiceNumber: string;
  codigoIdentificador: string;
  supplierName: string;
  recipients: string[];
  extraMessage?: string;
}) {
  if (!params.recipients.length) {
    throw new Error("Nenhum destinatário informado para envio de aprovação.");
  }

  const transport = buildTransport();
  const subject = `Aprovação pendente NF ${params.invoiceNumber}`;
  const text = [
    `Solicitação de aprovação para a nota fiscal ${params.invoiceNumber}.`,
    `Fornecedor: ${params.supplierName}.`,
    `Código identificador: ${params.codigoIdentificador}.`,
    params.extraMessage ? `Mensagem adicional: ${params.extraMessage}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  if (!transport) {
    console.log(`[email:simulado] ${subject} -> ${params.recipients.join(", ")}\n${text}`);
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "notificacoes@rpa-flow.local",
    to: params.recipients,
    subject,
    text
  });
}
