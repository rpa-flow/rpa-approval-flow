import test from "node:test";
import assert from "node:assert/strict";
import { nfseWorkflowDraftSchema, nfseWorkflowPublishSchema } from "./configuration.ts";

const policy = (key: string, required = false) => ({ key, mode: "EDITABLE" as const, required });
const valid = () => ({
  documentType: "NFSE" as const,
  steps: [
    { name: "Gestor", managerId: "gestor", consultationScope: "ASSIGNED" as const, requiresPurchaseOrder: false, fields: [policy("serviceEvaluation", true)] },
    { name: "Suprimentos", managerId: "suprimentos", consultationScope: "ALL" as const, requiresPurchaseOrder: true, fields: [policy("ordemCompra"), policy("ocContrato"), policy("dataPagamento", true)] }
  ]
});

test("publica fluxo com avaliação e dados de pagamento em etapas diferentes", () => {
  assert.equal(nfseWorkflowPublishSchema.safeParse(valid()).success, true);
});

test("não publica sem etapa de avaliação ou sem os dados de pagamento", () => {
  const noEvaluation = valid();
  noEvaluation.steps[0].fields = [];
  assert.equal(nfseWorkflowPublishSchema.safeParse(noEvaluation).success, false);
  const noPurchase = valid();
  noPurchase.steps[1].requiresPurchaseOrder = false;
  assert.equal(nfseWorkflowPublishSchema.safeParse(noPurchase).success, false);
  const noDate = valid();
  noDate.steps[1].fields[2].required = false;
  assert.equal(nfseWorkflowPublishSchema.safeParse(noDate).success, false);
});

test("rejeita campo desconhecido, duplicado, oculto obrigatório ou fiscal editável", () => {
  for (const fields of [
    [policy("inexistente")],
    [policy("ordemCompra"), policy("ordemCompra")],
    [{ key: "dataPagamento", mode: "HIDDEN" as const, required: true }],
    [policy("valorServico")]
  ]) {
    const draft = { documentType: "NFSE", steps: [{ ...valid().steps[0], fields }] };
    assert.equal(nfseWorkflowDraftSchema.safeParse(draft).success, false);
  }
});

test("grupo OC ou contrato não transforma as duas opções em obrigatórias", () => {
  const draft = valid();
  draft.steps[1].fields[0].required = true;
  assert.equal(nfseWorkflowPublishSchema.safeParse(draft).success, false);
});

test("aceita configurar somente uma das alternativas de compra como editável", () => {
  const draft = valid();
  draft.steps[1].fields = draft.steps[1].fields.filter((field) => field.key !== "ocContrato");
  assert.equal(nfseWorkflowPublishSchema.safeParse(draft).success, true);
});

test("permite corrigir data na última etapa quando o fluxo demora", () => {
  const draft = valid();
  draft.steps.push({ name: "Final", managerId: "gestor-final", consultationScope: "ASSIGNED", requiresPurchaseOrder: false, fields: [] });
  assert.equal(nfseWorkflowPublishSchema.safeParse(draft).success, false);
  draft.steps[2].fields.push(policy("dataPagamento"));
  assert.equal(nfseWorkflowPublishSchema.safeParse(draft).success, true);
});
