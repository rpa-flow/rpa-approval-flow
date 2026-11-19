import { redirect } from "next/navigation";

/** Mantém URLs antigas da etapa, exibindo o detalhe amplo da nota. */
export default function WorkflowInvoicePage({ params }: { params: { id: string } }) {
  redirect(`/notas/${params.id}`);
}
