import test from "node:test";
import assert from "node:assert/strict";
import { enrollmentError } from "./enrollment.ts";

const pending = () => ({ status: "AGUARDANDO_APROVACAO", processada: false, statusProcessamento: "PENDENTE", adminReview: null, workflowExecution: null });

test("aceita nota pendente sem revisão ou com revisão liberada", () => {
  assert.equal(enrollmentError(pending()), null);
  assert.equal(enrollmentError({ ...pending(), adminReview: { status: "LIBERADA" } }), null);
});

test("rejeita nota repetida, processada ou retida para revisão", () => {
  assert.ok(enrollmentError({ ...pending(), workflowExecution: { id: "execucao" } }));
  assert.ok(enrollmentError({ ...pending(), status: "APROVADO" }));
  assert.ok(enrollmentError({ ...pending(), processada: true }));
  assert.ok(enrollmentError({ ...pending(), statusProcessamento: "PROCESSANDO" }));
  assert.ok(enrollmentError({ ...pending(), adminReview: { status: "PENDENTE" } }));
  assert.ok(enrollmentError({ ...pending(), adminReview: { status: "IGNORADA" } }));
});

test("aceita nota inconsistente somente com etapa escolhida e estado legado esperado", () => {
  const inconsistent = { ...pending(), status: "DADOS_INCONSISTENTES", processada: true, statusProcessamento: "ERRO" };
  assert.match(enrollmentError(inconsistent) ?? "", /Selecione a etapa/);
  assert.equal(enrollmentError(inconsistent, { stepId: "step-2" }), null);
  assert.ok(enrollmentError({ ...inconsistent, processada: false }, { stepId: "step-2" }));
  assert.ok(enrollmentError({ ...inconsistent, statusProcessamento: "PENDENTE" }, { stepId: "step-2" }));
  assert.ok(enrollmentError({ ...inconsistent, workflowExecution: { id: "execucao" } }, { stepId: "step-2" }));
  assert.ok(enrollmentError({ ...inconsistent, adminReview: { status: "PENDENTE" } }, { stepId: "step-2" }));
});

