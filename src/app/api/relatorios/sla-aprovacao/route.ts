import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { canViewReports, APPROVAL_SLA_HOURS, getReportsScope, invoiceWhere, parseFilters } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { approvalTiming, slaEvolution } from "@/lib/reports-aggregations";

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!canViewReports(manager)) return NextResponse.json({ error: "Acesso aos relatórios não permitido." }, { status: 403 });

  const filters = parseFilters(request);
  const invoices = await prisma.invoice.findMany({
    where: {
      ...invoiceWhere(getReportsScope(manager), { ...filters, from: undefined, to: undefined, status: undefined }),
      status: { in: ["APROVADO", "PROCESSADO"] }
    },
    include: { fornecedor: true, criadoPor: true, serviceEvaluation: true, auditLogs: true, statusHistory: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
  const inApprovalPeriod = invoices.filter((invoice) => {
    const { approvalAt } = approvalTiming(invoice);
    return (!filters.from || approvalAt >= filters.from) && (!filters.to || approvalAt <= filters.to);
  });
  const monthly = slaEvolution(inApprovalPeriod, APPROVAL_SLA_HOURS);
  const approved = inApprovalPeriod;

  const ranking = approved
    .map((invoice) => {
      const { approvalHours } = approvalTiming(invoice);
      return {
        invoiceId: invoice.id,
        numeroNota: invoice.numeroNota,
        fornecedor: invoice.fornecedor?.nome ?? "Fornecedor pendente",
        gestor: invoice.criadoPor?.nome ?? "Não informado",
        approvalHours: Number(approvalHours.toFixed(2)),
        outOfSla: approvalHours > APPROVAL_SLA_HOURS
      };
    })
    .sort((a, b) => b.approvalHours - a.approvalHours)
    .slice(0, 10);

  return NextResponse.json({
    slaHours: APPROVAL_SLA_HOURS,
    monthly,
    outOfSlaCount: monthly.reduce((total, row) => total + row.outOfSla, 0),
    ranking
  });
}
