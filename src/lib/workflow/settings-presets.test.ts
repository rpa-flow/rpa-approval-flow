import test from "node:test";
import assert from "node:assert/strict";
import { NFSE_WORKFLOW_FIELDS } from "./field-catalog.ts";
import { nfseWorkflowPublishSchema } from "./configuration.ts";
import { createNfseWorkflowExample } from "./settings-presets.ts";

test("o exemplo pode ser publicado depois de escolher os responsáveis", () => {
  const steps = createNfseWorkflowExample(NFSE_WORKFLOW_FIELDS);
  assert.equal(nfseWorkflowPublishSchema.safeParse({ documentType: "NFSE", steps }).success, false);
  steps[0].managerIds = ["gestor"];
  steps[1].managerIds = ["suprimentos"];
  assert.equal(nfseWorkflowPublishSchema.safeParse({ documentType: "NFSE", steps }).success, true);
});

test("permite etapa vinculada aos gestores do fornecedor sem usuários fixos", () => {
  const steps = createNfseWorkflowExample(NFSE_WORKFLOW_FIELDS);
  steps[0].responsibilityMode = "SUPPLIER_MANAGERS";
  steps[0].managerIds = [];
  steps[1].managerIds = ["suprimentos"];
  assert.equal(nfseWorkflowPublishSchema.safeParse({ documentType: "NFSE", steps }).success, true);
  steps[0].managerIds = ["gestor"];
  assert.equal(nfseWorkflowPublishSchema.safeParse({ documentType: "NFSE", steps }).success, false);
});

