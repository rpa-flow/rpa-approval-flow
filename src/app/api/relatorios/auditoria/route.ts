import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { APPROVAL_SLA_HOURS, getReportsScope, isInvoiceLaunched, loadInvoices, parseFilters } from "@/lib/reports";

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const filters = parseFilters(request);
  const invoices = await loadInvoices(getReportsScope(manager), filters);
  const total = invoices.length;
  const approved = invoices.filter((i) => i.status === "APROVADO");
  const refused = invoices.filter((i) => i.status === "RECUSADO");
  const processed = invoices.filter((i) => isInvoiceLaunched(i));
  const pending = invoices.filter((i) => i.status === "AGUARDANDO_APROVACAO");
  const avgHours = approved.length ? approved.reduce((s, i) => s + ((new Date(i.dataValidacao || i.dataAtualizacao).getTime() - new Date(i.createdAt).getTime()) / 3600000), 0) / approved.length : 0;
  const totalValue = invoices.reduce((s, i) => s + Number(i.valorServico || 0), 0);
  const highRisk = invoices.filter((i) => i.serviceEvaluation?.riskLevel === "ALTO");

  return NextResponse.json({ total, approved: approved.length, refused: refused.length, processed: processed.length, pending: pending.length, avgHours, totalValue, highRisk: highRisk.length, slaHours: APPROVAL_SLA_HOURS, invoices });
}
