import test from "node:test";
import assert from "node:assert/strict";
import { fiscalIssueDate, isLegacyProcessingResult, legacyProcessingUnresolved } from "./fiscal-document-rules.ts";

test("valida calendário, horário e fuso da emissão fiscal", () => {
  assert.equal(fiscalIssueDate("2024-02-29T09:30:10.123-03:00")?.toISOString(), "2024-02-29T12:30:10.123Z");
  assert.equal(fiscalIssueDate("2000-02-29T10:05:59Z")?.toISOString(), "2000-02-29T10:05:59.000Z");
  assert.equal(fiscalIssueDate("2026-12-31T17:35:00+05:30")?.toISOString(), "2026-12-31T12:05:00.000Z");
  for (const date of [null, "", "2026-02-29T12:00:00Z", "2026-02-31T12:00:00-03:00",
    "1900-02-29T12:00:00Z", "2026-04-31T12:00:00Z", "2026-12-31T24:00:00Z",
    "2026-11-20T10:59:60Z", "2026-11-20T10:60:00Z", "2026-11-20T10:00:00",
    "2026-11-20T10:00:00+14:01", "2026-11-20T10:00:00-03:60", "2026-00-01T10:00:00Z"]) {
    assert.equal(fiscalIssueDate(date), null, String(date));
  }
});

test("conflito aguarda resultado externo e permite registrar apenas o resultado", () => {
  assert.equal(legacyProcessingUnresolved({ status: "APROVADO", statusProcessamento: "PROCESSANDO" }), true);
  assert.equal(legacyProcessingUnresolved({ status: "APROVADO", statusProcessamento: "ERRO" }), true);
  assert.equal(legacyProcessingUnresolved({ status: "PROCESSADO", statusProcessamento: "CONCLUIDO" }), false);
  assert.equal(legacyProcessingUnresolved({ status: "DADOS_INCONSISTENTES", statusProcessamento: "ERRO" }), false);
  assert.equal(isLegacyProcessingResult("PROCESSADO", ["status", "codigoDelphi"]), true);
  assert.equal(isLegacyProcessingResult("DADOS_INCONSISTENTES", ["status", "reason"]), true);
  assert.equal(isLegacyProcessingResult(undefined, ["statusProcessamento"]), false);
  assert.equal(isLegacyProcessingResult("AGUARDANDO_APROVACAO", ["status"]), false);
  for (const field of ["ordemCompra", "ocContrato", "numeroNota", "numeroParcelas", "dataPagamento", "situacaoNotaFiscal", "serviceEvaluation"]) {
    assert.equal(isLegacyProcessingResult("PROCESSADO", ["status", field]), false, field);
  }
});
