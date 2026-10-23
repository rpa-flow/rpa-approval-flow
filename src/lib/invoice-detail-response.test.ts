import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isFullInvoiceResponse, serializeInvoiceDetail } from "./invoice-detail-response.ts";

function fixture() {
  const fields = {
    codigoIdentificador: "codigo-teste", statusProcessamento: "PENDENTE" as const,
    dataEmissao: null, dataCompetencia: null, valorServico: null, valorLiquido: null,
    valorBaseCalculo: null, valorIssqn: null, valorTotalRetido: null, aliquota: null,
    tomadorNome: null, tomadorCnpj: null, tomadorEmail: null, prestadorCnpj: null,
    localEmissao: null, localPrestacao: null, municipioIncidencia: null,
    itemTributacaoNac: null, itemTributacaoMun: null, nbsDescricao: null,
    responsavelValidacao: null, dataValidacao: null, observacaoValidacao: null,
    codigoDelphi: null, dataLancamentoDelphi: null, dataPagamento: null
  };
  return {
    ...fields, id: "nota-teste", numeroNota: "42", status: "AGUARDANDO_APROVACAO" as const,
    numeroParcelas: 2, ordemCompra: "123", ocContrato: "456",
    xmlOriginal: "<NFSe>XML de teste</NFSe>", fornecedorId: "fornecedor-interno", criadoPorId: "autor-interno",
    tentativasNotificacao: 4, ultimoLembreteEm: "2026-01-01T00:00:00.000Z", futuroCampoInterno: "não enviar",
    fornecedor: {
      id: "fornecedor-interno", nome: "Fornecedor teste", cnpj: "00000000000000", codigoExterno: "ERP-1",
      managerSuppliers: [{ manager: { id: "gestor-interno", nome: "Gestor teste", email: "teste@example.com" } }]
    }
  };
}

test("default response omits unused/internal fields including nested manager contacts", () => {
  const original = fixture();
  const before = structuredClone(original);
  const response = JSON.parse(JSON.stringify(serializeInvoiceDetail(original, false)));
  for (const key of ["xmlOriginal", "fornecedorId", "criadoPorId", "tentativasNotificacao", "ultimoLembreteEm", "futuroCampoInterno"]) {
    assert.equal(Object.hasOwn(response, key), false, key);
  }
  assert.deepEqual(response.fornecedor, { nome: "Fornecedor teste", cnpj: "00000000000000", codigoExterno: "ERP-1", managerSuppliers: [{ manager: { nome: "Gestor teste" } }] });
  assert.equal(response.id, "nota-teste");
  assert.equal(response.ordemCompra, "123");
  assert.equal(response.ocContrato, "456");
  assert.equal(response.numeroParcelas, 2);
  assert.deepEqual(original, before);
  const { xmlOriginal, ...previousDefault } = original;
  assert.ok(Buffer.byteLength(JSON.stringify(response)) < Buffer.byteLength(JSON.stringify(previousDefault)));
});

test("full mode preserves all original fields, XML and selected supplier contacts", () => {
  const original = fixture();
  assert.deepEqual(serializeInvoiceDetail(original, true), original);
});

test("only explicit full=true or legacy includeXml=true enables full mode", () => {
  for (const query of ["", "full=false", "full=1", "full=TRUE", "includeXml=false"]) {
    assert.equal(isFullInvoiceResponse(new URLSearchParams(query)), false, query);
  }
  for (const query of ["full=true", "includeXml=true", "full=false&includeXml=true", "full=true&includeXml=false"]) {
    assert.equal(isFullInvoiceResponse(new URLSearchParams(query)), true, query);
  }
});

test("default contract covers every invoice field currently read by the detail screen", () => {
  const page = readFileSync(new URL("../app/notas/[id]/page.tsx", import.meta.url), "utf8");
  const response = serializeInvoiceDetail(fixture(), false);
  const available = new Set([...Object.keys(response), "descricaoServico", "retentionDetails"]);
  const used = [...page.matchAll(/\b(?:invoice|loadedInvoice)\??\.([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  assert.ok(used.length > 0);
  for (const field of used) assert.ok(available.has(field), `Missing screen field: ${field}`);
});
