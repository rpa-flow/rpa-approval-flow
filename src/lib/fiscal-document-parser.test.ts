import test from "node:test";
import assert from "node:assert/strict";
import { parseFiscalXml } from "./fiscal-document-parser.ts";

const nfeKey = "0" + "1".repeat(43);
const cteKey = "0" + "2".repeat(43);
const nfe = `<NFe><infNFe Id="NFe${nfeKey}" versao="4.00"><ide><mod>55</mod><nNF>10</nNF><tpAmb>1</tpAmb></ide>
  <dest><CNPJ>00123456000001</CNPJ></dest><det nItem="1"><prod><qCom>1.2345</qCom>
  <vUnCom>999.1234567890</vUnCom></prod></det><total><ICMSTot><vNF>0.00</vNF></ICMSTot></total></infNFe></NFe>`;
const cte = `<CTe><infCte Id="CTe${cteKey}" versao="4.00"><ide><mod>57</mod><nCT>20</nCT><tpAmb>1</tpAmb>
  <toma3><toma>2</toma></toma3></ide><receb><CNPJ>00123456000002</CNPJ></receb><infCTeNorm>
  <infDoc><infNFe><chave>${nfeKey}</chave></infNFe></infDoc></infCTeNorm></infCte></CTe>`;

test("NF-e preserva chave e preços textuais, zero e campos ausentes", () => {
  const invoice = parseFiscalXml(nfe);
  assert.equal(invoice.documentType, "NFE");
  if (invoice.documentType !== "NFE") throw new Error("tipo incorreto");
  assert.equal(invoice.accessKey, nfeKey);
  assert.equal(invoice.referenceValue, "0.00");
  assert.equal(invoice.detail.items[0].vUnCom, "999.1234567890");
  assert.equal(invoice.detail.items[0].qCom, "1.2345");
  assert.equal(invoice.detail.items[0].vProd, null);
  assert.equal(invoice.fiscalStatus, "UNKNOWN");
});

test("protocolo precisa corresponder à chave; namespace prefixado é aceito", () => {
  const xml = `<p:nfeProc xmlns:p="http://www.portalfiscal.inf.br/nfe">${nfe}<protNFe><infProt>
    <chNFe>${nfeKey}</chNFe><nProt>100000000000000</nProt><tpAmb>1</tpAmb><cStat>100</cStat></infProt></protNFe></p:nfeProc>`;
  for (const [input, expected] of [[xml, "AUTHORIZED"], [xml.replace(`<chNFe>${nfeKey}`, `<chNFe>${cteKey}`), "UNKNOWN"],
    [xml.replace("<cStat>100", "<cStat>101"), "CANCELLED"], [xml.replace("<cStat>100", "<cStat>110"), "NOT_AUTHORIZED"]]) {
    const doc = parseFiscalXml(input);
    assert.ok(doc.documentType === "NFE");
    assert.equal(doc.fiscalStatus, expected);
  }
});

test("NF-e e CT-e exigem ambiente de produção no documento e no protocolo", () => {
  const keys = [[nfe, "NFe", nfeKey, "nfeProc"], [cte, "CTe", cteKey, "cteProc"]] as const;
  for (const [document, name, key, wrapper] of keys) {
    const environment = (value: string) => value ? `<tpAmb>${value}</tpAmb>` : "";
    for (const [documentEnv, protocolEnv, expected] of [
      ["1", "1", "AUTHORIZED"], ["1", "2", "UNKNOWN"], ["2", "1", "UNKNOWN"],
      ["2", "2", "UNKNOWN"], ["", "1", "UNKNOWN"], ["1", "", "UNKNOWN"]
    ]) {
      const body = document.replace(environment("1"), environment(documentEnv));
      const result = parseFiscalXml(`<${wrapper}>${body}<prot${name}><infProt><ch${name}>${key}</ch${name}>
        <nProt>100000000000000</nProt>${environment(protocolEnv)}<cStat>100</cStat></infProt></prot${name}></${wrapper}>`);
      assert.ok(result.documentType !== "NFSE");
      assert.equal(result.fiscalStatus, expected);
    }
  }
});

test("CT-e resolve tomador indicado, referências e ausência do valor", () => {
  const doc = parseFiscalXml(cte);
  assert.ok(doc.documentType === "CTE");
  assert.equal(doc.companyParty.cnpj, "00123456000002");
  assert.deepEqual(doc.references, [{ kind: "NFE", targetKey: nfeKey }]);
  assert.equal(doc.referenceValue, null);
  const explicit = parseFiscalXml(cte.replace("<toma3><toma>2</toma></toma3>", "<toma4><toma>4</toma><CNPJ>00123456000003</CNPJ></toma4>"));
  assert.ok(explicit.documentType === "CTE");
  assert.equal(explicit.companyParty.cnpj, "00123456000003");
});

test("rejeita XML inválido, DTD, leiaute desconhecido e referência inválida", () => {
  for (const xml of ["<nfeProc", "<!DOCTYPE CTe>" + cte, "<document/>", cte.replace(nfeKey, "123"), nfe.replace("4.00", "9.99")]) {
    assert.throws(() => parseFiscalXml(xml));
  }
});

test("decodifica entidades XML e respeita CDATA sem aceitar declarações externas", () => {
  const withText = (value: string) => nfe.replace("<dest>", `<dest><xNome>${value}</xNome>`);
  const doc = parseFiscalXml(withText("A &amp; B &lt;&gt;&quot;&apos; &#231;&#xE3;"));
  assert.ok(doc.documentType === "NFE");
  assert.equal(doc.companyParty.name, "A & B <>\"' çã");
  const literal = parseFiscalXml(withText("<![CDATA[A &amp; B]]>"));
  assert.ok(literal.documentType === "NFE");
  assert.equal(literal.companyParty.name, "A &amp; B");
  assert.throws(() => parseFiscalXml(withText("&undeclared;")));
  assert.throws(() => parseFiscalXml('<!DOCTYPE NFe [<!ENTITY outside SYSTEM "urn:unused">]>' + withText("&outside;")));
});
