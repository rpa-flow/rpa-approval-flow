import test from "node:test";
import assert from "node:assert/strict";
import { NFSE_WORKFLOW_FIELDS } from "./field-catalog.ts";
import { nfseWorkflowPublishSchema } from "./configuration.ts";
import { createNfseWorkflowExample } from "./settings-presets.ts";

test("o exemplo pode ser publicado depois de escolher os responsáveis", () => {
  const steps = createNfseWorkflowExample(NFSE_WORKFLOW_FIELDS);
  assert.equal(nfseWorkflowPublishSchema.safeParse({ documentType: "NFSE", steps }).success, false);
  steps[0].managerId = "gestor";
  steps[1].managerId = "suprimentos";
  assert.equal(nfseWorkflowPublishSchema.safeParse({ documentType: "NFSE", steps }).success, true);
});
