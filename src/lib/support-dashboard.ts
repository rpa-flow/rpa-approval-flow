import { DelphiIntegrationStatus, InvoiceSituation, InvoiceStatus, NfseNsuStatus, Prisma, ProcessingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TIME_ZONE = "America/Sao_Paulo";
const LIST_LIMIT = 50;

export type SupportDashboard = {
  generatedAt: string;
  filters: { periodDays: number; dueDays: number; timeZone: string };
  download: {
    currentRetryErrors: number;
    pendingGaps: number;
    errorsInPeriod: number;
    affectedCompanies: number;
    successInPeriod: number;
    errorRatePct: number;
    byDay: Array<{ date: string; errors: number; downloads: number }>;
    recentErrors: Array<{
        companyId: string;
        companyName: string;
        nsu: string;
        attempts: number;
        httpStatus: number | null;
        message: string | null;
        attemptedAt: string;
      }>;
  };
  due: {
    overdueCount: number;
    dueTodayCount: number;
    dueSoonCount: number;
    withoutDueDateCount: number;
    totalValueDueSoon: string;
    items: Array<{
      id: string;
      numeroNota: string;
      supplierName: string;
      dataPagamento: string;
      daysUntilDue: number;
      status: InvoiceStatus;
      valorServico: string | null;
    }>;
  };
  health: {
    totalCompanies: number;
    healthyCompanies: number;
    companiesWithErrors: number;
    companiesWithGaps: number;
    companiesNeverScanned: number;
    staleCompanies: number;
    totalPendingGaps: number;
    totalRetryErrors: number;
    invoicesProcessingError: number;
    delphiFailures: number;
  };
};

type ActivityBucket = { date: Date | string; errors: bigint | number; downloads: bigint | number };

function saoPauloDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dateAtSaoPauloMidnight(dateKey: string) {
  // O Brasil não observa horário de verão desde 2019; os dados operacionais deste painel são atuais.
  return new Date(`${dateKey}T00:00:00-03:00`);
}

function shiftDateKey(dateKey: string, days: number) {
  const date = dateAtSaoPauloMidnight(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return saoPauloDateKey(date);
}

function dayDifference(dateKey: string, todayKey: string) {
  return Math.round(
    (dateAtSaoPauloMidnight(dateKey).getTime() - dateAtSaoPauloMidnight(todayKey).getTime()) / 86_400_000
  );
}

export async function getSupportDashboard(
  filters: { periodDays: number; dueDays: number },
  now = new Date()
): Promise<SupportDashboard> {
  const todayKey = saoPauloDateKey(now);
  const historyStartKey = shiftDateKey(todayKey, -(filters.periodDays - 1));
  const dueEndKey = shiftDateKey(todayKey, filters.dueDays);
  const historyStart = dateAtSaoPauloMidnight(historyStartKey);
  const today = dateAtSaoPauloMidnight(todayKey);
  const dueEndExclusive = dateAtSaoPauloMidnight(shiftDateKey(dueEndKey, 1));
  const recentScanThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const excludedStatuses: InvoiceStatus[] = [
    InvoiceStatus.PROCESSADO,
    InvoiceStatus.RECUSADO,
    InvoiceStatus.EXPIRADA
  ];
  const dueWhere: Prisma.InvoiceWhereInput = {
    dataPagamento: { not: null, lt: dueEndExclusive },
    status: { notIn: excludedStatuses },
    situacaoNotaFiscal: { not: InvoiceSituation.CANCELADA }
  };

  const [
    activityBuckets,
    currentErrorTotal,
    currentErrors,
    overdueCount,
    dueTodayCount,
    dueSoonCount,
    withoutDueDateCount,
    dueValue,
    dueInvoices,
    activeCompanies,
    checkpoints,
    companyErrorGroups,
    companyGapGroups,
    pendingGaps,
    invoicesProcessingError,
    delphiFailures
  ] = await Promise.all([
    prisma.$queryRaw<ActivityBucket[]>(Prisma.sql`
      SELECT DATE("attemptedAt" AT TIME ZONE ${TIME_ZONE}) AS "date",
        COUNT(*) FILTER (WHERE "resultStatus" = ${NfseNsuStatus.RetryError}::"NfseNsuStatus")::bigint AS "errors",
        COUNT(*) FILTER (WHERE "resultStatus" = ${NfseNsuStatus.Downloaded}::"NfseNsuStatus")::bigint AS "downloads"
      FROM "NfseNsuAttempt"
      WHERE "attemptedAt" >= ${historyStart}
        AND "resultStatus" IN (${NfseNsuStatus.RetryError}::"NfseNsuStatus", ${NfseNsuStatus.Downloaded}::"NfseNsuStatus")
      GROUP BY DATE("attemptedAt" AT TIME ZONE ${TIME_ZONE})
      ORDER BY "date" ASC
    `),
    prisma.nfseNsuControl.count({ where: { status: NfseNsuStatus.RetryError } }),
    prisma.nfseNsuControl.findMany({
      where: { status: NfseNsuStatus.RetryError },
      select: {
        id: true,
        companyId: true,
        nsu: true,
        attempts: true,
        lastHttpStatus: true,
        lastError: true,
        lastAttemptAt: true,
        company: { select: { displayName: true } }
      },
      orderBy: { lastAttemptAt: "desc" },
      take: LIST_LIMIT
    }),
    prisma.invoice.count({ where: { ...dueWhere, dataPagamento: { not: null, lt: today } } }),
    prisma.invoice.count({ where: { ...dueWhere, dataPagamento: { gte: today, lt: dateAtSaoPauloMidnight(shiftDateKey(todayKey, 1)) } } }),
    prisma.invoice.count({ where: { ...dueWhere, dataPagamento: { gte: dateAtSaoPauloMidnight(shiftDateKey(todayKey, 1)), lt: dueEndExclusive } } }),
    prisma.invoice.count({
      where: { dataPagamento: null, status: { notIn: excludedStatuses }, situacaoNotaFiscal: { not: InvoiceSituation.CANCELADA } }
    }),
    prisma.invoice.aggregate({ where: dueWhere, _sum: { valorServico: true } }),
    prisma.invoice.findMany({
      where: dueWhere,
      select: {
        id: true,
        numeroNota: true,
        dataPagamento: true,
        valorServico: true,
        status: true,
        fornecedor: { select: { nome: true } }
      },
      orderBy: [{ dataPagamento: "asc" }, { createdAt: "asc" }],
      take: LIST_LIMIT
    }),
    prisma.company.count({ where: { active: true } }),
    prisma.nfseNsuCheckpoint.findMany({ where: { company: { active: true } }, select: { companyId: true, lastScanAt: true } }),
    prisma.nfseNsuControl.groupBy({ by: ["companyId"], where: { status: NfseNsuStatus.RetryError, company: { active: true } } }),
    prisma.nfseNsuControl.groupBy({ by: ["companyId"], where: { status: NfseNsuStatus.PendingGap, company: { active: true } } }),
    prisma.nfseNsuControl.count({ where: { status: NfseNsuStatus.PendingGap, company: { active: true } } }),
    prisma.invoice.count({ where: { statusProcessamento: ProcessingStatus.ERRO } }),
    prisma.invoice.count({ where: { statusIntegracaoDelphi: DelphiIntegrationStatus.FALHA } })
  ]);

  const bucketMap = new Map(
    activityBuckets.map((bucket) => {
      // PostgreSQL devolve `date` como meia-noite UTC; preserve a data civil agregada.
      const key = typeof bucket.date === "string" ? bucket.date.slice(0, 10) : bucket.date.toISOString().slice(0, 10);
      return [key, { errors: Number(bucket.errors), downloads: Number(bucket.downloads) }];
    })
  );
  const byDay = Array.from({ length: filters.periodDays }, (_, index) => {
    const date = shiftDateKey(historyStartKey, index);
    return { date, errors: bucketMap.get(date)?.errors ?? 0, downloads: bucketMap.get(date)?.downloads ?? 0 };
  });
  const errorsInPeriod = byDay.reduce((total, bucket) => total + bucket.errors, 0);
  const successInPeriod = byDay.reduce((total, bucket) => total + bucket.downloads, 0);
  const activeCompanyIdsWithCheckpoint = new Set(checkpoints.map((checkpoint) => checkpoint.companyId));
  const companiesNeverScanned = activeCompanies - activeCompanyIdsWithCheckpoint.size + checkpoints.filter((item) => !item.lastScanAt).length;
  const staleCompanies = checkpoints.filter((item) => item.lastScanAt && item.lastScanAt < recentScanThreshold).length;
  const unhealthyCompanyIds = new Set([...companyErrorGroups, ...companyGapGroups].map((item) => item.companyId));

  return {
    generatedAt: now.toISOString(),
    filters: { ...filters, timeZone: TIME_ZONE },
    download: {
      currentRetryErrors: currentErrorTotal,
      pendingGaps,
      errorsInPeriod,
      affectedCompanies: companyErrorGroups.length,
      successInPeriod,
      errorRatePct: errorsInPeriod + successInPeriod === 0 ? 0 : (errorsInPeriod / (errorsInPeriod + successInPeriod)) * 100,
      byDay,
      recentErrors: currentErrors.map((error) => ({
          companyId: error.companyId,
          companyName: error.company.displayName,
          nsu: error.nsu.toString(),
          attempts: error.attempts,
          httpStatus: error.lastHttpStatus,
          message: error.lastError,
          attemptedAt: error.lastAttemptAt.toISOString()
        }))
    },
    due: {
      overdueCount,
      dueTodayCount,
      dueSoonCount,
      withoutDueDateCount,
      totalValueDueSoon: dueValue._sum.valorServico?.toString() ?? "0",
      items: dueInvoices.map((invoice) => {
        const dueDate = saoPauloDateKey(invoice.dataPagamento!);
        return {
          id: invoice.id,
          numeroNota: invoice.numeroNota,
          supplierName: invoice.fornecedor.nome,
          dataPagamento: invoice.dataPagamento!.toISOString(),
          daysUntilDue: dayDifference(dueDate, todayKey),
          status: invoice.status,
          valorServico: invoice.valorServico?.toString() ?? null
        };
      })
    },
    health: {
      totalCompanies: activeCompanies,
      healthyCompanies: Math.max(0, activeCompanies - new Set([...unhealthyCompanyIds, ...checkpoints.filter((item) => !item.lastScanAt || item.lastScanAt < recentScanThreshold).map((item) => item.companyId)]).size - (activeCompanies - activeCompanyIdsWithCheckpoint.size)),
      companiesWithErrors: companyErrorGroups.length,
      companiesWithGaps: companyGapGroups.length,
      companiesNeverScanned,
      staleCompanies,
      totalPendingGaps: pendingGaps,
      totalRetryErrors: currentErrorTotal,
      invoicesProcessingError,
      delphiFailures
    }
  };
}
