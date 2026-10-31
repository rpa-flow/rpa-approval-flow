import type { Invoice } from "@prisma/client";

// Fields read by the detail screen, including approval/status actions.
export const INVOICE_DETAIL_FIELDS = [
  "id", "numeroNota", "codigoIdentificador", "status", "statusProcessamento",
  "dataEmissao", "dataCompetencia", "valorServico", "valorLiquido", "valorBaseCalculo",
  "valorIssqn", "valorTotalRetido", "aliquota", "tomadorNome", "tomadorCnpj", "tomadorEmail",
  "prestadorCnpj", "localEmissao", "localPrestacao", "municipioIncidencia",
  "itemTributacaoNac", "itemTributacaoMun", "nbsDescricao", "responsavelValidacao",
  "dataValidacao", "observacaoValidacao", "codigoDelphi", "ordemCompra", "ocContrato",
  "numeroParcelas", "dataLancamentoDelphi", "dataPagamento"
] as const satisfies readonly (keyof Invoice)[];

type DetailField = (typeof INVOICE_DETAIL_FIELDS)[number];
type DetailSource = Pick<Invoice, DetailField> & {
  fornecedor: {
    nome: string;
    cnpj: string | null;
    codigoExterno: string | null;
    managerSuppliers: Array<{ manager: { nome: string } }>;
  };
};

export function isFullInvoiceResponse(params: URLSearchParams) {
  // Preserve the existing opt-in XML response for consumers already using it.
  return params.get("full") === "true" || params.get("includeXml") === "true";
}

export function serializeInvoiceDetail<T extends DetailSource>(invoice: T, full: boolean) {
  if (full) return invoice;

  const fields = Object.fromEntries(INVOICE_DETAIL_FIELDS.map((key) => [key, invoice[key]])) as Pick<T, DetailField>;
  return {
    ...fields,
    fornecedor: {
      nome: invoice.fornecedor.nome,
      cnpj: invoice.fornecedor.cnpj,
      codigoExterno: invoice.fornecedor.codigoExterno,
      managerSuppliers: invoice.fornecedor.managerSuppliers.map(({ manager }) => ({
        manager: { nome: manager.nome }
      }))
    }
  };
}
