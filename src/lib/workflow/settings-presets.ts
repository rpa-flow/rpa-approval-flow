import type { NfseWorkflowDraft } from "./configuration";

export function createNfseWorkflowExample(fields: ReadonlyArray<{ key: string }>): NfseWorkflowDraft["steps"] {
  const makeFields = (editable: string[], required: string[]): NfseWorkflowDraft["steps"][number]["fields"] => fields.map((field) => ({
    key: field.key,
    mode: editable.includes(field.key) ? "EDITABLE" : "READ_ONLY",
    required: required.includes(field.key)
  }));
  return [
    { name: "Avaliação do serviço", managerId: "", consultationScope: "ASSIGNED", requiresPurchaseOrder: false, fields: makeFields(["serviceEvaluation"], ["serviceEvaluation"]) },
    { name: "Compra e pagamento", managerId: "", consultationScope: "ASSIGNED", requiresPurchaseOrder: true, fields: makeFields(["ordemCompra", "ocContrato", "dataPagamento"], ["dataPagamento"]) }
  ];
}
