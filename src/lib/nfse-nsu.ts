import { Prisma, NfseNsuStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaginationMetadata, getPaginationParams } from "@/lib/pagination";

export const RESOLVED_NFSE_NSU_STATUSES = [NfseNsuStatus.Downloaded, NfseNsuStatus.IgnoredByRule] as const;
export const PENDING_NFSE_NSU_STATUSES = [NfseNsuStatus.PendingGap, NfseNsuStatus.RetryError] as const;
export type NfseProcessingStatus = "Healthy" | "HasGaps" | "HasErrors" | "NeverScanned";

export type RegisterNfseNsuAttemptInput = {
  idempotencyKey: string;
  companyId: string;
  cnpj: string;
  nsu: number;
  status: NfseNsuStatus;
  attemptedAt: string;
  wasNsuScanned: boolean;
  httpStatus?: number | null;
  errorMessage?: string | null;
  documentId?: string | null;
  accessKey?: string | null;
  ignoreReason?: string | null;
};

export type UpdateNfseNsuCheckpointInput = {
  lastContiguousNsu: number;
  highestScannedNsu: number;
  lastScanAt?: string | null;
  lastDocumentDownloadedAt?: string | null;
  expectedVersion: number;
};

export class NfseNsuConflictError extends Error {
  constructor(message: string, public details?: Record<string, unknown>) { super(message); }
}
export class NfseNsuValidationError extends Error {}
export class NfseNsuNotFoundError extends Error {}

export function normalizeCnpj(value: string) { return value.replace(/\D/g, ""); }

export function isValidCnpj(value: string) {
  const cnpj = normalizeCnpj(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, weight, index) => acc + Number(base[index]) * weight, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

function toNumber(value: bigint | number | null | undefined) { return value === null || value === undefined ? null : Number(value); }
function toIso(value: Date | null | undefined) { return value ? value.toISOString() : null; }
function cleanText(value?: string | null, max = 1000) { const v = value?.trim(); return v ? v.slice(0, max) : null; }
function attemptSignature(input: RegisterNfseNsuAttemptInput) {
  return {
    companyId: input.companyId,
    cnpj: normalizeCnpj(input.cnpj),
    nsu: input.nsu,
    resultStatus: input.status,
    httpStatus: input.httpStatus ?? null,
    errorMessage: cleanText(input.errorMessage),
    wasNsuScanned: input.wasNsuScanned,
    documentId: cleanText(input.documentId, 120),
    accessKey: cleanText(input.accessKey, 80),
    ignoreReason: cleanText(input.ignoreReason),
    attemptedAt: new Date(input.attemptedAt).toISOString()
  };
}
function persistedAttemptSignature(attempt: { nsuControl: { companyId: string; cnpj: string; nsu: bigint }; resultStatus: NfseNsuStatus; httpStatus: number | null; errorMessage: string | null; wasNsuScanned: boolean; documentId: string | null; accessKey: string | null; ignoreReason: string | null; attemptedAt: Date }) {
  return {
    companyId: attempt.nsuControl.companyId,
    cnpj: attempt.nsuControl.cnpj,
    nsu: Number(attempt.nsuControl.nsu),
    resultStatus: attempt.resultStatus,
    httpStatus: attempt.httpStatus,
    errorMessage: attempt.errorMessage,
    wasNsuScanned: attempt.wasNsuScanned,
    documentId: attempt.documentId,
    accessKey: attempt.accessKey,
    ignoreReason: attempt.ignoreReason,
    attemptedAt: attempt.attemptedAt.toISOString()
  };
}
function sameJson(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }

function serializeControl(control: any, extra: Record<string, unknown> = {}) {
  return {
    id: control.id,
    ...extra,
    companyId: control.companyId,
    cnpj: control.cnpj,
    nsu: toNumber(control.nsu),
    status: control.status,
    attempts: control.attempts,
    firstAttemptAt: toIso(control.firstAttemptAt),
    lastAttemptAt: toIso(control.lastAttemptAt),
    lastHttpStatus: control.lastHttpStatus,
    lastError: control.lastError,
    documentId: control.documentId,
    accessKey: control.accessKey,
    ignoreReason: control.ignoreReason,
    wasLastAttemptScanned: control.wasLastAttemptScanned,
    createdAt: toIso(control.createdAt),
    updatedAt: toIso(control.updatedAt)
  };
}
function serializeCheckpoint(checkpoint: any) {
  return checkpoint ? {
    id: checkpoint.id,
    companyId: checkpoint.companyId,
    cnpj: checkpoint.cnpj,
    lastContiguousNsu: toNumber(checkpoint.lastContiguousNsu),
    highestScannedNsu: toNumber(checkpoint.highestScannedNsu),
    lastScanAt: toIso(checkpoint.lastScanAt),
    lastDocumentDownloadedAt: toIso(checkpoint.lastDocumentDownloadedAt),
    version: checkpoint.version,
    createdAt: toIso(checkpoint.createdAt),
    updatedAt: toIso(checkpoint.updatedAt)
  } : null;
}

async function assertCompany(companyId: string, cnpj: string, tx: typeof prisma = prisma) {
  const company = await tx.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NfseNsuNotFoundError("Empresa não encontrada.");
  const normalized = normalizeCnpj(cnpj);
  if (company.cnpj !== normalized) throw new NfseNsuValidationError("CNPJ não corresponde à empresa informada.");
  return company;
}

export async function registerNfseNsuAttempt(input: RegisterNfseNsuAttemptInput) {
  const signature = attemptSignature(input);
  return prisma.$transaction(async (tx) => {
    await assertCompany(input.companyId, input.cnpj, tx as any);
    const existingAttempt = await tx.nfseNsuAttempt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { nsuControl: true }
    });
    if (existingAttempt) {
      if (!sameJson(signature, persistedAttemptSignature(existingAttempt))) {
        console.warn("[nfse-nsu:attempt:conflict]", { companyId: input.companyId, cnpj: signature.cnpj, nsu: input.nsu, idempotencyKey: input.idempotencyKey });
        throw new NfseNsuConflictError("Chave de idempotência já utilizada com conteúdo diferente.");
      }
      console.info("[nfse-nsu:attempt:duplicate]", { companyId: input.companyId, cnpj: signature.cnpj, nsu: input.nsu, idempotencyKey: input.idempotencyKey });
      return serializeControl(existingAttempt.nsuControl, { attemptId: existingAttempt.id, idempotent: true });
    }

    const attemptedAt = new Date(input.attemptedAt);
    const current = await tx.nfseNsuControl.upsert({
      where: { companyId_nsu: { companyId: input.companyId, nsu: BigInt(input.nsu) } },
      update: {},
      create: {
        companyId: input.companyId,
        cnpj: signature.cnpj,
        nsu: BigInt(input.nsu),
        status: input.status,
        attempts: 0,
        firstAttemptAt: attemptedAt,
        lastAttemptAt: attemptedAt,
        wasLastAttemptScanned: input.wasNsuScanned
      }
    });
    const previousStatus = current.status;
    const attempt = await tx.nfseNsuAttempt.create({ data: {
      nsuControlId: current.id,
      idempotencyKey: input.idempotencyKey,
      resultStatus: input.status,
      httpStatus: input.httpStatus ?? null,
      errorMessage: signature.errorMessage,
      wasNsuScanned: input.wasNsuScanned,
      documentId: signature.documentId,
      accessKey: signature.accessKey,
      ignoreReason: signature.ignoreReason,
      attemptedAt
    }});
    const data: Prisma.NfseNsuControlUpdateInput = {
      status: input.status,
      attempts: { increment: 1 },
      firstAttemptAt: current.attempts === 0 || attemptedAt < current.firstAttemptAt ? attemptedAt : current.firstAttemptAt,
      lastAttemptAt: attemptedAt,
      lastHttpStatus: input.httpStatus ?? null,
      wasLastAttemptScanned: input.wasNsuScanned,
      lastError: input.status === NfseNsuStatus.RetryError ? signature.errorMessage : null,
      documentId: (input.status === NfseNsuStatus.Downloaded || input.status === NfseNsuStatus.IgnoredByRule) ? signature.documentId : null,
      accessKey: (input.status === NfseNsuStatus.Downloaded || input.status === NfseNsuStatus.IgnoredByRule) ? signature.accessKey : null,
      ignoreReason: input.status === NfseNsuStatus.IgnoredByRule ? signature.ignoreReason : null
    };
    const updated = await tx.nfseNsuControl.update({ where: { id: current.id }, data });
    console.info("[nfse-nsu:attempt:registered]", { companyId: input.companyId, cnpj: signature.cnpj, nsu: input.nsu, idempotencyKey: input.idempotencyKey, previousStatus, newStatus: input.status, attempts: updated.attempts, httpStatus: input.httpStatus ?? null });
    return serializeControl(updated, { attemptId: attempt.id, idempotent: false });
  });
}

export async function getCheckpoint(companyId: string) {
  const checkpoint = await prisma.nfseNsuCheckpoint.findUnique({ where: { companyId } });
  if (!checkpoint) throw new NfseNsuNotFoundError("Checkpoint não encontrado para esta empresa.");
  return serializeCheckpoint(checkpoint);
}
export async function getCheckpointByCnpj(cnpj: string) {
  const checkpoint = await prisma.nfseNsuCheckpoint.findUnique({ where: { cnpj: normalizeCnpj(cnpj) } });
  if (!checkpoint) throw new NfseNsuNotFoundError("Checkpoint não encontrado para este CNPJ.");
  return serializeCheckpoint(checkpoint);
}
export async function updateCheckpoint(companyId: string, input: UpdateNfseNsuCheckpointInput) {
  if (input.lastContiguousNsu > input.highestScannedNsu) throw new NfseNsuValidationError("LastContiguousNsu não pode ser maior que HighestScannedNsu.");
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NfseNsuNotFoundError("Empresa não encontrada.");
    const existing = await tx.nfseNsuCheckpoint.findUnique({ where: { companyId } });
    if (!existing) {
      if (input.expectedVersion !== 0) throw new NfseNsuConflictError("Checkpoint inexistente. Use expectedVersion 0 para criar.", { currentVersion: 0 });
      const created = await tx.nfseNsuCheckpoint.create({ data: {
        companyId,
        cnpj: company.cnpj,
        lastContiguousNsu: BigInt(input.lastContiguousNsu),
        highestScannedNsu: BigInt(input.highestScannedNsu),
        lastScanAt: input.lastScanAt ? new Date(input.lastScanAt) : null,
        lastDocumentDownloadedAt: input.lastDocumentDownloadedAt ? new Date(input.lastDocumentDownloadedAt) : null,
        version: 1
      }});
      return serializeCheckpoint(created);
    }
    if (existing.version !== input.expectedVersion) throw new NfseNsuConflictError("Versão do checkpoint divergente.", { currentVersion: existing.version });
    if (BigInt(input.lastContiguousNsu) < existing.lastContiguousNsu || BigInt(input.highestScannedNsu) < existing.highestScannedNsu) throw new NfseNsuValidationError("Checkpoint não pode ser reduzido.");
    const updated = await tx.nfseNsuCheckpoint.update({ where: { companyId }, data: {
      cnpj: company.cnpj,
      lastContiguousNsu: BigInt(input.lastContiguousNsu),
      highestScannedNsu: BigInt(input.highestScannedNsu),
      lastScanAt: input.lastScanAt ? new Date(input.lastScanAt) : null,
      lastDocumentDownloadedAt: input.lastDocumentDownloadedAt ? new Date(input.lastDocumentDownloadedAt) : null,
      version: { increment: 1 }
    }});
    console.info("[nfse-nsu:checkpoint:updated]", { companyId, cnpj: company.cnpj, lastContiguousNsu: input.lastContiguousNsu, highestScannedNsu: input.highestScannedNsu, version: updated.version });
    return serializeCheckpoint(updated);
  });
}

function processingStatus(hasRows: boolean, retryErrorCount: number, pendingGapCount: number): NfseProcessingStatus {
  if (!hasRows) return "NeverScanned";
  if (retryErrorCount > 0) return "HasErrors";
  if (pendingGapCount > 0) return "HasGaps";
  return "Healthy";
}


async function buildSummariesForCompanies(companies: Array<{ id: string; cnpj: string; displayName: string }>) {
  const companyIds = companies.map((company) => company.id);
  if (!companyIds.length) return new Map<string, Awaited<ReturnType<typeof getCompanyNfseNsuSummary>>>();
  const [checkpoints, statusGroups, totals, pendingGroups, errorGroups] = await Promise.all([
    prisma.nfseNsuCheckpoint.findMany({ where: { companyId: { in: companyIds } } }),
    prisma.nfseNsuControl.groupBy({ by: ["companyId", "status"], where: { companyId: { in: companyIds } }, _count: { _all: true } }),
    prisma.nfseNsuControl.groupBy({ by: ["companyId"], where: { companyId: { in: companyIds } }, _sum: { attempts: true }, _max: { lastAttemptAt: true }, _count: { _all: true } }),
    prisma.nfseNsuControl.groupBy({ by: ["companyId"], where: { companyId: { in: companyIds }, status: { in: PENDING_NFSE_NSU_STATUSES as any } }, _min: { nsu: true, firstAttemptAt: true }, _max: { nsu: true } }),
    prisma.nfseNsuControl.groupBy({ by: ["companyId"], where: { companyId: { in: companyIds }, status: NfseNsuStatus.RetryError }, _max: { lastAttemptAt: true } })
  ]);
  const checkpointMap = new Map(checkpoints.map((item) => [item.companyId, item]));
  const totalsMap = new Map(totals.map((item) => [item.companyId, item]));
  const pendingMap = new Map(pendingGroups.map((item) => [item.companyId, item]));
  const errorMap = new Map(errorGroups.map((item) => [item.companyId, item]));
  const countMap = new Map<string, Record<string, number>>();
  statusGroups.forEach((item) => {
    const counts = countMap.get(item.companyId) ?? {};
    counts[item.status] = item._count._all;
    countMap.set(item.companyId, counts);
  });
  const result = new Map<string, Awaited<ReturnType<typeof getCompanyNfseNsuSummary>>>();
  companies.forEach((company) => {
    const checkpoint = checkpointMap.get(company.id);
    const counts = countMap.get(company.id) ?? {};
    const total = totalsMap.get(company.id);
    const pending = pendingMap.get(company.id);
    const errors = errorMap.get(company.id);
    const pendingGapCount = counts.PendingGap ?? 0;
    const retryErrorCount = counts.RetryError ?? 0;
    result.set(company.id, {
      companyId: company.id,
      cnpj: company.cnpj,
      companyName: company.displayName,
      lastContiguousNsu: toNumber(checkpoint?.lastContiguousNsu),
      highestScannedNsu: toNumber(checkpoint?.highestScannedNsu),
      checkpointDistance: checkpoint ? Number(checkpoint.highestScannedNsu - checkpoint.lastContiguousNsu) : null,
      lastScanAt: toIso(checkpoint?.lastScanAt),
      lastDocumentDownloadedAt: toIso(checkpoint?.lastDocumentDownloadedAt),
      pendingGapCount,
      retryErrorCount,
      downloadedCount: counts.Downloaded ?? 0,
      ignoredCount: counts.IgnoredByRule ?? 0,
      totalAttempts: total?._sum.attempts ?? 0,
      oldestPendingNsu: toNumber(pending?._min.nsu),
      newestPendingNsu: toNumber(pending?._max.nsu),
      oldestPendingAt: toIso(pending?._min.firstAttemptAt),
      lastAttemptAt: toIso(total?._max.lastAttemptAt),
      lastErrorAt: toIso(errors?._max.lastAttemptAt),
      processingStatus: processingStatus(Boolean(checkpoint || total?._count._all), retryErrorCount, pendingGapCount)
    });
  });
  return result;
}
export async function getCompanyNfseNsuSummary(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NfseNsuNotFoundError("Empresa não encontrada.");
  const [checkpoint, groups, totals, pendingAgg, lastError] = await Promise.all([
    prisma.nfseNsuCheckpoint.findUnique({ where: { companyId } }),
    prisma.nfseNsuControl.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    prisma.nfseNsuControl.aggregate({ where: { companyId }, _sum: { attempts: true }, _max: { lastAttemptAt: true }, _count: { _all: true } }),
    prisma.nfseNsuControl.aggregate({ where: { companyId, status: { in: PENDING_NFSE_NSU_STATUSES as any } }, _min: { nsu: true, firstAttemptAt: true }, _max: { nsu: true } }),
    prisma.nfseNsuControl.aggregate({ where: { companyId, status: NfseNsuStatus.RetryError }, _max: { lastAttemptAt: true } })
  ]);
  const counts = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
  const pendingGapCount = counts.PendingGap ?? 0;
  const retryErrorCount = counts.RetryError ?? 0;
  return {
    companyId: company.id,
    cnpj: company.cnpj,
    companyName: company.displayName,
    lastContiguousNsu: toNumber(checkpoint?.lastContiguousNsu),
    highestScannedNsu: toNumber(checkpoint?.highestScannedNsu),
    checkpointDistance: checkpoint ? Number(checkpoint.highestScannedNsu - checkpoint.lastContiguousNsu) : null,
    lastScanAt: toIso(checkpoint?.lastScanAt),
    lastDocumentDownloadedAt: toIso(checkpoint?.lastDocumentDownloadedAt),
    pendingGapCount,
    retryErrorCount,
    downloadedCount: counts.Downloaded ?? 0,
    ignoredCount: counts.IgnoredByRule ?? 0,
    totalAttempts: totals._sum.attempts ?? 0,
    oldestPendingNsu: toNumber(pendingAgg._min.nsu),
    newestPendingNsu: toNumber(pendingAgg._max.nsu),
    oldestPendingAt: toIso(pendingAgg._min.firstAttemptAt),
    lastAttemptAt: toIso(totals._max.lastAttemptAt),
    lastErrorAt: toIso(lastError._max.lastAttemptAt),
    processingStatus: processingStatus(Boolean(checkpoint || totals._count._all), retryErrorCount, pendingGapCount)
  };
}

export function buildNsuWhere(companyId: string, sp: URLSearchParams): Prisma.NfseNsuControlWhereInput {
  const where: Prisma.NfseNsuControlWhereInput = { companyId };
  const and: Prisma.NfseNsuControlWhereInput[] = [];
  const status = sp.get("status");
  if (status && Object.values(NfseNsuStatus).includes(status as NfseNsuStatus)) and.push({ status: status as NfseNsuStatus });
  if (sp.get("onlyGaps") === "true") and.push({ status: NfseNsuStatus.PendingGap });
  if (sp.get("onlyErrors") === "true") and.push({ status: NfseNsuStatus.RetryError });
  if (sp.get("onlyResolved") === "true") and.push({ status: { in: RESOLVED_NFSE_NSU_STATUSES as any } });
  const nsu: Prisma.BigIntFilter = {};
  if (sp.get("nsuFrom")) nsu.gte = BigInt(Number(sp.get("nsuFrom")));
  if (sp.get("nsuTo")) nsu.lte = BigInt(Number(sp.get("nsuTo")));
  if (Object.keys(nsu).length) and.push({ nsu });
  if (sp.get("minAttempts")) and.push({ attempts: { gte: Number(sp.get("minAttempts")) } });
  const first: Prisma.DateTimeFilter = {};
  if (sp.get("firstAttemptFrom")) first.gte = new Date(sp.get("firstAttemptFrom")!);
  if (sp.get("firstAttemptTo")) first.lte = new Date(sp.get("firstAttemptTo")!);
  if (Object.keys(first).length) and.push({ firstAttemptAt: first });
  const last: Prisma.DateTimeFilter = {};
  if (sp.get("lastAttemptFrom")) last.gte = new Date(sp.get("lastAttemptFrom")!);
  if (sp.get("lastAttemptTo")) last.lte = new Date(sp.get("lastAttemptTo")!);
  if (Object.keys(last).length) and.push({ lastAttemptAt: last });
  if (and.length) where.AND = and;
  return where;
}

export async function listCompanyNfseNsus(companyId: string, sp: URLSearchParams) {
  await assertCompanyExists(companyId);
  const { page: requestedPage, pageSize } = getPaginationParams(sp);
  const where = buildNsuWhere(companyId, sp);
  const total = await prisma.nfseNsuControl.count({ where });
  const pagination = getPaginationMetadata(total, requestedPage, pageSize);
  const sortMap: Record<string, keyof Prisma.NfseNsuControlOrderByWithRelationInput> = { nsu: "nsu", firstAttemptAt: "firstAttemptAt", lastAttemptAt: "lastAttemptAt", attempts: "attempts", status: "status" };
  const sortBy = sortMap[sp.get("sortBy") ?? ""] ?? "nsu";
  const sortDirection = sp.get("sortDirection") === "desc" ? "desc" : "asc";
  const items = await prisma.nfseNsuControl.findMany({ where, orderBy: { [sortBy]: sortDirection }, skip: (pagination.page - 1) * pageSize, take: pageSize });
  let laterResolved = new Set<string>();
  if (items.length) {
    const maxResolved = await prisma.nfseNsuControl.aggregate({ where: { companyId, status: { in: RESOLVED_NFSE_NSU_STATUSES as any } }, _max: { nsu: true } });
    if (maxResolved._max.nsu !== null) laterResolved = new Set(items.filter((i) => i.nsu < maxResolved._max.nsu!).map((i) => i.id));
  }
  let rows = items.map((item) => ({ ...serializeControl(item), hasLaterResolvedNsus: laterResolved.has(item.id) }));
  if (sp.get("onlyWithLaterResolvedNsus") === "true") rows = rows.filter((r) => r.hasLaterResolvedNsus);
  return { items: rows, pagination };
}
async function assertCompanyExists(companyId: string) { const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }); if (!company) throw new NfseNsuNotFoundError("Empresa não encontrada."); }

export async function listNsuAttempts(companyId: string, nsu: number) {
  const control = await prisma.nfseNsuControl.findUnique({ where: { companyId_nsu: { companyId, nsu: BigInt(nsu) } } });
  if (!control) throw new NfseNsuNotFoundError("NSU não encontrado para esta empresa.");
  const attempts = await prisma.nfseNsuAttempt.findMany({ where: { nsuControlId: control.id }, orderBy: { attemptedAt: "desc" } });
  return { items: attempts.map((a) => ({ attemptedAt: toIso(a.attemptedAt), resultStatus: a.resultStatus, httpStatus: a.httpStatus, errorMessage: a.errorMessage, wasNsuScanned: a.wasNsuScanned, documentId: a.documentId, accessKey: a.accessKey, ignoreReason: a.ignoreReason })) };
}

export async function listNfseNsuCompaniesReport(sp: URLSearchParams) {
  const { page: requestedPage, pageSize } = getPaginationParams(sp);
  const companyWhere: Prisma.CompanyWhereInput = {};
  const and: Prisma.CompanyWhereInput[] = [];
  if (sp.get("cnpj")) and.push({ cnpj: { contains: normalizeCnpj(sp.get("cnpj")!) } });
  if (sp.get("companyName")) and.push({ displayName: { contains: sp.get("companyName")!.trim(), mode: "insensitive" } });
  if (and.length) companyWhere.AND = and;
  const total = await prisma.company.count({ where: companyWhere });
  const pagination = getPaginationMetadata(total, requestedPage, pageSize);
  const companies = await prisma.company.findMany({ where: companyWhere, orderBy: { displayName: "asc" }, skip: (pagination.page - 1) * pageSize, take: pageSize });
  const summaries = Array.from((await buildSummariesForCompanies(companies)).values());
  let items = summaries.filter((s) => {
    if (sp.get("hasGaps") === "true" && s.pendingGapCount <= 0) return false;
    if (sp.get("hasErrors") === "true" && s.retryErrorCount <= 0) return false;
    if (sp.get("neverScanned") === "true" && s.processingStatus !== "NeverScanned") return false;
    if (sp.get("processingStatus") && s.processingStatus !== sp.get("processingStatus")) return false;
    if (sp.get("scannedSince") && (!s.lastScanAt || new Date(s.lastScanAt) < new Date(sp.get("scannedSince")!))) return false;
    if (sp.get("withoutDocumentDownloadedSince") && s.lastDocumentDownloadedAt && new Date(s.lastDocumentDownloadedAt) >= new Date(sp.get("withoutDocumentDownloadedSince")!)) return false;
    return true;
  });
  return { items, pagination: { ...pagination, total: items.length } };
}

export async function getNfseNsuDashboard() {
  const companies = await prisma.company.findMany({ select: { id: true, cnpj: true, displayName: true } });
  const summaries = Array.from((await buildSummariesForCompanies(companies)).values());
  const oldestGap = await prisma.nfseNsuControl.findFirst({ where: { status: NfseNsuStatus.PendingGap }, orderBy: { firstAttemptAt: "asc" } });
  return {
    totalCompanies: summaries.length,
    healthyCompanies: summaries.filter((s) => s.processingStatus === "Healthy").length,
    companiesWithGaps: summaries.filter((s) => s.processingStatus === "HasGaps").length,
    companiesWithErrors: summaries.filter((s) => s.processingStatus === "HasErrors").length,
    companiesNeverScanned: summaries.filter((s) => s.processingStatus === "NeverScanned").length,
    totalPendingGaps: summaries.reduce((sum, s) => sum + s.pendingGapCount, 0),
    totalRetryErrors: summaries.reduce((sum, s) => sum + s.retryErrorCount, 0),
    oldestPendingGapAt: toIso(oldestGap?.firstAttemptAt),
    oldestPendingGapCompanyId: oldestGap?.companyId ?? null,
    oldestPendingGapNsu: toNumber(oldestGap?.nsu),
    highestCheckpointDistance: Math.max(0, ...summaries.map((s) => s.checkpointDistance ?? 0))
  };
}

export async function getNfseNsuIntegrityReport() {
  const [badCheckpoints, invalidDates, counts, overCheckpoint, downloadedWithoutDocument] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; companyId: string; cnpj: string; nsu: bigint | null }>>`SELECT "id", "companyId", "cnpj", NULL::bigint AS "nsu" FROM "NfseNsuCheckpoint" WHERE "lastContiguousNsu" > "highestScannedNsu"`,
    prisma.$queryRaw<Array<{ id: string; companyId: string; cnpj: string; nsu: bigint }>>`SELECT "id", "companyId", "cnpj", "nsu" FROM "NfseNsuControl" WHERE "firstAttemptAt" > "lastAttemptAt"`,
    prisma.nfseNsuControl.findMany({ include: { _count: { select: { attemptsHistory: true } } } }),
    prisma.$queryRaw<Array<{ id: string; companyId: string; cnpj: string; nsu: bigint }>>`SELECT c."id", c."companyId", c."cnpj", c."nsu" FROM "NfseNsuControl" c JOIN "NfseNsuCheckpoint" cp ON cp."companyId" = c."companyId" WHERE c."nsu" > cp."highestScannedNsu"`,
    prisma.nfseNsuControl.findMany({ where: { status: NfseNsuStatus.Downloaded, documentId: null } })
  ]);
  const items: Array<Record<string, unknown>> = [];
  const push = (type: string, severity: string, row: any, message: string) => items.push({ type, severity, companyId: row.companyId, cnpj: row.cnpj, nsu: toNumber(row.nsu), message });
  badCheckpoints.forEach((r) => push("CHECKPOINT_INVALID_RANGE", "error", r, "LastContiguousNsu maior que HighestScannedNsu."));
  overCheckpoint.forEach((r) => push("NSU_OVER_HIGHEST_SCANNED", "warning", r, "NSU registrado maior que HighestScannedNsu."));
  downloadedWithoutDocument.forEach((r) => push("DOWNLOADED_WITHOUT_DOCUMENT", "warning", r, "Downloaded sem DocumentId."));
  invalidDates.forEach((r) => push("INVALID_ATTEMPT_DATES", "error", r, "FirstAttemptAt maior que LastAttemptAt."));
  counts.filter((r) => r.attempts !== r._count.attemptsHistory).forEach((r) => push("ATTEMPTS_COUNT_MISMATCH", "error", r, "Attempts diferente da quantidade de históricos."));
  return { items };
}

export async function getCompanySummariesMap(companyIds: string[]) {
  const companies = await prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, cnpj: true, displayName: true } });
  return buildSummariesForCompanies(companies);
}
