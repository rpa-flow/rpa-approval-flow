import { InvoiceStatus, Prisma } from "@prisma/client";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";

type SessionManager = NonNullable<Awaited<ReturnType<typeof getSessionManager>>>;

function parseDay(value: string | null, endOfDay = false) {
  if (!value) return null;

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Builds the invoice scope and filters shared by the notes list and its export. */
export function buildInvoiceWhere(manager: SessionManager, searchParams: URLSearchParams): Prisma.InvoiceWhereInput {
  const allowedSupplierIds = getAllowedSupplierIds(manager);
  const statusParam = searchParams.get("status");
  const supplierId = searchParams.get("supplierId");
  const taker = searchParams.get("taker")?.trim();
  const responsible = searchParams.get("responsible")?.trim();
  const updatedFrom = parseDay(searchParams.get("updatedFrom"));
  const updatedTo = parseDay(searchParams.get("updatedTo"), true);
  const issueFrom = parseDay(searchParams.get("issueFrom"));
  const issueTo = parseDay(searchParams.get("issueTo"), true);
  const competenceFrom = parseDay(searchParams.get("competenceFrom"));
  const competenceTo = parseDay(searchParams.get("competenceTo"), true);

  const scopeWhere: Prisma.InvoiceWhereInput =
    manager.role === "ADMIN"
      ? {}
      : manager.role === "FORNECEDOR"
        ? { criadoPorId: manager.id }
        : { fornecedorId: { in: allowedSupplierIds } };
  const filters: Prisma.InvoiceWhereInput[] = [scopeWhere];

  if (statusParam === "LANCADAS") {
    filters.push({ OR: [{ status: InvoiceStatus.PROCESSADO }, { dataLancamentoDelphi: { not: null } }] });
  } else if (statusParam && Object.values(InvoiceStatus).includes(statusParam as InvoiceStatus)) {
    filters.push({ status: statusParam as InvoiceStatus });
  }

  if (supplierId && supplierId !== "TODOS") filters.push({ fornecedorId: supplierId });
  if (taker) filters.push({ tomadorNome: { contains: taker, mode: "insensitive" } });
  if (responsible && responsible !== "TODOS") {
    filters.push({
      OR: [
        { responsavelValidacao: { contains: responsible, mode: "insensitive" } },
        { fornecedor: { managerSuppliers: { some: { manager: { nome: { contains: responsible, mode: "insensitive" } } } } } }
      ]
    });
  }

  if (updatedFrom || updatedTo) filters.push({ dataAtualizacao: { ...(updatedFrom ? { gte: updatedFrom } : {}), ...(updatedTo ? { lte: updatedTo } : {}) } });
  if (issueFrom || issueTo) filters.push({ dataEmissao: { ...(issueFrom ? { gte: issueFrom } : {}), ...(issueTo ? { lte: issueTo } : {}) } });
  if (competenceFrom || competenceTo) filters.push({ dataCompetencia: { ...(competenceFrom ? { gte: competenceFrom } : {}), ...(competenceTo ? { lte: competenceTo } : {}) } });

  return { AND: filters };
}
