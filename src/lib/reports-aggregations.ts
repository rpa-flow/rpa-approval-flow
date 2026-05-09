import { InvoiceStatus } from "@prisma/client";
import { isInvoiceLaunched } from "@/lib/reports";

type InvoiceLike = {
  id: string;
  numeroNota: string;
  createdAt: Date;
  dataValidacao: Date | null;
  dataAtualizacao: Date;
  status: InvoiceStatus;
  processada: boolean;
  dataLancamentoDelphi?: Date | null;
  codigoDelphi?: string | null;
  fornecedor: { nome: string };
  criadoPor: { nome: string } | null;
};

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function createdVsProcessedByMonth(invoices: InvoiceLike[]) {
  const map = new Map<string, { month: string; created: number; processed: number }>();
  for (const inv of invoices) {
    const key = monthKey(inv.createdAt);
    const row = map.get(key) ?? { month: key, created: 0, processed: 0 };
    row.created += 1;
    if (isInvoiceLaunched(inv)) row.processed += 1;
    map.set(key, row);
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({
    ...row,
    difference: row.created - row.processed,
    conversionRate: row.created ? Number(((row.processed / row.created) * 100).toFixed(2)) : 0
  }));
}

export function slaEvolution(invoices: InvoiceLike[], slaHours: number) {
  const approved = invoices.filter((i) => i.status === "APROVADO" && (i.dataValidacao || i.dataAtualizacao));
  const monthly = new Map<string, { month: string; total: number; outOfSla: number; avgApprovalHours: number }>();
  for (const inv of approved) {
    const approvalAt = inv.dataValidacao ?? inv.dataAtualizacao;
    const key = monthKey(approvalAt);
    const row = monthly.get(key) ?? { month: key, total: 0, outOfSla: 0, avgApprovalHours: 0 };
    const hours = (approvalAt.getTime() - inv.createdAt.getTime()) / 3600000;
    row.total += 1;
    row.avgApprovalHours += hours;
    if (hours > slaHours) row.outOfSla += 1;
    monthly.set(key, row);
  }

  return Array.from(monthly.values()).sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({
    ...r,
    avgApprovalHours: r.total ? Number((r.avgApprovalHours / r.total).toFixed(2)) : 0,
    outOfSlaRate: r.total ? Number(((r.outOfSla / r.total) * 100).toFixed(2)) : 0
  }));
}
