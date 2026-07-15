import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createInvoiceSchema } from "@/lib/validations";
import { sendInvoiceCreatedEmail } from "@/lib/email";
import { parseNFSeXml } from "@/lib/nfse-parser";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { createInvoiceAuditLog } from "@/lib/audit";
import { uploadXmlToOneDrive } from "@/lib/onedrive";

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

function isInvoiceCreatedEmailDisabled() {
  const value = process.env.DISABLE_INVOICE_CREATED_EMAIL?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes" || value === "sim" || value === "on";
}

export type CreateInvoiceOptions = {
  initialStatus?: InvoiceStatus;
  sendCreatedEmail?: boolean;
  auditDescription?: string;
};

export async function createInvoiceFromRequest(request: NextRequest, options: CreateInvoiceOptions = {}) {
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
          },
          notificationConfig: {
            select: { emailsExtras: true }
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
        },
        notificationConfig: {
          select: { emailsExtras: true }
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
        },
        notificationConfig: {
          select: { emailsExtras: true }
        }
      }
    });
  }

  const alreadyExists = await prisma.invoice.findUnique({
    where: { codigoIdentificador: String(nfseData.codigoIdentificador) }
  });

  if (alreadyExists) {
    return NextResponse.json(
      { error: "Já existe nota com esse código identificador (44 a 50 dígitos)." },
      { status: 409 }
    );
  }

  const onedriveXmlUrl = parsed.data.xml
    ? await uploadXmlToOneDrive({
        fileName: `${nfseData.codigoIdentificador}.xml`,
        xmlContent: parsed.data.xml
      })
    : null;

  const initialStatus = options.initialStatus ?? InvoiceStatus.AGUARDANDO_APROVACAO;
  const isRejectedOnCreate = initialStatus === InvoiceStatus.RECUSADO;
  const validationReason = parsed.data.observacaoValidacao ?? parsed.data.reason ?? null;

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
      status: initialStatus,
      processada: isRejectedOnCreate ? true : undefined,
      statusProcessamento: isRejectedOnCreate ? "ERRO" : undefined,
      responsavelValidacao: isRejectedOnCreate ? (manager?.nome ?? "Integração Delphi") : undefined,
      dataValidacao: isRejectedOnCreate ? new Date() : undefined,
      observacaoValidacao: isRejectedOnCreate ? validationReason : undefined,
      criadoPorId: manager?.id
    },
    include: {
      fornecedor: true
    }
  });

  await prisma.noteStatusHistory.create({ data: { invoiceId: invoice.id, actorId: manager?.id, actorName: manager?.nome, actorEmail: manager?.email, newStatus: invoice.status, reason: validationReason } });
  await createInvoiceAuditLog({ invoiceId: invoice.id, actorId: manager?.id, actorName: manager?.nome, actorEmail: manager?.email, actionType: "NOTE_CREATED", actionDescription: options.auditDescription ?? "Nota criada e encaminhada para aprovação", newStatus: invoice.status, reason: validationReason, comment: onedriveXmlUrl ? `XML enviado para OneDrive: ${onedriveXmlUrl}` : undefined, afterData: invoice as unknown as any });

  if ((options.sendCreatedEmail ?? true) && !isInvoiceCreatedEmailDisabled()) {
    try {
      await sendInvoiceCreatedEmail({
        invoiceNumber: invoice.numeroNota,
        supplierName: supplier.nome,
        invoiceId: invoice.id,
        managers: [
          ...supplier.managerSuppliers.map((ms) => ({ email: ms.manager.email })),
          ...((supplier.notificationConfig?.emailsExtras ?? []).map((email) => ({ email })))
        ]
      });
    } catch (error) {
      console.error("[notas:create] Falha ao enviar e-mail de nova nota", {
        invoiceId: invoice.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return NextResponse.json(serializeInvoiceResponse(invoice, includeXml), { status: 201 });
}
