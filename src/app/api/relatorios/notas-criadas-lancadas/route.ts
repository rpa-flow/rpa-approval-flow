import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { getReportsScope, loadInvoices, parseFilters } from "@/lib/reports";
import { createdVsProcessedByMonth } from "@/lib/reports-aggregations";

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const filters = parseFilters(request);
  const invoices = await loadInvoices(getReportsScope(manager), filters);
  const monthly = createdVsProcessedByMonth(invoices);

  const totals = monthly.reduce((acc, row) => ({
    created: acc.created + row.created,
    processed: acc.processed + row.processed
  }), { created: 0, processed: 0 });

  return NextResponse.json({
    summary: {
      created: totals.created,
      processed: totals.processed,
      difference: totals.created - totals.processed,
      conversionRate: totals.created ? Number(((totals.processed / totals.created) * 100).toFixed(2)) : 0
    },
    monthly
  });
}
