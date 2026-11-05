/** Pré-condições de entrada; o chamador também deve verificar concorrência no banco. */
export function enrollmentError(invoice: {
  status: string;
  processada: boolean;
  statusProcessamento: string;
  adminReview: { status: string } | null;
  workflowExecution: { id: string } | null;
}): string | null {
  if (invoice.workflowExecution) return "A nota já possui workflow.";
  if (invoice.status !== "AGUARDANDO_APROVACAO" || invoice.processada || invoice.statusProcessamento !== "PENDENTE") return "A nota não está pendente de aprovação.";
  if (invoice.adminReview && invoice.adminReview.status !== "LIBERADA") return "A nota está retida para revisão administrativa.";
  return null;
}
