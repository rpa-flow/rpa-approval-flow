import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { APPROVAL_SLA_HOURS, getReportsScope, loadInvoices, parseFilters } from "@/lib/reports";
import { slaEvolution } from "@/lib/reports-aggregations";

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const filters = parseFilters(request);
  const invoices = await loadInvoices(getReportsScope(manager), filters);
  const monthly = slaEvolution(invoices, APPROVAL_SLA_HOURS);
  const approved = invoices.filter((invoice) => invoice.status === "APROVADO");

  const ranking = approved
    .map((invoice) => {
      const approvalAt = invoice.dataValidacao ?? invoice.dataAtualizacao;
      const approvalHours = (approvalAt.getTime() - invoice.createdAt.getTime()) / 3600000;
      return {
        invoiceId: invoice.id,
        numeroNota: invoice.numeroNota,
        fornecedor: invoice.fornecedor.nome,
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
    outOfSlaCount: ranking.filter((item) => item.outOfSla).length,
    ranking
  });
}
