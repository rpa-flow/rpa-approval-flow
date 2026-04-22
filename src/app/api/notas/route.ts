import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createInvoiceSchema } from "@/lib/validations";
import { sendInvoiceCreatedEmail } from "@/lib/email";
import { parseNFSeXml } from "@/lib/nfse-parser";

function validateInvoiceIngestApiKey(request: NextRequest) {
  const apiKey = process.env.INVOICE_INGEST_API_KEY;
  if (!apiKey) return null;

  const keyFromRequest = request.headers.get("x-api-key");
  if (keyFromRequest !== apiKey) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const invoices = await prisma.invoice.findMany({
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

  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  const unauthorized = validateInvoiceIngestApiKey(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = createInvoiceSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let nfseData:
    | ReturnType<typeof parseNFSeXml>
    | {
        numeroNota: string;
        codigoIdentificador: string;
      };

  try {
    nfseData = parsed.data.xml
      ? parseNFSeXml(parsed.data.xml)
      : {
          numeroNota: parsed.data.numeroNota!,
          codigoIdentificador: parsed.data.codigoIdentificador ?? `${Date.now()}`.padEnd(44, "0")
        };
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao ler XML NFSe", details: (error as Error).message },
      { status: 400 }
    );
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
        }
      }
    });
  }

  const alreadyExists = await prisma.invoice.findUnique({
    where: { codigoIdentificador: nfseData.codigoIdentificador }
  });

  if (alreadyExists) {
    return NextResponse.json(
      { error: "Já existe nota com esse código identificador (44 dígitos)." },
      { status: 409 }
    );
  }

  const invoice = await prisma.invoice.create({
    data: {
      numeroNota: nfseData.numeroNota,
      codigoIdentificador: nfseData.codigoIdentificador,
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
      aliquota: "aliquota" in nfseData ? nfseData.aliquota : undefined
    },
    include: {
      fornecedor: true
    }
  });

  await sendInvoiceCreatedEmail({
    invoiceNumber: invoice.numeroNota,
    supplierName: supplier.nome,
    managers: supplier.managerSuppliers.map((ms) => ({ email: ms.manager.email }))
  });

  return NextResponse.json(invoice, { status: 201 });
}
