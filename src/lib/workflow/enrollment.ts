/** Pré-condições de entrada; o chamador também deve verificar concorrência no banco. */
export function enrollmentError(invoice: {
  status: string;
  processada: boolean;
  statusProcessamento: string;
  adminReview: { status: string } | null;
  workflowExecution: { id: string } | null;
}, options: { stepId?: string } = {}): string | null {
  if (invoice.workflowExecution) return "A nota já possui workflow.";
  if (invoice.adminReview && invoice.adminReview.status !== "LIBERADA") return "A nota está retida para revisão administrativa.";
  if (invoice.status === "DADOS_INCONSISTENTES") {
    if (!options.stepId) return "Selecione a etapa de destino para a nota inconsistente.";
    if (!invoice.processada || invoice.statusProcessamento !== "ERRO") return "A situação da nota inconsistente não permite encaminhamento.";
    return null;
  }
  if (invoice.status !== "AGUARDANDO_APROVACAO" || invoice.processada || invoice.statusProcessamento !== "PENDENTE") return "A nota não está pendente de aprovação.";
  return null;
}

