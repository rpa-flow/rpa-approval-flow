/** Campos existentes que poderão ser configurados em etapas de NFS-e. */
export const NFSE_WORKFLOW_FIELDS = [
  { key: "dataEmissao", label: "Data de emissão", editable: false },
  { key: "dataCompetencia", label: "Competência", editable: false },
  { key: "valorServico", label: "Valor do serviço", editable: false },
  { key: "valorParaAprovacao", label: "Valor para aprovação", editable: false },
  { key: "valorLiquido", label: "Valor líquido", editable: false },
  { key: "valorBaseCalculo", label: "Base de cálculo", editable: false },
  { key: "valorIssqn", label: "ISSQN", editable: false },
  { key: "valorTotalRetido", label: "Total retido", editable: false },
  { key: "aliquota", label: "Alíquota", editable: false },
  { key: "tomadorNome", label: "Tomador", editable: false },
  { key: "tomadorCnpj", label: "CNPJ do tomador", editable: false },
  { key: "tomadorEmail", label: "E-mail do tomador", editable: false },
  { key: "prestadorCnpj", label: "CNPJ do prestador", editable: false },
  { key: "prestadorNome", label: "Nome do prestador", editable: false },
  { key: "prestadorEmail", label: "E-mail do prestador", editable: false },
  { key: "localEmissao", label: "Local de emissão", editable: false },
  { key: "localPrestacao", label: "Local da prestação", editable: false },
  { key: "municipioIncidencia", label: "Município de incidência", editable: false },
  { key: "itemTributacaoNac", label: "Item de tributação nacional", editable: false },
  { key: "itemTributacaoMun", label: "Item de tributação municipal", editable: false },
  { key: "descricaoServico", label: "Descrição do serviço", editable: false },
  { key: "nbsDescricao", label: "Descrição NBS", editable: false },
  { key: "ordemCompra", label: "Ordem de compra", editable: true },
  { key: "ocContrato", label: "Ordem de contrato", editable: true },
  { key: "dataPagamento", label: "Data de pagamento", editable: true },
  { key: "numeroParcelas", label: "Número de parcelas", editable: true },
  { key: "observacaoValidacao", label: "Observação", editable: true },
  { key: "serviceEvaluation", label: "Avaliação do serviço", editable: true }
] as const;

export type NfseWorkflowFieldKey = (typeof NFSE_WORKFLOW_FIELDS)[number]["key"];
export type WorkflowFieldMode = "HIDDEN" | "READ_ONLY" | "EDITABLE";

export function getNfseWorkflowField(key: string) {
  return NFSE_WORKFLOW_FIELDS.find((field) => field.key === key);
}
