import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createInvoiceSchema } from "@/lib/validations";
import { sendInvoiceAdminReviewEmail, sendInvoiceCreatedEmail } from "@/lib/email";
import { parseNFSeXml } from "@/lib/nfse-parser";
import { evaluateInvoiceAdminReview, extractDescriptionTotal, INVOICE_ADMIN_REVIEW_REASONS } from "@/lib/invoice-admin-review";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { startConfiguredWorkflow } from "@/lib/workflow/start";
import { processWorkflowNotifications } from "@/lib/workflow/notifications";
import { uploadXmlToOneDrive } from "@/lib/onedrive";
import { parseFiscalXml } from "@/lib/fiscal-document-parser";
import { ingestEnabled } from "@/lib/workflow/fiscal-eligibility";
import { FiscalIngestError, holdFiscalInvoice, lockFiscalKeys, receiveFiscalDocument, xmlContentHash, type IngestActor } from "@/lib/fiscal-document-ingest";
import { legacyProcessingUnresolved } from "@/lib/fiscal-document-rules";

type ManualInvoiceData = {
  numeroNota: string;
  codigoIdentificador: string;
  nDfse?: string;
  localEmissao?: string;
  localPrestacao?: string;
  municipioIncidencia?: string;
  itemTributacaoNac?: string;
  itemTributacaoMun?: string;
  nbsDescricao?: string;
  descricaoServico?: string;
  dataProcessamento?: string;
  dataEmissao?: string;
  dataCompetencia?: string;
  prestadorCnpj?: string;
  prestadorNome?: string;
  prestadorEmail?: string;
  tomadorCnpj?: string;
  tomadorNome?: string;
  tomadorEmail?: string;
  valorBaseCalculo?: number;
  valorIssqn?: number;
  valorTotalRetido?: number;
  valorLiquido?: number;
  valorServico?: number;
  aliquota?: number;
};

function shouldIncludeXml(request: NextRequest) {
  return request.nextUrl.searchParams.get("includeXml") === "true";
}

function serializeInvoiceResponse<T extends { xmlOriginal?: string | null }>(invoice: T, includeXml: boolean) {
  if (includeXml) return invoice;
  const { xmlOriginal, ...rest } = invoice;
  return rest;
}

function validateInvoiceIngestApiKey(request: NextRequest) {
  const apiKey = process.env.INVOICE_INGEST_API_KEY;
  const keyFromRequest = request.headers.get("x-api-key");
  const digest = (key: string) => createHash("sha256").update(key).digest();
  if (!apiKey?.trim() || !keyFromRequest || !timingSafeEqual(digest(apiKey), digest(keyFromRequest))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return null;
}

function isInvoiceCreatedEmailDisabled() {
  const value = process.env.DISABLE_INVOICE_CREATED_EMAIL?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes" || value === "sim" || value === "on";
}

export type CreateInvoiceOptions = {
  allowFiscalIntegration?: boolean;
  initialStatus?: InvoiceStatus;
  sendCreatedEmail?: boolean;
  auditDescription?: string;
  defaultRejectionObservation?: string;
};

export async function createInvoiceFromRequest(request: NextRequest, options: CreateInvoiceOptions = {}) {
  const manager = await getSessionManager();
  if (!manager) {
    const unauthorized = validateInvoiceIngestApiKey(request);
    if (unauthorized) return unauthorized;
  }

  if (manager && !["FORNECEDOR", "ADMIN"].includes(manager.role)) {
    return NextResponse.json({ error: "Somente usuários com perfil FORNECEDOR ou ADMIN podem lançar notas." }, { status: 403 });
  }
  const includeXml = shouldIncludeXml(request);

  const contentType = request.headers.get("content-type") ?? "";
  const maxXmlBytes = 5 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > maxXmlBytes + 128 * 1024) {
    return NextResponse.json({ error: "O corpo excede o limite de recebimento." }, { status: 413 });
  }
  let payload: Record<string, unknown> = {};

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const xmlFile = formData.get("xmlFile");
      payload = Object.fromEntries(formData.entries());
      if (xmlFile && typeof xmlFile !== "string") {
        if (xmlFile.size > maxXmlBytes) return NextResponse.json({ error: "XML excede 5 MiB." }, { status: 413 });
        payload.xml = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await xmlFile.arrayBuffer());
      }
    } else {
      payload = await request.json();
    }
  } catch {
    return NextResponse.json({ error: "JSON ou arquivo XML inválido." }, { status: 400 });
  }
  if (payload && typeof payload === "object" && !payload.xml && payload.documentType && payload.documentType !== "NFSE") {
    return NextResponse.json({ error: "O cadastro manual aceita somente NFS-e." }, { status: 400 });
  }

  if (typeof payload?.xml === "string" && Buffer.byteLength(payload.xml, "utf8") > maxXmlBytes) {
    return NextResponse.json({ error: "XML excede 5 MiB." }, { status: 413 });
  }
  const parsed = createInvoiceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let nfseData: ReturnType<typeof parseNFSeXml> | ManualInvoiceData;
  const actor: IngestActor = manager ? { id: manager.id, nome: manager.nome, email: manager.email, role: manager.role, allowedSupplierIds: getAllowedSupplierIds(manager) } : null;

  try {
    const xml = parsed.data.xml;
    const document = xml ? parseFiscalXml(xml) : null;
    if (document && document.documentType !== "NFSE" && xml) {
      if (!options.allowFiscalIntegration) return NextResponse.json({ error: "Esta operação aceita somente NFS-e." }, { status: 400 });
      if (!ingestEnabled(document.documentType)) return NextResponse.json({ error: "Recebimento deste tipo suspenso." }, { status: 503 });
      try {
        const result = await prisma.$transaction(tx => receiveFiscalDocument(tx, document, xml, actor, parsed.data.fornecedorId));
        if (result.workflow === "STARTED") {
          try { await processWorkflowNotifications(); } catch { /* A tarefa persistida pode ser notificada pelo processador. */ }
        }
        return NextResponse.json(includeXml && result.status < 300 ? { ...result.body, xmlOriginal: xml } : result.body, { status: result.status });
      } catch (error) {
        if (error instanceof FiscalIngestError) return NextResponse.json({ error: error.message }, { status: error.status });
        return NextResponse.json({ error: "Não foi possível concluir o recebimento do documento." }, { status: 500 });
      }
    }
    nfseData = document?.documentType === "NFSE"
      ? document.nfse
      : {
          numeroNota: parsed.data.numeroNota!,
          codigoIdentificador: parsed.data.codigoIdentificador ?? `${Date.now()}`.padEnd(44, "0"),
          nDfse: parsed.data.nDfse,
          localEmissao: parsed.data.localEmissao,
          localPrestacao: parsed.data.localPrestacao,
          municipioIncidencia: parsed.data.municipioIncidencia,
          itemTributacaoNac: parsed.data.itemTributacaoNac,
          itemTributacaoMun: parsed.data.itemTributacaoMun,
          nbsDescricao: parsed.data.nbsDescricao,
          descricaoServico: parsed.data.descricaoServico,
          dataProcessamento: parsed.data.dataProcessamento,
          dataEmissao: parsed.data.dataEmissao,
          dataCompetencia: parsed.data.dataCompetencia,
          prestadorCnpj: parsed.data.prestadorCnpj,
          prestadorNome: parsed.data.prestadorNome,
          prestadorEmail: parsed.data.prestadorEmail,
          tomadorCnpj: parsed.data.tomadorCnpj,
          tomadorNome: parsed.data.tomadorNome,
          tomadorEmail: parsed.data.tomadorEmail,
          valorBaseCalculo: parsed.data.valorBaseCalculo,
          valorIssqn: parsed.data.valorIssqn,
          valorTotalRetido: parsed.data.valorTotalRetido,
          valorLiquido: parsed.data.valorLiquido,
          valorServico: parsed.data.valorServico,
          aliquota: parsed.data.aliquota
        };
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao ler XML fiscal", details: (error as Error).message },
      { status: 400 }
    );
  }

  const allowedSupplierIds = manager ? getAllowedSupplierIds(manager) : [];

  if (manager && parsed.data.fornecedorId) {
    const canAccessSupplier = manager.role === "ADMIN" || allowedSupplierIds.includes(parsed.data.fornecedorId);
    if (!canAccessSupplier) {
      return NextResponse.json(
        { error: "Acesso negado para lançar nota neste fornecedor." },
        { status: 403 }
      );
    }
  }

  const nfseKey = String(nfseData.codigoIdentificador);

  const initialStatus = options.initialStatus ?? InvoiceStatus.AGUARDANDO_APROVACAO;
  const isRejectedOnCreate = initialStatus === InvoiceStatus.RECUSADO;
  const validationReason = parsed.data.observacaoValidacao?.trim() || parsed.data.reason?.trim() || options.defaultRejectionObservation?.trim() || null;

  if (isRejectedOnCreate && !validationReason) {
    return NextResponse.json(
      { error: "Informe a observação para recusar a nota." },
      { status: 400 }
    );
  }

  const descricaoServico = "descricaoServico" in nfseData ? nfseData.descricaoServico : parsed.data.descricaoServico;
  const reviewDecision = evaluateInvoiceAdminReview({
    valorServico: "valorServico" in nfseData ? nfseData.valorServico : undefined,
    valorLiquido: "valorLiquido" in nfseData ? nfseData.valorLiquido : undefined,
    valorBaseCalculo: "valorBaseCalculo" in nfseData ? nfseData.valorBaseCalculo : undefined,
    dataEmissao: "dataEmissao" in nfseData ? nfseData.dataEmissao : undefined
  });
  const valueSuggestion = reviewDecision.reasons.includes(INVOICE_ADMIN_REVIEW_REASONS.ZERO_VALUE)
    ? extractDescriptionTotal(descricaoServico)
    : { value: null, evidence: null, ambiguous: false };
  const reviewConfig = reviewDecision.requiresAdminReview
    ? await prisma.invoiceAdminReviewConfig.findUnique({ where: { id: "default" } })
    : null;
  const missingReviewEmail = reviewDecision.requiresAdminReview && (!reviewConfig?.ativo || !reviewConfig.email);

  const creation = await prisma.$transaction(async (tx) => {
    const issuer = nfseData.prestadorCnpj;
    await lockFiscalKeys(tx, [nfseKey, ...(issuer ? ["supplier:" + issuer] : [])]);
    const existing = await tx.invoice.findUnique({ where: { codigoIdentificador: nfseKey }, select: {
      id: true, documentType: true, fornecedorId: true, xmlOriginal: true
    } });
    if (existing) {
      // Keep HTTP 409 for legacy consumers, even for a byte-identical re-send.
      if (existing.documentType === "NFSE" && parsed.data.xml && existing.xmlOriginal !== parsed.data.xml
        && (!actor || actor.role === "ADMIN" || (existing.fornecedorId && actor.allowedSupplierIds.includes(existing.fornecedorId)))) {
        await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${existing.id} FOR UPDATE`;
        const current = await tx.invoice.findUniqueOrThrow({
          where: { id: existing.id }, select: { status: true, statusProcessamento: true }
        });
        const contentHash = xmlContentHash(parsed.data.xml);
        const added = await tx.fiscalDocumentVersion.createMany({ data: {
          invoiceId: existing.id, contentHash, xml: parsed.data.xml, parserVersion: "nfse-1", state: "CANDIDATE"
        }, skipDuplicates: true });
        const version = await tx.fiscalDocumentVersion.findUnique({ where: { invoiceId_contentHash: { invoiceId: existing.id, contentHash } }, select: { id: true } });
        if (added.count) {
          if (legacyProcessingUnresolved(current)) {
            await tx.noteAuditLog.create({ data: {
              invoiceId: existing.id, actorId: actor?.id, actionType: "FISCAL_CANDIDATE_DEFERRED",
              actionDescription: "XML candidato recebido durante processamento externo",
              afterData: { versionId: version?.id ?? null }
            } });
          } else {
            await holdFiscalInvoice(tx, existing.id, "CONFLITO_XML", actor);
          }
        }
        return { error: "XML divergente da versão vigente.", status: 409, invoiceId: existing.id, versionId: version?.id } as const;
      }
      return { error: "Já existe nota com esse código identificador (44 a 50 dígitos).", status: 409 } as const;
    }
    const contacts = { managerSuppliers: { include: { manager: { select: { id: true, nome: true, email: true } } } },
      notificationConfig: { select: { emailsExtras: true } } } as const;
    let supplier = parsed.data.fornecedorId ? await tx.supplier.findUnique({ where: { id: parsed.data.fornecedorId }, include: contacts })
      : issuer ? await tx.supplier.findUnique({ where: { cnpj: issuer }, include: contacts }) : null;
    if (parsed.data.fornecedorId && !supplier) return { error: "Fornecedor não encontrado.", status: 400 } as const;
    if (actor?.role === "FORNECEDOR" && (!supplier || !actor.allowedSupplierIds.includes(supplier.id))) {
      return { error: "Acesso negado ao fornecedor.", status: 403 } as const;
    }
    if (!supplier) supplier = await tx.supplier.create({
      data: { nome: nfseData.prestadorNome || "Fornecedor importado via NFSe", cnpj: issuer }, include: contacts
    });
    const company = nfseData.tomadorCnpj ? await tx.company.findFirst({ where: { cnpj: nfseData.tomadorCnpj, active: true }, select: { id: true } }) : null;
    const invoice = await tx.invoice.create({
      data: {
        numeroNota: String(nfseData.numeroNota),
        documentType: "NFSE",
        codigoIdentificador: String(nfseData.codigoIdentificador),
        fornecedorId: supplier.id, companyId: company?.id,
        nDfse: "nDfse" in nfseData ? nfseData.nDfse : undefined,
        xmlOriginal: parsed.data.xml,
        referenceValue: nfseData.valorServico ?? nfseData.valorLiquido ?? nfseData.valorBaseCalculo,
        ...(parsed.data.xml ? { documentVersions: { create: { xml: parsed.data.xml, contentHash: xmlContentHash(parsed.data.xml), parserVersion: "nfse-1", state: "CURRENT" } } } : {}),
        localEmissao: "localEmissao" in nfseData ? nfseData.localEmissao : undefined,
        localPrestacao: "localPrestacao" in nfseData ? nfseData.localPrestacao : undefined,
        municipioIncidencia: "municipioIncidencia" in nfseData ? nfseData.municipioIncidencia : undefined,
        itemTributacaoNac: "itemTributacaoNac" in nfseData ? nfseData.itemTributacaoNac : undefined,
        itemTributacaoMun: "itemTributacaoMun" in nfseData ? nfseData.itemTributacaoMun : undefined,
        nbsDescricao: "nbsDescricao" in nfseData ? nfseData.nbsDescricao : undefined,
        descricaoServico: descricaoServico || undefined,
        dataProcessamento:
          "dataProcessamento" in nfseData && nfseData.dataProcessamento
            ? new Date(nfseData.dataProcessamento)
            : undefined,
        dataEmissao:
          "dataEmissao" in nfseData && nfseData.dataEmissao ? new Date(nfseData.dataEmissao) : undefined,
        dataCompetencia:
          "dataCompetencia" in nfseData && nfseData.dataCompetencia
            ? new Date(nfseData.dataCompetencia)
            : undefined,
        prestadorCnpj: "prestadorCnpj" in nfseData ? nfseData.prestadorCnpj : undefined,
        prestadorNome: "prestadorNome" in nfseData ? nfseData.prestadorNome : undefined,
        prestadorEmail: "prestadorEmail" in nfseData ? nfseData.prestadorEmail : undefined,
        tomadorCnpj: "tomadorCnpj" in nfseData ? nfseData.tomadorCnpj : undefined,
        tomadorNome: "tomadorNome" in nfseData ? nfseData.tomadorNome : undefined,
        tomadorEmail: "tomadorEmail" in nfseData ? nfseData.tomadorEmail : undefined,
        valorBaseCalculo: "valorBaseCalculo" in nfseData ? nfseData.valorBaseCalculo : undefined,
        valorIssqn: "valorIssqn" in nfseData ? nfseData.valorIssqn : undefined,
        valorTotalRetido: "valorTotalRetido" in nfseData ? nfseData.valorTotalRetido : undefined,
        valorLiquido: "valorLiquido" in nfseData ? nfseData.valorLiquido : undefined,
        valorServico: "valorServico" in nfseData ? nfseData.valorServico : undefined,
        aliquota: "aliquota" in nfseData ? nfseData.aliquota : undefined,
        status: initialStatus,
        processada: isRejectedOnCreate ? true : undefined,
        statusProcessamento: isRejectedOnCreate ? "ERRO" : undefined,
        responsavelValidacao: isRejectedOnCreate ? (manager?.nome ?? "Integração Delphi") : undefined,
        dataValidacao: isRejectedOnCreate ? new Date() : undefined,
        observacaoValidacao: isRejectedOnCreate ? validationReason : undefined,
        criadoPorId: manager?.id,
        ...(reviewDecision.requiresAdminReview ? {
          adminReview: {
            create: {
              motivos: reviewDecision.reasons,
              mesReferencia: reviewDecision.referenceMonth,
              valorSugerido: valueSuggestion.value,
              origemValor: valueSuggestion.value ? "descricaoServico:Valor total" : null,
              evidenciaValor: valueSuggestion.evidence,
              emailDestinatario: reviewConfig?.email ?? null,
              erroEmail: missingReviewEmail ? "Configure o e-mail administrativo para receber avisos de revisão." : null
            }
          }
        } : {}),
        ...("documentDetail" in nfseData
          ? {
              documentDetail: {
                create: nfseData.documentDetail
              }
            }
          : {})
      },
      include: {
        fornecedor: true
      }
    });

    await tx.noteStatusHistory.create({ data: { invoiceId: invoice.id, actorId: manager?.id, actorName: manager?.nome, actorEmail: manager?.email, newStatus: invoice.status, reason: validationReason } });
    await tx.noteAuditLog.create({ data: { invoiceId: invoice.id, actorId: manager?.id, actorName: manager?.nome, actorEmail: manager?.email, actionType: "NOTE_CREATED", actionDescription: options.auditDescription ?? "Nota criada e encaminhada para aprovação", newStatus: invoice.status, reason: validationReason, afterData: JSON.parse(JSON.stringify(serializeInvoiceResponse(invoice, false))) } });
    const workflow = !reviewDecision.requiresAdminReview && !isRejectedOnCreate && initialStatus === InvoiceStatus.AGUARDANDO_APROVACAO
      ? await startConfiguredWorkflow(tx, invoice.id, { id: manager?.id, name: manager?.nome, email: manager?.email }, invoice.createdAt, true)
      : "LEGACY" as const;
    return { invoice, workflow, supplier };
  });
  if ("error" in creation) return NextResponse.json({ error: creation.error, invoiceId: creation.invoiceId, versionId: creation.versionId }, { status: creation.status });
  const { invoice, workflow, supplier } = creation;
  if (parsed.data.xml) {
    try {
      const url = await uploadXmlToOneDrive({ fileName: nfseKey + ".xml", xmlContent: parsed.data.xml });
      if (url) await prisma.noteAuditLog.create({ data: { invoiceId: invoice.id, actionType: "XML_ARCHIVED", actionDescription: "XML enviado ao OneDrive" } });
    } catch {
      await prisma.noteAuditLog.create({ data: { invoiceId: invoice.id, actionType: "XML_ARCHIVE_FAILED", actionDescription: "Falha ao arquivar a cópia do XML no OneDrive" } });
    }
  }

  if (reviewDecision.requiresAdminReview) {
    const review = await prisma.invoiceAdminReview.findUnique({ where: { invoiceId: invoice.id } });
    if (review && reviewConfig?.ativo && reviewConfig.email) {
      try {
        await sendInvoiceAdminReviewEmail({
          recipient: reviewConfig.email,
          invoiceNumber: invoice.numeroNota,
          supplierName: supplier.nome,
          invoiceId: invoice.id,
          reasons: reviewDecision.reasons,
          issueDate: invoice.dataEmissao?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) ?? null,
          suggestedValue: valueSuggestion.value,
          evidence: valueSuggestion.evidence
        });
        await prisma.invoiceAdminReview.update({
          where: { id: review.id },
          data: { tentativasEmail: { increment: 1 }, emailEnviadoEm: new Date(), erroEmail: null }
        });
      } catch (error) {
        await prisma.invoiceAdminReview.update({
          where: { id: review.id },
          data: { tentativasEmail: { increment: 1 }, erroEmail: error instanceof Error ? error.message : String(error) }
        });
      }
    }
  } else if (workflow === "STARTED") {
    try { await processWorkflowNotifications(); } catch { /* A atribuição permanece na fila. */ }
  } else if (workflow === "LEGACY" && (options.sendCreatedEmail ?? true) && !isInvoiceCreatedEmailDisabled()) {
    try {
      await sendInvoiceCreatedEmail({
        invoiceNumber: invoice.numeroNota,
        supplierName: supplier.nome,
        invoiceId: invoice.id,
        managers: [
          ...supplier.managerSuppliers.map((ms) => ({ email: ms.manager.email })),
          ...((supplier.notificationConfig?.emailsExtras ?? []).map((email) => ({ email })))
        ]
      });
    } catch (error) {
      console.error("[notas:create] Falha ao enviar e-mail de nova nota", {
        invoiceId: invoice.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return NextResponse.json(serializeInvoiceResponse(invoice, includeXml), { status: 201 });
}
