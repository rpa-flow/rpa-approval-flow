import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { evaluateInvoiceAdminReview } from "./invoice-admin-review";
import type { ParsedGoodsOrFreight } from "./fiscal-document-parser";
import { startConfiguredWorkflow } from "./workflow/start";
import { effectiveCteSubstitution, fiscalIssueDate } from "./fiscal-document-rules";

type Tx = Prisma.TransactionClient;
export type IngestActor = { id: string; nome: string; email: string; role: string; allowedSupplierIds: string[] } | null;
export class FiscalIngestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export const xmlContentHash = (xml: string) => createHash("sha256").update(xml, "utf8").digest("hex");
export const fiscalSituation = {
  AUTHORIZED: "AUTORIZADA", CANCELLED: "CANCELADA", NOT_AUTHORIZED: "NAO_AUTORIZADA", UNKNOWN: "DESCONHECIDA"
} as const;
const cnpj = (value: string | null) => value && /^\d{14}$/.test(value) ? value : null;
const summary = {
  id: true, codigoIdentificador: true, numeroNota: true, documentType: true, companyId: true,
  fornecedorId: true, fiscalStatus: true, referenceValue: true
} satisfies Prisma.InvoiceSelect;

/** Serialize a source and its targets in the same order, including absent targets. */
export async function lockFiscalKeys(tx: Tx, keys: string[]) {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}

export async function holdFiscalInvoice(tx: Tx, invoiceId: string, reason: string, actor: { id: string } | null) {
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
  const existing = await tx.invoiceAdminReview.findUnique({ where: { invoiceId } });
  if (existing?.status === "PENDENTE" && existing.motivos.includes(reason)) return;
  const reasons = [...new Set([...(existing?.motivos ?? []), reason])];
  await tx.invoiceAdminReview.upsert({
    where: { invoiceId },
    create: { invoiceId, motivos: reasons, mesReferencia: evaluateInvoiceAdminReview({}).referenceMonth },
    update: { motivos: reasons, status: existing?.status === "IGNORADA" ? "IGNORADA" : "PENDENTE", versao: { increment: 1 } }
  });
  await tx.invoiceWorkflow.updateMany({
    where: { currentInvoiceId: invoiceId, status: "ACTIVE" },
    data: { status: "BLOCKED", revision: { increment: 1 } }
  });
  await tx.noteAuditLog.create({ data: {
    invoiceId, actorId: actor?.id, actionType: "FISCAL_REVIEW_REQUIRED", reason,
    actionDescription: "Documento fiscal retido para revisão administrativa"
  } });
}

export async function hasPendingXmlCandidate(tx: Tx, invoiceId: string) {
  return Boolean(await tx.fiscalDocumentVersion.findFirst({
    where: { invoiceId, state: "CANDIDATE" },
    select: { id: true }
  }));
}

function versionData(doc: ParsedGoodsOrFreight, xml: string, hash: string, state: "CURRENT" | "CANDIDATE") {
  return {
    xml, contentHash: hash, parserVersion: doc.parserVersion, state,
    references: { create: doc.references },
    ...(doc.documentType === "NFE" ? { nfe: { create: { data: doc.detail } } } : { cte: { create: { data: doc.detail } } })
  } satisfies Prisma.FiscalDocumentVersionCreateWithoutInvoiceInput;
}

export async function resolveFiscalParties(tx: Tx, doc: ParsedGoodsOrFreight, actor: IngestActor, requestedSupplierId?: string) {
  const issuer = cnpj(doc.supplier.cnpj);
  const recipient = cnpj(doc.companyParty.cnpj);
  let supplier = issuer ? await tx.supplier.findUnique({ where: { cnpj: issuer }, select: { id: true } }) : null;
  if (actor?.role === "FORNECEDOR" && (!supplier || !actor.allowedSupplierIds.includes(supplier.id))) {
    throw new FiscalIngestError(403, "Sem permissão para receber documento deste emitente.");
  }
  if (requestedSupplierId && supplier?.id !== requestedSupplierId) {
    throw new FiscalIngestError(400, "O fornecedor informado não corresponde ao emitente do XML.");
  }
  if (!supplier && issuer && doc.supplier.name) {
    supplier = await tx.supplier.upsert({ where: { cnpj: issuer }, update: {},
      create: { cnpj: issuer, nome: doc.supplier.name }, select: { id: true } });
  }
  const companies = recipient ? await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Company" WHERE active AND regexp_replace(cnpj, '[^0-9]', '', 'g') = ${recipient} LIMIT 2` : [];
  return { supplierId: supplier?.id ?? null, companyId: companies.length === 1 ? companies[0].id : null };
}

/** Only references of a current authorized CT-e have operational effects. Under the
 * caller's key locks, resolve both documents already here and earlier references. */
export async function linkFiscalReferences(tx: Tx, invoice: { id: string; codigoIdentificador: string; documentType: "CTE" | "NFE" },
  versionId: string, doc: ParsedGoodsOrFreight, actor: IngestActor) {
  for (const ref of doc.references) {
    const target = await tx.invoice.findUnique({ where: { codigoIdentificador: ref.targetKey }, select: { id: true, documentType: true } });
    const targetInvoiceId = target?.documentType === (ref.kind === "NFE" ? "NFE" : "CTE") ? target.id : null;
    await tx.fiscalDocumentReference.update({
      where: { sourceVersionId_kind_targetKey: { sourceVersionId: versionId, ...ref } }, data: { targetInvoiceId }
    });
    if (targetInvoiceId && ref.kind === "SUBSTITUTES_CTE" && doc.fiscalStatus === "AUTHORIZED") {
      await holdFiscalInvoice(tx, targetInvoiceId, "CTE_SUBSTITUIDO", actor);
    }
  }
  const kind = invoice.documentType === "CTE" ? "SUBSTITUTES_CTE" : "NFE";
  await tx.fiscalDocumentReference.updateMany({
    where: { kind, targetKey: invoice.codigoIdentificador, targetInvoiceId: null, sourceVersion: { state: "CURRENT" } },
    data: { targetInvoiceId: invoice.id }
  });
  if (kind === "SUBSTITUTES_CTE" && await tx.fiscalDocumentReference.findFirst({
    where: { targetInvoiceId: invoice.id, ...effectiveCteSubstitution },
    select: { id: true }
  })) await holdFiscalInvoice(tx, invoice.id, "CTE_SUBSTITUIDO", actor);
}

export async function receiveFiscalDocument(tx: Tx, doc: ParsedGoodsOrFreight, xml: string, actor: IngestActor, requestedSupplierId?: string) {
  await lockFiscalKeys(tx, [doc.accessKey, ...doc.references.map(ref => ref.targetKey), ...(doc.supplier.cnpj ? ["supplier:" + doc.supplier.cnpj] : [])]);
  const hash = xmlContentHash(xml);
  const existing = await tx.invoice.findUnique({ where: { codigoIdentificador: doc.accessKey }, select: summary });
  if (existing) {
    if (actor?.role === "FORNECEDOR" && (!existing.fornecedorId || !actor.allowedSupplierIds.includes(existing.fornecedorId))) {
      throw new FiscalIngestError(403, "Sem permissão para receber documento deste fornecedor.");
    }
    if (actor?.role === "FORNECEDOR") {
      const supplier = await tx.supplier.findUnique({ where: { id: existing.fornecedorId! }, select: { cnpj: true } });
      if (!supplier?.cnpj || supplier.cnpj !== cnpj(doc.supplier.cnpj)) throw new FiscalIngestError(403, "O emitente não corresponde ao fornecedor autorizado.");
    }
    if (requestedSupplierId && existing.fornecedorId !== requestedSupplierId) throw new FiscalIngestError(400, "O fornecedor informado não corresponde ao documento.");
    if (existing.documentType !== doc.documentType) throw new FiscalIngestError(409, "Identificador em uso por outro tipo de documento.");
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${existing.id} FOR UPDATE`;
    const version = await tx.fiscalDocumentVersion.findUnique({ where: { invoiceId_contentHash: { invoiceId: existing.id, contentHash: hash } }, select: { id: true, state: true } });
    if (version?.state === "CURRENT") {
      const current = await tx.invoice.findUniqueOrThrow({ where: { id: existing.id }, select: summary });
      const review = await tx.invoiceAdminReview.findUnique({ where: { invoiceId: existing.id } });
      return { status: 200, body: { ...current, versionId: version.id, reviewReasons: review?.status === "PENDENTE" ? review.motivos : [] } };
    }
    const candidate = version ?? await tx.fiscalDocumentVersion.create({
      data: { invoiceId: existing.id, ...versionData(doc, xml, hash, "CANDIDATE") }, select: { id: true }
    });
    if (!version) await holdFiscalInvoice(tx, existing.id, "CONFLITO_XML", actor);
    return { status: 409, body: { error: "XML divergente da versão vigente.", invoiceId: existing.id, versionId: candidate.id } };
  }
  const { companyId, supplierId } = await resolveFiscalParties(tx, doc, actor, requestedSupplierId);
  const dataEmissao = fiscalIssueDate(doc.issuedAt);
  const review = evaluateInvoiceAdminReview({ valorServico: doc.referenceValue, dataEmissao });
  const reasons = [
    ...review.reasons, ...(!companyId ? ["EMPRESA_PENDENTE"] : []), ...(!supplierId ? ["FORNECEDOR_PENDENTE"] : []),
    ...(doc.fiscalStatus !== "AUTHORIZED" ? ["SITUACAO_FISCAL_PENDENTE"] : []),
    ...(doc.referenceValue === null || !dataEmissao ? ["DADOS_FISCAIS_INCOMPLETOS"] : [])
  ];
  const invoice = await tx.invoice.create({ data: {
    documentType: doc.documentType, codigoIdentificador: doc.accessKey, numeroNota: doc.number,
    fornecedorId: supplierId, companyId, dataEmissao, referenceValue: doc.referenceValue, fiscalStatus: doc.fiscalStatus, situacaoNotaFiscal: fiscalSituation[doc.fiscalStatus],
    tomadorCnpj: doc.companyParty.cnpj, tomadorNome: doc.companyParty.name, prestadorCnpj: doc.supplier.cnpj,
    prestadorNome: doc.supplier.name, xmlOriginal: xml, criadoPorId: actor?.id,
    ...(reasons.length ? { adminReview: { create: { motivos: reasons, mesReferencia: review.referenceMonth } } } : {})
  }, select: summary });
  const version = await tx.fiscalDocumentVersion.create({ data: { invoiceId: invoice.id, ...versionData(doc, xml, hash, "CURRENT") }, select: { id: true } });
  await linkFiscalReferences(tx, { ...invoice, documentType: doc.documentType }, version.id, doc, actor);
  await tx.noteStatusHistory.create({ data: { invoiceId: invoice.id, newStatus: "AGUARDANDO_APROVACAO", actorId: actor?.id } });
  await tx.noteAuditLog.create({ data: {
    invoiceId: invoice.id, actorId: actor?.id, actionType: "FISCAL_RECEIVED", actionDescription: "Documento fiscal recebido pela integração",
    afterData: { versionId: version.id, documentType: doc.documentType }
  } });
  const pending = await tx.invoiceAdminReview.findUnique({ where: { invoiceId: invoice.id } });
  const workflow = pending ? null : await startConfiguredWorkflow(tx, invoice.id, { id: actor?.id, name: actor?.nome, email: actor?.email }, new Date(), true);
  return { status: 201, workflow, body: { ...invoice, versionId: version.id, reviewReasons: pending?.motivos ?? [] } };
}
