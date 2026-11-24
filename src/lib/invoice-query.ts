import { FiscalProtocolStatus, InvoiceStatus, Prisma, type WorkflowDocumentType } from "@prisma/client";
import type { getSessionManager } from "@/lib/auth";
import { invoicesAvailableForApproval, legacyInvoiceTypes } from "@/lib/invoice-admin-review-access";
import { isDocumentType } from "@/lib/workflow/field-catalog";
import { globalWorkflowTypes } from "@/lib/workflow/access";
import { prisma } from "@/lib/prisma";

type SessionManager = NonNullable<Awaited<ReturnType<typeof getSessionManager>>>;

function parseDay(value: string | null, endOfDay = false) {
  if (!value) return null;

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Builds the invoice scope and filters shared by the notes list and its export. */
export function buildInvoiceWhere(manager: SessionManager, searchParams: URLSearchParams, globalTypes: WorkflowDocumentType[] = []): Prisma.InvoiceWhereInput {
  const linkedSupplier = { fornecedor: { managerSuppliers: { some: { managerId: manager.id } } } } satisfies Prisma.InvoiceWhereInput;
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
        ? { OR: [{ criadoPorId: manager.id, ...legacyInvoiceTypes }, { documentType: { in: ["NFE", "CTE"] }, ...linkedSupplier }] }
        : { OR: [
            linkedSupplier,
            { workflowExecution: { is: { tasks: { some: { managerId: manager.id, completedAt: null } } } } },
            { documentType: { in: globalTypes } },
            ...(globalTypes.includes("NFSE") ? [{ documentType: null }] : [])
          ] };
  const filters: Prisma.InvoiceWhereInput[] = [scopeWhere];

  // Durante um workflow ativo, a nota aparece apenas para quem possui uma
  // tarefa pendente no momento. O vínculo permanente com o fornecedor segue
  // permitindo consultar notas fora de um workflow ativo.
  if (manager.role === "GESTOR") {
    filters.push({
      OR: [
        { workflowExecution: { isNot: { status: "ACTIVE" } } },
        { workflowExecution: { is: { status: "ACTIVE", tasks: { some: { managerId: manager.id, completedAt: null } } } } }
      ]
    });
  }

  if (searchParams.get("myApprovals") === "true") {
    filters.push({ workflowExecution: { is: { status: "ACTIVE", tasks: { some: { managerId: manager.id, completedAt: null } } } } });
  }

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

  const type = searchParams.get("documentType");
  if (isDocumentType(type)) filters.push(type === "NFSE" ? { OR: [{ documentType: "NFSE" }, { documentType: null }] } : { documentType: type });
  const fiscalStatus = searchParams.get("fiscalStatus");
  if (fiscalStatus && Object.hasOwn(FiscalProtocolStatus, fiscalStatus)) filters.push({ fiscalStatus: fiscalStatus as FiscalProtocolStatus });
  const workflow = searchParams.get("workflowStatus");
  if (workflow === "WAITING") filters.push({ workflowExecution: null });
  if (workflow === "ACTIVE" || workflow === "BLOCKED" || workflow === "COMPLETED") filters.push({ workflowExecution: { is: { status: workflow } } });
  const review = searchParams.get("reviewStatus");
  if (review === "PENDENTE" || review === "LIBERADA" || review === "IGNORADA") filters.push({ adminReview: { is: { status: review } } });
  if (manager.role !== "ADMIN" || !["PENDENTE", "LIBERADA", "IGNORADA"].includes(review ?? "")) filters.push(invoicesAvailableForApproval());
  return { AND: filters };
}

/** Use the same scope for a direct URL, XML, history and links as for the list. */
export async function visibleInvoiceWhere(manager: SessionManager, db: Prisma.TransactionClient = prisma): Promise<Prisma.InvoiceWhereInput> {
  if (manager.role === "ADMIN") return {};
  const types = manager.role === "GESTOR" ? await globalWorkflowTypes(manager.id, db) : [];
  return buildInvoiceWhere(manager, new URLSearchParams(), types);
}

export async function canReadInvoice(manager: SessionManager, id: string) {
  return Boolean(await prisma.invoice.findFirst({ where: { id, AND: [await visibleInvoiceWhere(manager)] }, select: { id: true } }));
}

