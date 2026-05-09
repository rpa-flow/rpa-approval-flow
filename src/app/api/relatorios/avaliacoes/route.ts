import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { getReportsScope, loadInvoices, parseFilters } from "@/lib/reports";

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const filters = parseFilters(request);
  const invoices = await loadInvoices(getReportsScope(manager), filters);

  const evaluated = invoices.filter((invoice) => invoice.serviceEvaluation);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const risks = { ALTO: 0, MEDIO: 0, BAIXO: 0 };
  const suppliers = new Map<string, {
    supplierId: string;
    supplierName: string;
    totalInvoices: number;
    evaluatedInvoices: number;
    ratingSum: number;
    avgRating: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  }>();

  for (const invoice of invoices) {
    const key = invoice.fornecedorId;
    const base = suppliers.get(key) ?? {
      supplierId: key,
      supplierName: invoice.fornecedor.nome,
      totalInvoices: 0,
      evaluatedInvoices: 0,
      ratingSum: 0,
      avgRating: 0,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0
    };

    base.totalInvoices += 1;

    if (invoice.serviceEvaluation) {
      const rating = Math.max(1, Math.min(5, invoice.serviceEvaluation.rating));
      distribution[rating as 1 | 2 | 3 | 4 | 5] += 1;
      base.evaluatedInvoices += 1;
      base.ratingSum += rating;

      if (invoice.serviceEvaluation.riskLevel === "ALTO") {
        risks.ALTO += 1;
        base.highRisk += 1;
      } else if (invoice.serviceEvaluation.riskLevel === "MEDIO") {
        risks.MEDIO += 1;
        base.mediumRisk += 1;
      } else {
        risks.BAIXO += 1;
        base.lowRisk += 1;
      }
    }

    suppliers.set(key, base);
  }

  const supplierRanking = Array.from(suppliers.values()).map((supplier) => ({
    ...supplier,
    avgRating: supplier.evaluatedInvoices ? Number((supplier.ratingSum / supplier.evaluatedInvoices).toFixed(2)) : 0,
    evaluationCoverage: supplier.totalInvoices ? Number(((supplier.evaluatedInvoices / supplier.totalInvoices) * 100).toFixed(2)) : 0
  })).sort((a, b) => b.avgRating - a.avgRating);

  return NextResponse.json({
    summary: {
      totalInvoices: invoices.length,
      totalEvaluated: evaluated.length,
      averageRating: evaluated.length ? Number((evaluated.reduce((sum, i) => sum + (i.serviceEvaluation?.rating ?? 0), 0) / evaluated.length).toFixed(2)) : 0,
      highRiskEvaluations: risks.ALTO
    },
    distribution,
    risks,
    supplierRanking
  });
}
