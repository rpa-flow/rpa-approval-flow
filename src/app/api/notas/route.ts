import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createInvoiceSchema } from "@/lib/validations";
import { sendInvoiceCreatedEmail } from "@/lib/email";
import { groupExtrasByFieldName, parseNFSeXml, simplifyExtrasByFieldName } from "@/lib/nfse-parser";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { createInvoiceAuditLog } from "@/lib/audit";
import { uploadXmlToOneDrive } from "@/lib/onedrive";

const ALLOWED_STATUSES = Object.values(InvoiceStatus);

type ManualInvoiceData = {
  numeroNota: string;
  codigoIdentificador: string;
  nDfse?: string;
  localEmissao?: string;
  localPrestacao?: string;
  municipioIncidencia?: string;
  itemTributacaoNac?: string;
  itemTributacaoMun?: string;
  nbsDescricao?: string;
  dataProcessamento?: string;
  dataEmissao?: string;
  dataCompetencia?: string;
  prestadorCnpj?: string;
  prestadorNome?: string;
  prestadorEmail?: string;
  tomadorCnpj?: string;
  tomadorNome?: string;
  tomadorEmail?: string;
  valorBaseCalculo?: number;
  valorIssqn?: number;
  valorTotalRetido?: number;
  valorLiquido?: number;
  valorServico?: number;
  aliquota?: number;
};

function shouldIncludeXml(request: NextRequest) {
  return request.nextUrl.searchParams.get("includeXml") === "true";
}

function shouldIncludeExtras(request: NextRequest) {
  return request.nextUrl.searchParams.get("includeExtras") === "true";
}

function serializeInvoiceResponse<T extends { xmlOriginal?: string | null }>(invoice: T, includeXml: boolean) {
  if (includeXml) return invoice;
  const { xmlOriginal, ...rest } = invoice;
  return rest;
}

function validateInvoiceIngestApiKey(request: NextRequest) {
  const apiKey = process.env.INVOICE_INGEST_API_KEY;
  if (!apiKey) return null;

  const keyFromRequest = request.headers.get("x-api-key");
  if (keyFromRequest !== apiKey) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const includeXml = shouldIncludeXml(request);

  if (statusParam && !ALLOWED_STATUSES.includes(statusParam as InvoiceStatus)) {
    return NextResponse.json(
      {
        error: "Status inválido.",
        allowed: ALLOWED_STATUSES
      },
      { status: 400 }
    );
  }

  const includeExtras = shouldIncludeExtras(request);
  const invoices = await prisma.invoice.findMany({
    where: statusParam ? { status: statusParam as InvoiceStatus } : undefined,
    include: {
      fornecedor: {
        include: {
          managerSuppliers: {
            include: {
              manager: {
                select: { id: true, nome: true, email: true }
              }
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const response = invoices.map((invoice) => {
    const base = serializeInvoiceResponse(invoice, includeXml);

    if (!includeExtras || !invoice.xmlOriginal) {
      return base;
    }

    try {
      const parsed = parseNFSeXml(invoice.xmlOriginal);
      return {
        ...base,
        serie: parsed.serie ?? null,
        extras: parsed.extras,
        extrasByFieldName: groupExtrasByFieldName(parsed.extras),
        extrasSimple: simplifyExtrasByFieldName(parsed.extras)
      };
    } catch {
      return {
        ...base,
        serie: null,
        extras: {},
        extrasByFieldName: {},
        extrasSimple: {},
        extrasError: "Não foi possível extrair extras do XML armazenado."
      };
    }
  });

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  const manager = await getSessionManager();
  const unauthorized = validateInvoiceIngestApiKey(request);
  if (!manager && unauthorized) return unauthorized;

  if (manager && !["FORNECEDOR", "ADMIN"].includes(manager.role)) {
    return NextResponse.json({ error: "Somente usuários com perfil FORNECEDOR ou ADMIN podem lançar notas." }, { status: 403 });
  }
  const includeXml = shouldIncludeXml(request);

  const contentType = request.headers.get("content-type") ?? "";
  let payload: Record<string, unknown> = {};

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const xmlFile = formData.get("xmlFile");

    payload = Object.fromEntries(formData.entries());

    if (xmlFile instanceof File) {
      payload.xml = await xmlFile.text();
    }
  } else {
    payload = await request.json();
  }

  const parsed = createInvoiceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let nfseData: ReturnType<typeof parseNFSeXml> | ManualInvoiceData;

  try {
    nfseData = parsed.data.xml
      ? parseNFSeXml(parsed.data.xml)
      : {
          numeroNota: parsed.data.numeroNota!,
          codigoIdentificador: parsed.data.codigoIdentificador ?? `${Date.now()}`.padEnd(44, "0"),
          nDfse: parsed.data.nDfse,
          localEmissao: parsed.data.localEmissao,
          localPrestacao: parsed.data.localPrestacao,
          municipioIncidencia: parsed.data.municipioIncidencia,
          itemTributacaoNac: parsed.data.itemTributacaoNac,
          itemTributacaoMun: parsed.data.itemTributacaoMun,
          nbsDescricao: parsed.data.nbsDescricao,
          dataProcessamento: parsed.data.dataProcessamento,
          dataEmissao: parsed.data.dataEmissao,
          dataCompetencia: parsed.data.dataCompetencia,
          prestadorCnpj: parsed.data.prestadorCnpj,
          prestadorNome: parsed.data.prestadorNome,
          prestadorEmail: parsed.data.prestadorEmail,
          tomadorCnpj: parsed.data.tomadorCnpj,
          tomadorNome: parsed.data.tomadorNome,
          tomadorEmail: parsed.data.tomadorEmail,
          valorBaseCalculo: parsed.data.valorBaseCalculo,
          valorIssqn: parsed.data.valorIssqn,
          valorTotalRetido: parsed.data.valorTotalRetido,
          valorLiquido: parsed.data.valorLiquido,
          valorServico: parsed.data.valorServico,
          aliquota: parsed.data.aliquota
        };
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao ler XML NFSe", details: (error as Error).message },
      { status: 400 }
    );
  }

  const allowedSupplierIds = manager ? getAllowedSupplierIds(manager) : [];

  if (manager && parsed.data.fornecedorId) {
    const canAccessSupplier = manager.role === "ADMIN" || allowedSupplierIds.includes(parsed.data.fornecedorId);
    if (!canAccessSupplier) {
      return NextResponse.json(
        { error: "Acesso negado para lançar nota neste fornecedor." },
        { status: 403 }
      );
    }
  }

  const supplierByPayload = parsed.data.fornecedorId
    ? await prisma.supplier.findUnique({
        where: { id: parsed.data.fornecedorId },
        include: {
          managerSuppliers: {
            include: {
              manager: { select: { id: true, nome: true, email: true } }
            }
          }
        }
      })
    : null;

  let supplier = supplierByPayload;

  if (!supplier && "prestadorCnpj" in nfseData && nfseData.prestadorCnpj) {
    supplier = await prisma.supplier.findFirst({
      where: { cnpj: nfseData.prestadorCnpj },
      include: {
        managerSuppliers: {
          include: {
            manager: { select: { id: true, nome: true, email: true } }
          }
        }
      }
    });
  }

  if (manager && supplier) {
    const canAccessSupplier = manager.role === "ADMIN" || allowedSupplierIds.includes(supplier.id);
    if (!canAccessSupplier) {
      return NextResponse.json(
        { error: "Acesso negado para lançar nota neste fornecedor." },
        { status: 403 }
      );
    }
  }

  if (!supplier) {
    if (manager && manager.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Fornecedor não encontrado. Informe um fornecedor vinculado à sua conta." },
        { status: 404 }
      );
    }

    supplier = await prisma.supplier.create({
      data: {
        nome: ("prestadorNome" in nfseData && nfseData.prestadorNome) || "Fornecedor importado via NFSe",
        cnpj: "prestadorCnpj" in nfseData ? nfseData.prestadorCnpj : undefined
      },
      include: {
        managerSuppliers: {
          include: {
            manager: { select: { id: true, nome: true, email: true } }
          }
        }
      }
    });
  }

  const alreadyExists = await prisma.invoice.findUnique({
    where: { codigoIdentificador: String(nfseData.codigoIdentificador) }
  });

  if (alreadyExists) {
    return NextResponse.json(
      { error: "Já existe nota com esse código identificador (44 dígitos)." },
      { status: 409 }
    );
  }

  const onedriveXmlUrl = parsed.data.xml
    ? await uploadXmlToOneDrive({
        fileName: `${nfseData.codigoIdentificador}.xml`,
        xmlContent: parsed.data.xml
      })
    : null;

  const invoice = await prisma.invoice.create({
    data: {
      numeroNota: String(nfseData.numeroNota),
      codigoIdentificador: String(nfseData.codigoIdentificador),
      fornecedorId: supplier.id,
      nDfse: "nDfse" in nfseData ? nfseData.nDfse : undefined,
      xmlOriginal: parsed.data.xml,
      localEmissao: "localEmissao" in nfseData ? nfseData.localEmissao : undefined,
      localPrestacao: "localPrestacao" in nfseData ? nfseData.localPrestacao : undefined,
      municipioIncidencia: "municipioIncidencia" in nfseData ? nfseData.municipioIncidencia : undefined,
      itemTributacaoNac: "itemTributacaoNac" in nfseData ? nfseData.itemTributacaoNac : undefined,
      itemTributacaoMun: "itemTributacaoMun" in nfseData ? nfseData.itemTributacaoMun : undefined,
      nbsDescricao: "nbsDescricao" in nfseData ? nfseData.nbsDescricao : undefined,
      dataProcessamento:
        "dataProcessamento" in nfseData && nfseData.dataProcessamento
          ? new Date(nfseData.dataProcessamento)
          : undefined,
      dataEmissao:
        "dataEmissao" in nfseData && nfseData.dataEmissao ? new Date(nfseData.dataEmissao) : undefined,
      dataCompetencia:
        "dataCompetencia" in nfseData && nfseData.dataCompetencia
          ? new Date(nfseData.dataCompetencia)
          : undefined,
      prestadorCnpj: "prestadorCnpj" in nfseData ? nfseData.prestadorCnpj : undefined,
      prestadorNome: "prestadorNome" in nfseData ? nfseData.prestadorNome : undefined,
      prestadorEmail: "prestadorEmail" in nfseData ? nfseData.prestadorEmail : undefined,
      tomadorCnpj: "tomadorCnpj" in nfseData ? nfseData.tomadorCnpj : undefined,
      tomadorNome: "tomadorNome" in nfseData ? nfseData.tomadorNome : undefined,
      tomadorEmail: "tomadorEmail" in nfseData ? nfseData.tomadorEmail : undefined,
      valorBaseCalculo: "valorBaseCalculo" in nfseData ? nfseData.valorBaseCalculo : undefined,
      valorIssqn: "valorIssqn" in nfseData ? nfseData.valorIssqn : undefined,
      valorTotalRetido: "valorTotalRetido" in nfseData ? nfseData.valorTotalRetido : undefined,
      valorLiquido: "valorLiquido" in nfseData ? nfseData.valorLiquido : undefined,
      valorServico: "valorServico" in nfseData ? nfseData.valorServico : undefined,
      aliquota: "aliquota" in nfseData ? nfseData.aliquota : undefined,
      criadoPorId: manager?.id
    },
    include: {
      fornecedor: true
    }
  });

  await prisma.noteStatusHistory.create({ data: { invoiceId: invoice.id, actorId: manager?.id, actorName: manager?.nome, actorEmail: manager?.email, newStatus: invoice.status } });
  await createInvoiceAuditLog({ invoiceId: invoice.id, actorId: manager?.id, actorName: manager?.nome, actorEmail: manager?.email, actionType: "NOTE_CREATED", actionDescription: "Nota criada e encaminhada para aprovação", newStatus: invoice.status, comment: onedriveXmlUrl ? `XML enviado para OneDrive: ${onedriveXmlUrl}` : undefined, afterData: invoice as unknown as any });

  await sendInvoiceCreatedEmail({
    invoiceNumber: invoice.numeroNota,
    supplierName: supplier.nome,
    managers: supplier.managerSuppliers.map((ms) => ({ email: ms.manager.email }))
  });

  return NextResponse.json(serializeInvoiceResponse(invoice, includeXml), { status: 201 });
}
