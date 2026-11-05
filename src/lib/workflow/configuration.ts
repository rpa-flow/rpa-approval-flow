import { z } from "zod";
import { getNfseWorkflowField } from "./field-catalog.ts";

const fieldPolicySchema = z.object({
  key: z.string().min(1),
  mode: z.enum(["HIDDEN", "READ_ONLY", "EDITABLE"]),
  required: z.boolean()
}).strict();

const stepSchema = z.object({
  name: z.string().trim().min(1).max(120),
  managerId: z.string().min(1),
  consultationScope: z.enum(["ASSIGNED", "ALL"]),
  requiresPurchaseOrder: z.boolean(),
  fields: z.array(fieldPolicySchema)
}).strict();

/** Validação estrutural; permissões e situação dos gestores exigem consulta ao banco. */
export const nfseWorkflowDraftSchema = z.object({
  documentType: z.literal("NFSE"),
  steps: z.array(stepSchema).max(50)
}).strict().superRefine((draft, ctx) => {
  draft.steps.forEach((step, stepIndex) => {
    const seen = new Set<string>();
    step.fields.forEach((policy, fieldIndex) => {
      const path = ["steps", stepIndex, "fields", fieldIndex];
      const field = getNfseWorkflowField(policy.key);
      if (!field) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "key"], message: "Campo desconhecido." });
      } else if (policy.mode === "EDITABLE" && !field.editable) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "mode"], message: "Este campo não pode ser editado." });
      }
      if (seen.has(policy.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "key"], message: "Campo duplicado na etapa." });
      }
      seen.add(policy.key);
      if (policy.required && policy.mode !== "EDITABLE") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "required"], message: "Campo obrigatório deve ser editável." });
      }
    });
    if (step.requiresPurchaseOrder && step.fields.some((field) => (field.key === "ordemCompra" || field.key === "ocContrato") && field.required)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["steps", stepIndex, "fields"], message: "OC e contrato devem formar uma alternativa, sem obrigatoriedade individual." });
    }
  });
});

/** Regras mínimas confirmadas para publicação, além das validações do rascunho. */
export const nfseWorkflowPublishSchema = nfseWorkflowDraftSchema.superRefine((draft, ctx) => {
  if (!draft.steps.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["steps"], message: "Adicione ao menos uma etapa." });
  }

  const hasPaymentAndPurchaseStep = draft.steps.some((step) => {
    const isEditable = (key: string) => step.fields.some((field) => field.key === key && field.mode === "EDITABLE");
    const paymentRequired = step.fields.some((field) => field.key === "dataPagamento" && field.mode === "EDITABLE" && field.required);
    // OC e contrato formam uma alternativa obrigatória, não duas obrigações individuais.
    return step.requiresPurchaseOrder && paymentRequired && (isEditable("ordemCompra") || isEditable("ocContrato"));
  });
  if (!hasPaymentAndPurchaseStep) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["steps"], message: "Configure uma etapa com data de pagamento obrigatória e ordem de compra ou contrato editável." });
  }
  const finalStep = draft.steps[draft.steps.length - 1];
  if (finalStep && !finalStep.fields.some((field) => field.key === "dataPagamento" && field.mode === "EDITABLE")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["steps", draft.steps.length - 1, "fields"], message: "Permita corrigir a data de pagamento na etapa final." });
  }
  if (!draft.steps.some((step) => step.fields.some((field) => field.key === "serviceEvaluation" && field.mode === "EDITABLE" && field.required))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["steps"], message: "Configure a avaliação obrigatória em uma etapa." });
  }
});

export type NfseWorkflowDraft = z.infer<typeof nfseWorkflowDraftSchema>;
