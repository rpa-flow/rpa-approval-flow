import test from "node:test";
import assert from "node:assert/strict";
import { parseNFSeXml, simplifyExtrasByFieldName } from "./nfse-parser.ts";

const baseId = "NFS12345678901234567890123456789012345678901234";

test("known fields are mapped", () => {
  const xml = `<NFSe><infNFSe><Id>${baseId}</Id><nNFSe>10</nNFSe><nDFSe>99</nDFSe><DPS><infDPS><serie>70000</serie><dhEmi>2026-01-01</dhEmi><dCompet>2026-01-31</dCompet><prest><CNPJ>111</CNPJ><email>a@a.com</email></prest><toma><CNPJ>222</CNPJ></toma><valores><vServPrest><vServ>100,50</vServ></vServPrest></valores></infDPS></DPS><valores><vBC>100,50</vBC><vISSQN>5,00</vISSQN></valores></infNFSe></NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.numeroNota, "10");
  assert.equal(parsed.serie, "70000");
  assert.equal(parsed.valorServico, "100.50");
});

test("unknown fields go to extras", () => {
  const xml = `<NFSe><infNFSe><Id>${baseId}</Id><nNFSe>10</nNFSe><DPS><infDPS><campoDesconhecido>xyz</campoDesconhecido><itens><descricao>A</descricao></itens><itens><descricao>B</descricao></itens></infDPS></DPS></infNFSe></NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.campoDesconhecido"], "xyz");
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.itens[0].descricao"], "A");
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.itens[1].descricao"], "B");
});

test("mapped fields are not duplicated in extras", () => {
  const xml = `<NFSe><infNFSe><Id>${baseId}</Id><nNFSe>10</nNFSe><DPS><infDPS><serie>70000</serie></infDPS></DPS></infNFSe></NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.serie"], undefined);
});

test("works with namespaces", () => {
  const xml = `<ns0:NFSe xmlns:ns0='urn:x'><ns0:infNFSe><ns0:Id>${baseId}</ns0:Id><ns0:nNFSe>10</ns0:nNFSe><ns0:DPS><ns0:infDPS><ns0:serie>70000</ns0:serie><ns0:campoLivre>ok</ns0:campoLivre></ns0:infDPS></ns0:DPS></ns0:infNFSe></ns0:NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.serie, "70000");
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.campoLivre"], "ok");
});

test("simplifies extras by field name", () => {
  const xml = `<NFSe><infNFSe><Id>${baseId}</Id><nNFSe>10</nNFSe><DPS><infDPS><grupo><descricao>Primeira</descricao></grupo><grupo><descricao>Segunda</descricao></grupo><codigo>ABC</codigo></infDPS></DPS></infNFSe></NFSe>`;
  const parsed = parseNFSeXml(xml);
  const simple = simplifyExtrasByFieldName(parsed.extras);
  assert.equal(simple.codigo, "ABC");
  assert.deepEqual(simple.descricao, ["Primeira", "Segunda"]);
});


test("ignores technical xml/signature fields in extras", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><NFSe><infNFSe><Id>${baseId}</Id><nNFSe>10</nNFSe><DPS><infDPS><campoLivre>ok</campoLivre></infDPS></DPS></infNFSe><Signature><SignedInfo><CanonicalizationMethod><Algorithm>x</Algorithm></CanonicalizationMethod></SignedInfo><SignatureValue>abc</SignatureValue></Signature></NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.extras["NFSe.Signature.SignatureValue"], undefined);
  assert.equal(parsed.extras["NFSe.Signature.SignedInfo.CanonicalizationMethod.Algorithm"], undefined);
  assert.equal(parsed.extras["?xml.version"], undefined);
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.campoLivre"], "ok");
});
