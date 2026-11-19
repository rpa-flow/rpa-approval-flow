import test from "node:test";
import assert from "node:assert/strict";
import { uniqueActiveWorkflowAssignees } from "./assignees.ts";

const manager = (id: string, role = "GESTOR", ativo = true) => ({ id, nome: id, email: `${id}@empresa.com`, role, ativo });

test("deduplica responsáveis e mantém apenas contas ativas de ADMIN ou GESTOR", () => {
  const result = uniqueActiveWorkflowAssignees([
    manager("gestor-1"),
    manager("gestor-1"),
    manager("admin", "ADMIN"),
    manager("inativo", "GESTOR", false),
    manager("fornecedor", "FORNECEDOR")
  ]);
  assert.deepEqual(result.map(({ id }) => id), ["gestor-1", "admin"]);
});

