import { InvoiceStatus, Prisma, SupplierRiskLevel, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllowedSupplierIds } from "@/lib/auth";

export const APPROVAL_SLA_HOURS = 48;

export type ReportsScope = { role: UserRole; allowedSupplierIds?: string[] };

export function getReportsScope(manager: { role: UserRole; managerSuppliers: { supplierId: string }[] }): ReportsScope {
  return manager.role === "ADMIN" ? { role: manager.role } : { role: manager.role, allowedSupplierIds: getAllowedSupplierIds(manager as never) };
}

export function parseFilters(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  return {
    from: p.get("from") ? new Date(`${p.get("from")}T00:00:00`) : undefined,
    to: p.get("to") ? new Date(`${p.get("to")}T23:59:59`) : undefined,
    supplierId: p.get("supplierId") || undefined,
    managerId: p.get("managerId") || undefined,
    status: (p.get("status") as InvoiceStatus | null) || undefined,
    risk: (p.get("risk") as SupplierRiskLevel | null) || undefined,
    categoryId: p.get("categoryId") || undefined,
    search: p.get("search") || undefined
  };
}

export function invoiceWhere(scope: ReportsScope, filters: ReturnType<typeof parseFilters>): Prisma.InvoiceWhereInput {
  return {
    ...(scope.role !== "ADMIN" ? { fornecedorId: { in: scope.allowedSupplierIds } } : {}),
    ...(filters.supplierId ? { fornecedorId: filters.supplierId } : {}),
    ...(filters.managerId ? { criadoPorId: filters.managerId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to ? { createdAt: { gte: filters.from, lte: filters.to } } : {}),
    ...(filters.risk || filters.categoryId ? {
      serviceEvaluation: filters.risk ? { is: { riskLevel: filters.risk } } : undefined,
      fornecedor: filters.categoryId ? { categoryLinks: { some: { categoryId: filters.categoryId } } } : undefined
    } : {})
  };
}

export async function loadInvoices(scope: ReportsScope, filters: ReturnType<typeof parseFilters>) {
  return prisma.invoice.findMany({
    where: invoiceWhere(scope, filters),
    include: { fornecedor: true, criadoPor: true, serviceEvaluation: true, auditLogs: true },
    orderBy: { createdAt: "desc" }
  });
}
