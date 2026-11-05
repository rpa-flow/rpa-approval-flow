"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout } from "@/components/ui-kit";
import { NFSE_WORKFLOW_FIELDS } from "@/lib/workflow/field-catalog";

type Policy = { fieldKey: string; mode: "HIDDEN" | "READ_ONLY" | "EDITABLE"; required: boolean };
type Workflow = { invoice: Record<string, unknown> & { numeroNota: string }; execution: { revision: number; status: string }; currentStep: { name: string; fields: Policy[]; requiresPurchaseOrder: boolean } | null; canComplete: boolean; canResume: boolean; tasks: Array<{ id: string; stepName: string; managerName: string; completedAt: string | null }> };

export default function WorkflowInvoicePage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Workflow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [evaluation, setEvaluation] = useState({ rating: "", comment: "", riskLevel: "", qualifica: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [operationKey, setOperationKey] = useState("");
  useEffect(() => {
    fetch(`/api/notas/${params.id}/workflow`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar o workflow.");
      setData(result); setOperationKey(crypto.randomUUID());
      const initial: Record<string, string> = {};
      for (const policy of result.currentStep?.fields ?? []) {
        const value = result.invoice[policy.fieldKey];
        initial[policy.fieldKey] = policy.fieldKey === "dataPagamento" && value ? String(value).slice(0, 10) : value == null ? "" : String(value);
      }
      setValues(initial);
    }).catch((error) => setMessage(error.message));
  }, [params.id]);

  async function complete() {
    if (!data?.currentStep || !operationKey) return;
    setSaving(true); setMessage("");
    try {
      const fields: Record<string, unknown> = {};
      for (const policy of data.currentStep.fields.filter((item) => item.mode === "EDITABLE")) {
        if (policy.fieldKey === "serviceEvaluation") {
          if (evaluation.rating) fields.serviceEvaluation = { rating: Number(evaluation.rating), comment: evaluation.comment, riskLevel: evaluation.riskLevel, ...(evaluation.qualifica ? { qualifica: evaluation.qualifica } : {}) };
          continue;
        }
        const value = values[policy.fieldKey] ?? "";
        if (policy.fieldKey === "numeroParcelas") { if (value) fields[policy.fieldKey] = Number(value); }
        else if (policy.fieldKey === "dataPagamento") fields[policy.fieldKey] = value ? new Date(`${value}T12:00:00Z`).toISOString() : null;
        else fields[policy.fieldKey] = value || null;
      }
      const response = await fetch(`/api/notas/${params.id}/workflow/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: data.execution.revision, idempotencyKey: operationKey, fields }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir a etapa.");
      setMessage(result.completed ? "Aprovação final concluída." : "Etapa concluída e encaminhada ao próximo responsável.");
      setData((current) => current ? { ...current, canComplete: false } : current);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao concluir a etapa."); } finally { setSaving(false); }
  }
  async function resume() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/notas/${params.id}/workflow/resume`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível retomar.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao retomar."); } finally { setSaving(false); }
  }

  return <AppLayout><MainHeader title="Etapa de aprovação" subtitle={data ? `Nota ${data.invoice.numeroNota}` : undefined} /><main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
    <Link href="/dashboard" className="text-sm font-semibold">← Voltar ao dashboard</Link>
    {message && <p role="status" className="rounded border border-slate-300 bg-white p-3">{message}</p>}
    {data && <><section><h2 className="text-xl font-semibold">{data.currentStep?.name ?? (data.execution.status === "BLOCKED" ? "Aguardando responsável disponível" : "Workflow concluído")}</h2><p className="text-sm text-slate-600">Fornecedor: {String((data.invoice.fornecedor as { nome?: string } | undefined)?.nome ?? "Não informado")}</p><p className="text-sm text-slate-600">{data.canComplete ? "Preencha os campos da sua etapa." : "Você está consultando o andamento da nota."}</p>{data.canResume && <button type="button" className="btn-secondary mt-3" disabled={saving} onClick={resume}>Retomar após reativar responsável</button>}</section>
      <ol className="flex flex-wrap gap-2">{data.tasks.map((task) => <li key={task.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">{task.stepName} · {task.managerName} · {task.completedAt ? "Concluída" : "Pendente"}</li>)}</ol>
      {data.currentStep && <section className="space-y-3 rounded border border-slate-200 bg-white p-4">{data.currentStep.fields.filter((policy) => policy.mode !== "HIDDEN").map((policy) => {
        const field = NFSE_WORKFLOW_FIELDS.find((item) => item.key === policy.fieldKey);
        if (!field) return null;
        const editable = data.canComplete && policy.mode === "EDITABLE";
        if (policy.fieldKey === "serviceEvaluation") return <fieldset key={policy.fieldKey} className="space-y-2"><legend className="font-semibold">Avaliação do serviço{policy.required ? " *" : ""}</legend>
          {editable ? <><label className="approval-field"><span className="approval-field-label">Pontuação</span><select className="approval-field-control" value={evaluation.rating} onChange={(event) => setEvaluation({ ...evaluation, rating: event.target.value })}><option value="">Selecione</option>{[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number}</option>)}</select></label><label className="approval-field"><span className="approval-field-label">Comentário</span><textarea className="approval-field-control" value={evaluation.comment} onChange={(event) => setEvaluation({ ...evaluation, comment: event.target.value })} /></label><label className="approval-field"><span className="approval-field-label">Risco</span><select className="approval-field-control" value={evaluation.riskLevel} onChange={(event) => setEvaluation({ ...evaluation, riskLevel: event.target.value })}><option value="">Selecione</option><option value="BAIXO">Baixo</option><option value="MEDIO">Médio</option><option value="ALTO">Alto</option></select></label><label className="approval-field"><span className="approval-field-label">Qualifica?</span><select className="approval-field-control" value={evaluation.qualifica} onChange={(event) => setEvaluation({ ...evaluation, qualifica: event.target.value })}><option value="">Selecione</option><option value="SIM">Sim</option><option value="NAO">Não</option></select></label></> : <p className="text-sm">{data.invoice.serviceEvaluation ? "Avaliação registrada" : "Não informada"}</p>}
        </fieldset>;
        return <label key={policy.fieldKey} className="approval-field"><span className="approval-field-label">{field.label}{policy.required ? " *" : ""}</span>{policy.fieldKey === "descricaoServico" || policy.fieldKey === "observacaoValidacao" ? <textarea className="approval-field-control" rows={4} value={values[policy.fieldKey] ?? ""} readOnly={!editable} onChange={(event) => setValues({ ...values, [policy.fieldKey]: event.target.value })} /> : <input className="approval-field-control" type={policy.fieldKey === "dataPagamento" ? "date" : "text"} value={values[policy.fieldKey] ?? ""} readOnly={!editable} onChange={(event) => setValues({ ...values, [policy.fieldKey]: event.target.value })} />}</label>;
      })}{data.currentStep.requiresPurchaseOrder && <p className="text-sm text-slate-600">Informe a ordem de compra ou a ordem de contrato.</p>}{data.canComplete && <button type="button" className="btn-primary" disabled={saving} onClick={complete}>{saving ? "Salvando..." : "Concluir etapa"}</button>}</section>}
    </>}
  </main></AppLayout>;
}
