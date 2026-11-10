"use client";

import { getRatingLabel, QualificaHelpText, QualificationProcedureLink } from "@/components/evaluation-guidance";
import { minimumPaymentDate } from "@/lib/payment-date";
import { NFSE_WORKFLOW_FIELDS } from "@/lib/workflow/field-catalog";

export type ApprovalEvaluation = {
  rating: 1 | 2 | 3 | 4 | 5 | null;
  qualifica: "SIM" | "NAO" | "";
  riskLevel: "BAIXO" | "MEDIO" | "ALTO" | "";
  comment: string;
};

export type ApprovalFieldPolicy = {
  fieldKey: string;
  mode: "HIDDEN" | "READ_ONLY" | "EDITABLE";
  required: boolean;
};

type Props = {
  policies: ApprovalFieldPolicy[];
  values: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
  evaluation: ApprovalEvaluation;
  onEvaluationChange: (update: Partial<ApprovalEvaluation>) => void;
};

export function WorkflowApprovalFields({ policies, values, onValueChange, evaluation, onEvaluationChange }: Props) {
  return <div className="space-y-4">
    {policies.filter((policy) => policy.mode === "EDITABLE").map((policy) => {
      const field = NFSE_WORKFLOW_FIELDS.find((item) => item.key === policy.fieldKey);
      if (!field) return null;
      const value = values[policy.fieldKey] ?? "";
      if (policy.fieldKey === "serviceEvaluation") return <fieldset key={policy.fieldKey} className="space-y-3 rounded border border-slate-200 p-3">
        <legend className="px-1 font-semibold">Avaliação do serviço{policy.required ? " *" : ""}</legend>
        <div role="group" aria-labelledby="step-rating-label"><p id="step-rating-label" className="mb-2 text-sm font-semibold text-slate-800">Pontuação do serviço{policy.required ? " *" : ""}</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-5">{[1, 2, 3, 4, 5].map((rate) => { const description = getRatingLabel(rate); return <button key={rate} type="button" aria-pressed={evaluation.rating === rate} aria-label={`${rate} - ${description}`} title={`${rate} - ${description}`} className={`rounded-md border p-3 text-left text-xs transition ${evaluation.rating === rate ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm" : "border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"}`} onClick={() => onEvaluationChange({ rating: rate as ApprovalEvaluation["rating"] })}><strong className="text-base">{rate}</strong><br />{description}</button>; })}</div></div>
        <div className="grid items-start gap-3 sm:grid-cols-2"><label className="approval-field"><span className="approval-field-label">Comentário{policy.required ? " *" : ""}</span><textarea className="approval-field-control" rows={3} maxLength={1000} value={evaluation.comment} onChange={(event) => onEvaluationChange({ comment: event.target.value })} /></label><label className="approval-field"><span className="approval-field-label">Classificação de risco{policy.required ? " *" : ""}</span><select className="approval-field-control" value={evaluation.riskLevel} onChange={(event) => onEvaluationChange({ riskLevel: event.target.value as ApprovalEvaluation["riskLevel"] })}><option value="">Selecione</option><option value="BAIXO">Baixo</option><option value="MEDIO">Médio</option><option value="ALTO">Alto</option></select></label><label className="approval-field"><span className="approval-field-label">Qualifica?</span><select className="approval-field-control" aria-describedby="step-qualifica-help" value={evaluation.qualifica} onChange={(event) => onEvaluationChange({ qualifica: event.target.value as ApprovalEvaluation["qualifica"] })}><option value="">Selecione</option><option value="SIM">Sim</option><option value="NAO">Não</option></select><QualificaHelpText id="step-qualifica-help" /></label></div>
        <QualificationProcedureLink />
      </fieldset>;
      const label = `${field.label}${policy.required ? " *" : ""}`;
      if (policy.fieldKey === "descricaoServico" || policy.fieldKey === "observacaoValidacao" || policy.fieldKey === "nbsDescricao") {
        return <label key={policy.fieldKey} className="approval-field"><span className="approval-field-label">{label}</span><textarea className="approval-field-control" rows={4} maxLength={policy.fieldKey === "observacaoValidacao" ? 500 : undefined} value={value} required={policy.required} onChange={(event) => onValueChange(policy.fieldKey, event.target.value)} /></label>;
      }
      const isDate = policy.fieldKey === "dataPagamento";
      const isNumber = policy.fieldKey === "numeroParcelas";
      const isPurchaseOrder = policy.fieldKey === "ordemCompra" || policy.fieldKey === "ocContrato";
      return <label key={policy.fieldKey} className="approval-field"><span className="approval-field-label">{label}</span><input className="approval-field-control" type={isDate ? "date" : "text"} inputMode={isNumber || isPurchaseOrder ? "numeric" : undefined} pattern={isNumber || isPurchaseOrder ? "[0-9]*" : undefined} min={isDate ? minimumPaymentDate() : undefined} maxLength={isPurchaseOrder ? 120 : undefined} value={value} required={policy.required} onChange={(event) => onValueChange(policy.fieldKey, isPurchaseOrder || isNumber ? event.target.value.replace(/\D/g, "") : event.target.value)} /></label>;
    })}
  </div>;
}
