import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { evaluateInvoiceAdminReview } from "./invoice-admin-review";
import { FiscalIngestError, fiscalSituation, linkFiscalReferences, lockFiscalKeys, resolveFiscalParties, type IngestActor } from "./fiscal-document-ingest";
import { effectiveCteSubstitution, fiscalIssueDate, legacyProcessingUnresolved } from "./fiscal-document-rules";
import { parseFiscalXml } from "./fiscal-document-parser";
import { startConfiguredWorkflow } from "./workflow/start";

const base = { reason: z.string().trim().min(1).max(500), expectedVersionId: z.string().min(1).nullable() };
export const fiscalReviewSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("ASSOCIATE"), companyId: z.string().min(1).optional(), supplierId: z.string().min(1).optional() }).strict(),
  z.object({ ...base, action: z.literal("ACCEPT_VERSION"), versionId: z.string().min(1) }).strict(),
  z.object({ ...base, action: z.literal("REJECT_VERSION"), versionId: z.string().min(1) }).strict(),
  z.object({ ...base, action: z.literal("REOPEN") }).strict()
]);
type Tx = Prisma.TransactionClient;
type Decision = z.infer<typeof fiscalReviewSchema>;
const conflict = (message: string): never => { throw new FiscalIngestError(409, message); };

async function restartCycle(tx: Tx, invoiceId: string, reason: string, actor: NonNullable<IngestActor>) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { status: true, workflowExecution: { select: { id: true, status: true } } } });
  const execution = invoice.workflowExecution;
  if (execution) {
    await tx.invoiceWorkflow.update({ where: { id: execution.id }, data: {
      currentInvoiceId: null, ...(execution.status !== "COMPLETED" ? { status: "SUPERSEDED", completedAt: new Date() } : {}), revision: { increment: 1 }
    } });
  }
  await tx.invoice.update({ where: { id: invoiceId }, data: { status: "AGUARDANDO_APROVACAO", processada: false,
    statusProcessamento: "PENDENTE", dataValidacao: null, responsavelValidacao: null } });
  await tx.noteStatusHistory.create({ data: { invoiceId, previousStatus: invoice.status, newStatus: "AGUARDANDO_APROVACAO", reason, actorId: actor.id, actorName: actor.nome } });
}

async function refreshReview(tx: Tx, id: string, resetConfirmations: boolean) {
  const i = await tx.invoice.findUniqueOrThrow({ where: { id }, include: {
    company: { select: { active: true } }, adminReview: true,
    documentVersions: { where: { state: "CANDIDATE" }, take: 1, select: { id: true } },
    incomingReferences: { where: effectiveCteSubstitution, take: 1, select: { id: true } }
  } });
  const fiscal = i.documentType === "NFE" || i.documentType === "CTE";
  if (i.adminReview?.status === "IGNORADA") return false;
  const review = evaluateInvoiceAdminReview({ valorServico: fiscal ? i.referenceValue?.toString() : i.valorServico?.toString(),
    valorLiquido: fiscal ? null : i.valorLiquido?.toString(), valorBaseCalculo: fiscal ? null : i.valorBaseCalculo?.toString(), dataEmissao: i.dataEmissao });
  // A passage of calendar time alone cannot reopen a previously accepted review.
  const originalReasons = i.adminReview?.motivos ?? [];
  const valueDateReasons = resetConfirmations ? review.reasons : originalReasons.filter(r => r === "VALOR_ZERADO" || r === "EMISSAO_ANTERIOR");
  const reasons = [...valueDateReasons, ...(i.documentVersions.length ? ["CONFLITO_XML"] : []),
    ...(fiscal && !i.company?.active ? ["EMPRESA_PENDENTE"] : []), ...(fiscal && !i.fornecedorId ? ["FORNECEDOR_PENDENTE"] : []),
    ...(fiscal && i.fiscalStatus !== "AUTHORIZED" ? ["SITUACAO_FISCAL_PENDENTE"] : []),
    ...(fiscal && (i.referenceValue === null || !i.dataEmissao) ? ["DADOS_FISCAIS_INCOMPLETOS"] : []),
    ...(i.incomingReferences.length ? ["CTE_SUBSTITUIDO"] : [])];
  if (!i.adminReview && !reasons.length) return true;
  const pending = reasons.some(r => r === "VALOR_ZERADO" ? resetConfirmations || !i.adminReview?.valorConfirmado
    : r === "EMISSAO_ANTERIOR" ? resetConfirmations || !i.adminReview?.emissaoConfirmada : true);
  const status = pending ? "PENDENTE" : "LIBERADA";
  await tx.invoiceAdminReview.upsert({ where: { invoiceId: id },
    create: { invoiceId: id, motivos: reasons, mesReferencia: review.referenceMonth, status },
    update: { motivos: reasons, status, versao: { increment: 1 }, ...(resetConfirmations ? { valorConfirmado: null, emissaoConfirmada: false } : {}) } });
  return !pending;
}

async function reconcileFormerOriginal(tx: Tx, originalId: string, actor: NonNullable<IngestActor>, reason: string) {
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${originalId} FOR UPDATE`;
  const original = await tx.invoice.findUniqueOrThrow({ where: { id: originalId }, select: {
    status: true, createdAt: true, adminReview: { select: { motivos: true } },
    incomingReferences: { where: effectiveCteSubstitution, select: { id: true }, take: 1 },
    workflowExecution: { select: { id: true, status: true, tasks: { where: { completedAt: null }, take: 1, select: { id: true } } } }
  } });
  if (original.incomingReferences.length || !original.adminReview?.motivos.includes("CTE_SUBSTITUIDO")) return;
  const released = await refreshReview(tx, originalId, false);
  if (released && original.status === "AGUARDANDO_APROVACAO") {
    const execution = original.workflowExecution;
    if (execution?.status === "BLOCKED" && execution.tasks.length) {
      await tx.invoiceWorkflow.update({ where: { id: execution.id }, data: { status: "ACTIVE", revision: { increment: 1 } } });
    } else if (!execution) {
      await startConfiguredWorkflow(tx, originalId, { id: actor.id, name: actor.nome, email: actor.email }, original.createdAt);
    }
  }
  await tx.noteAuditLog.create({ data: { invoiceId: originalId, actorId: actor.id, actorName: actor.nome,
    actionType: "FISCAL_SUBSTITUTION_REMOVED", actionDescription: "A versão aceita deixou de substituir este CT-e", reason } });
}

async function applyCandidate(tx: Tx, invoiceId: string, versionId: string, xml: string, actor: NonNullable<IngestActor>) {
  const doc = parseFiscalXml(xml);
  if (doc.documentType !== "NFSE") {
    const { companyId, supplierId } = await resolveFiscalParties(tx, doc, actor);
    await tx.invoice.update({ where: { id: invoiceId }, data: { xmlOriginal: xml, numeroNota: doc.number, dataEmissao: fiscalIssueDate(doc.issuedAt),
      referenceValue: doc.referenceValue, fiscalStatus: doc.fiscalStatus, situacaoNotaFiscal: fiscalSituation[doc.fiscalStatus], companyId, fornecedorId: supplierId,
      prestadorNome: doc.supplier.name, prestadorCnpj: doc.supplier.cnpj, tomadorNome: doc.companyParty.name, tomadorCnpj: doc.companyParty.cnpj } });
    await linkFiscalReferences(tx, { id: invoiceId, codigoIdentificador: doc.accessKey, documentType: doc.documentType }, versionId, doc, actor);
    return;
  }
  const n = doc.nfse;
  const cnpj = n.prestadorCnpj;
  if (!cnpj) throw new FiscalIngestError(409, "Corrija a identificação do prestador da NFS-e.");
  let supplier = await tx.supplier.findUnique({ where: { cnpj }, select: { id: true } });
  if (!supplier && n.prestadorNome) supplier = await tx.supplier.upsert({ where: { cnpj }, update: {}, create: { cnpj, nome: n.prestadorNome }, select: { id: true } });
  if (!supplier) throw new FiscalIngestError(409, "Cadastre o prestador identificado no XML antes de aceitar.");
  const strings = ["nDfse","localEmissao","localPrestacao","municipioIncidencia","itemTributacaoNac","itemTributacaoMun","nbsDescricao","descricaoServico",
    "prestadorCnpj","prestadorNome","prestadorEmail","tomadorCnpj","tomadorNome","tomadorEmail","valorBaseCalculo","valorIssqn","valorTotalRetido","valorLiquido","valorServico","aliquota"] as const;
  const company = n.tomadorCnpj ? await tx.company.findFirst({ where: { cnpj: n.tomadorCnpj, active: true }, select: { id: true } }) : null;
  await tx.invoice.update({ where: { id: invoiceId }, data: {
    ...Object.fromEntries(strings.map(key => [key, n[key] ?? null])), xmlOriginal: xml, numeroNota: n.numeroNota, fornecedorId: supplier.id, companyId: company?.id ?? null,
    referenceValue: n.valorServico ?? n.valorLiquido ?? n.valorBaseCalculo ?? null,
    dataEmissao: n.dataEmissao ? new Date(n.dataEmissao) : null, dataCompetencia: n.dataCompetencia ? new Date(n.dataCompetencia) : null,
    dataProcessamento: n.dataProcessamento ? new Date(n.dataProcessamento) : null,
    documentDetail: { upsert: { create: n.documentDetail, update: n.documentDetail } }
  } });
}

export async function reviewFiscalDocument(tx: Tx, id: string, input: Decision, actor: NonNullable<IngestActor>) {
  const initial = await tx.invoice.findUnique({ where: { id }, select: { codigoIdentificador: true } });
  if (!initial) throw new FiscalIngestError(404, "Documento não encontrado.");
  const hasVersion = input.action === "ACCEPT_VERSION" || input.action === "REJECT_VERSION";
  const refs = hasVersion ? await tx.fiscalDocumentReference.findMany({ where: { sourceVersion: { invoiceId: id, OR: [{ id: input.versionId }, { state: "CURRENT" }] } }, select: { sourceVersionId: true, kind: true, targetKey: true, targetInvoiceId: true } }) : [];
  await lockFiscalKeys(tx, [initial.codigoIdentificador, ...refs.map(r => r.targetKey)]);
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
  const i = await tx.invoice.findUniqueOrThrow({ where: { id }, include: {
    adminReview: true, workflowExecution: true,
    documentVersions: { where: { state: "CURRENT" }, select: { id: true } }
  } });
  const currentId = i.documentVersions[0]?.id ?? null;
  if (currentId !== input.expectedVersionId) conflict("A versão vigente mudou. Atualize o documento.");
  if (i.documentType !== "NFE" && i.documentType !== "CTE") {
    if (legacyProcessingUnresolved(i)) conflict("Aguarde a confirmação do processamento externo.");
    if (input.action !== "REJECT_VERSION" && (i.status === "PROCESSADO" || i.dataLancamentoDelphi)) {
      conflict("O lançamento registrado impede a alteração do documento.");
    }
  }
  if (input.action === "ASSOCIATE") {
    if (!input.companyId && !input.supplierId) conflict("Selecione a empresa ou o fornecedor pendente.");
    if (i.adminReview?.status !== "PENDENTE") conflict("O documento não está em revisão.");
    if (input.companyId) {
      const company = await tx.company.findFirst({ where: { id: input.companyId, active: true } });
      if (!i.adminReview?.motivos.includes("EMPRESA_PENDENTE") || !company || !i.tomadorCnpj || company.cnpj.replace(/\D/g, "") !== i.tomadorCnpj) conflict("A empresa deve corresponder ao CNPJ do destinatário ou tomador do XML vigente.");
    }
    if (input.supplierId) {
      const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
      if (!i.adminReview?.motivos.includes("FORNECEDOR_PENDENTE") || !supplier || (i.prestadorCnpj && supplier.cnpj !== i.prestadorCnpj)) conflict("Fornecedor incompatível com o emitente.");
    }
    await tx.invoice.update({ where: { id }, data: { companyId: input.companyId, fornecedorId: input.supplierId } });
  } else if (input.action === "REOPEN") {
    if (i.status !== "RECUSADO") conflict("Somente documentos recusados podem ser reabertos.");
    await restartCycle(tx, id, input.reason, actor);
  } else {
    const version = await tx.fiscalDocumentVersion.findFirst({ where: { id: input.versionId, invoiceId: id, state: "CANDIDATE" } });
    if (!version) throw new FiscalIngestError(409, "A versão candidata já foi decidida ou pertence a outro documento.");
    if (input.action === "ACCEPT_VERSION" && currentId) await tx.fiscalDocumentVersion.update({ where: { id: currentId }, data: { state: "ARCHIVED" } });
    await tx.fiscalDocumentVersion.update({ where: { id: version.id }, data: {
      state: input.action === "ACCEPT_VERSION" ? "CURRENT" : "REJECTED", reviewedById: actor.id, reviewedAt: new Date(), reviewReason: input.reason
    } });
    if (input.action === "ACCEPT_VERSION") {
      await applyCandidate(tx, id, version.id, version.xml, actor);
      // Lookup by key again: the original may have arrived between the initial
      // discovery of the lock set and acquisition of its advisory lock.
      for (const ref of refs.filter(ref => ref.sourceVersionId === currentId && ref.kind === "SUBSTITUTES_CTE")) {
        const target = await tx.invoice.findFirst({ where: { codigoIdentificador: ref.targetKey, documentType: "CTE" }, select: { id: true } });
        if (target) await reconcileFormerOriginal(tx, target.id, actor, input.reason);
      }
      await restartCycle(tx, id, input.reason, actor);
    }
  }
  const released = await refreshReview(tx, id, input.action === "ACCEPT_VERSION");
  let workflow: Awaited<ReturnType<typeof startConfiguredWorkflow>> | null = null;
  if (released) {
    const canResume = i.status === "AGUARDANDO_APROVACAO" || i.status === "DADOS_INCONSISTENTES";
    const suspended = canResume && input.action === "REJECT_VERSION" && i.workflowExecution?.status === "BLOCKED" ? i.workflowExecution : null;
    if (suspended && await tx.invoiceWorkflowTask.count({ where: { executionId: suspended.id, completedAt: null } })) {
      await tx.invoiceWorkflow.update({ where: { id: suspended.id }, data: { status: "ACTIVE", revision: { increment: 1 } } });
    } else if (input.action === "ACCEPT_VERSION" || input.action === "REOPEN" ||
      (!i.workflowExecution && i.status === "AGUARDANDO_APROVACAO")) {
      workflow = await startConfiguredWorkflow(tx, id, { id: actor.id, name: actor.nome, email: actor.email }, i.createdAt, input.action === "REOPEN");
    }
  }
  await tx.noteAuditLog.create({ data: { invoiceId: id, actorId: actor.id, actorName: actor.nome, actionType: "FISCAL_" + input.action,
    reason: input.reason, afterData: { priorVersionId: currentId, ...("versionId" in input ? { versionId: input.versionId } : {}),
      ...(input.action === "ASSOCIATE" ? { companyId: input.companyId ?? null, supplierId: input.supplierId ?? null } : {}) } } });
  return { id, released, workflow };
}
