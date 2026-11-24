import type { Prisma } from "@prisma/client";

export async function fiscalDetail(tx: Prisma.TransactionClient, invoiceId: string, admin: boolean, scope: Prisma.InvoiceWhereInput) {
  const [current, versions, incoming, cycles] = await Promise.all([
    tx.fiscalDocumentVersion.findFirst({ where: { invoiceId, state: "CURRENT" }, select: {
      nfe: { select: { data: true } }, cte: { select: { data: true } },
      references: { select: { kind: true, targetKey: true, targetInvoiceId: true } }
    } }),
    tx.fiscalDocumentVersion.findMany({ where: { invoiceId, ...(admin ? {} : { state: { in: ["CURRENT", "ARCHIVED"] } }) },
      select: { id: true, state: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    tx.fiscalDocumentReference.findMany({ where: { targetInvoiceId: invoiceId, kind: "SUBSTITUTES_CTE", sourceVersion: { state: "CURRENT" } },
      select: { sourceVersion: { select: { invoice: { select: { id: true, codigoIdentificador: true } } } } } }),
    tx.invoiceWorkflow.findMany({ where: { invoiceId }, select: { id: true, status: true, versionId: true, documentVersionId: true,
      createdAt: true, completedAt: true }, orderBy: { createdAt: "desc" } })
  ]);
  const references = [...current?.references ?? [], ...incoming.map(r => ({ kind: "SUBSTITUTED_BY" as const,
    targetKey: r.sourceVersion.invoice.codigoIdentificador, targetInvoiceId: r.sourceVersion.invoice.id }))];
  const ids = references.flatMap(r => r.targetInvoiceId ? [r.targetInvoiceId] : []);
  const readable = new Set(ids.length ? (await tx.invoice.findMany({ where: { id: { in: ids }, AND: [scope] },
    select: { id: true } })).map(i => i.id) : []);
  return { detail: current?.nfe?.data ?? current?.cte?.data ?? null, versions, cycles,
    references: references.filter(r => r.kind !== "SUBSTITUTED_BY" || (r.targetInvoiceId && readable.has(r.targetInvoiceId))).map(r => ({
      ...r, targetInvoiceId: r.targetInvoiceId && readable.has(r.targetInvoiceId) ? r.targetInvoiceId : null
    })) };
}
