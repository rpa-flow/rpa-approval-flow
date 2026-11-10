import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { buildInvoiceWhere } from "@/lib/invoice-query";
import { getPaginationMetadata, getPaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { hasGlobalNfseWorkflowAccess } from "@/lib/workflow/access";

function shouldIncludeXml(request: NextRequest) {
  return request.nextUrl.searchParams.get("includeXml") === "true";
}

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const includeXml = shouldIncludeXml(request);
  const { page: requestedPage, pageSize } = getPaginationParams(request.nextUrl.searchParams);
  const globalAccess = manager.role === "GESTOR" && await hasGlobalNfseWorkflowAccess(manager.id);
  const showMyApprovals = request.nextUrl.searchParams.get("myApprovals") === "true";
  const where = buildInvoiceWhere(manager, request.nextUrl.searchParams, globalAccess);
  const allNotesParams = new URLSearchParams(request.nextUrl.searchParams);
  allNotesParams.delete("myApprovals");
  const allNotesWhere = buildInvoiceWhere(manager, allNotesParams, globalAccess);
  const myApprovalsWhere: Prisma.InvoiceWhereInput = { workflowExecution: { is: { status: "ACTIVE", tasks: { some: { managerId: manager.id, completedAt: null } } } } };
  const supplierWhere: Prisma.SupplierWhereInput =
    manager.role === "ADMIN"
      ? {}
      : manager.role === "FORNECEDOR"
        ? { invoices: { some: { criadoPorId: manager.id } } }
        : { id: { in: getAllowedSupplierIds(manager) } };

  const managerWhere: Prisma.ManagerWhereInput =
    manager.role === "ADMIN"
      ? { ativo: true }
      : manager.role === "FORNECEDOR"
        ? { managerSuppliers: { some: { supplier: { invoices: { some: { criadoPorId: manager.id } } } } }, ativo: true }
        : { managerSuppliers: { some: { supplierId: { in: getAllowedSupplierIds(manager) } } }, ativo: true };

  const [total, allNotesTotal, myApprovalsTotal, supplierOptions, managerOptions] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.count({ where: allNotesWhere }),
    prisma.invoice.count({ where: { AND: [allNotesWhere, myApprovalsWhere] } }),
    prisma.supplier.findMany({
      where: supplierWhere,
      select: { id: true, nome: true },
      orderBy: { nome: "asc" }
    }),
    prisma.manager.findMany({
      where: managerWhere,
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
      distinct: ["nome"]
    })
  ]);

  const pagination = getPaginationMetadata(total, requestedPage, pageSize);
  const activeTaskSelect = { managerId: true, managerName: true, assignedAt: true, step: { select: { name: true, fields: { select: { fieldKey: true, mode: true } } } } } as const;
  const assignedTaskPages = showMyApprovals
    ? await prisma.invoiceWorkflowTask.findMany({
      where: { managerId: manager.id, completedAt: null, execution: { is: { status: "ACTIVE", invoice: { is: allNotesWhere } } } },
      select: { execution: { select: { invoiceId: true } } },
      orderBy: { assignedAt: "asc" },
      skip: (pagination.page - 1) * pageSize,
      take: pageSize
    })
    : null;
  const assignedInvoiceIds = assignedTaskPages?.map((task) => task.execution.invoiceId) ?? [];
  const invoices = await prisma.invoice.findMany({
    where: assignedTaskPages ? { id: { in: assignedInvoiceIds } } : where,
    include: {
      adminReview: { select: { status: true, valorConfirmado: true } },
      workflowExecution: { select: { status: true, tasks: { where: { completedAt: null }, select: activeTaskSelect, take: 1 } } },
      fornecedor: {
        select: {
          id: true,
          nome: true,
          cnpj: true,
          codigoExterno: true,
          managerSuppliers: {
            select: {
              manager: {
                select: { nome: true }
              }
            }
          }
        }
      }
    },
    ...(assignedTaskPages ? {} : { orderBy: [{ dataAtualizacao: "desc" as const }, { dataEmissao: "desc" as const }], skip: (pagination.page - 1) * pageSize, take: pageSize })
  });

  if (assignedTaskPages) {
    const order = new Map(assignedInvoiceIds.map((id, index) => [id, index]));
    invoices.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  }

  const companyCnpjs = Array.from(new Set(invoices.map((invoice) => invoice.tomadorCnpj).filter((cnpj): cnpj is string => Boolean(cnpj))));
  const companies = companyCnpjs.length
    ? await prisma.company.findMany({
      where: { cnpj: { in: companyCnpjs }, active: true },
      select: { cnpj: true, displayName: true }
    })
    : [];
  const companiesByCnpj = new Map(companies.map((company) => [company.cnpj, company]));

  return NextResponse.json(
    {
      items: invoices.map((invoice) => {
        const company = invoice.tomadorCnpj ? companiesByCnpj.get(invoice.tomadorCnpj) : undefined;
        const { adminReview, ...invoiceFields } = invoice;
        const invoiceWithCompany = {
          ...invoiceFields,
          valorParaAprovacao: adminReview?.status === "LIBERADA" && adminReview.valorConfirmado !== null
            ? Number(adminReview.valorConfirmado)
            : Number(invoice.valorServico ?? invoice.valorLiquido ?? invoice.valorBaseCalculo ?? 0),
          origemValorParaAprovacao: adminReview?.status === "LIBERADA" && adminReview.valorConfirmado !== null
            ? "VALIDACAO_ADMINISTRATIVA"
            : "XML",
          empresa: {
            cnpj: invoice.tomadorCnpj,
            nomeExibicao: company?.displayName ?? null
          }
        };

        if (includeXml) return invoiceWithCompany;
        const { xmlOriginal, ...rest } = invoiceWithCompany;
        return rest;
      }),
      pagination,
      allNotesTotal,
      myApprovalsTotal,
      supplierOptions,
      managerOptions
    }
  );
}
