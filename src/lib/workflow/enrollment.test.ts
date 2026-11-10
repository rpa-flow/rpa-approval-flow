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
