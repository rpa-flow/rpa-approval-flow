import test from "node:test";
import assert from "node:assert/strict";
import { parseNFSeXml, simplifyExtrasByFieldName } from "./nfse-parser.ts";

const baseId = "NFS12345678901234567890123456789012345678901234";

test("known fields are mapped", () => {
  const xml = `<NFSe><infNFSe><Id>${baseId}</Id><nNFSe>10</nNFSe><nDFSe>99</nDFSe><DPS><infDPS><serie>70000</serie><dhEmi>2026-01-01</dhEmi><dCompet>2026-01-31</dCompet><prest><CNPJ>111</CNPJ><email>a@a.com</email></prest><toma><CNPJ>222</CNPJ></toma><valores><vServPrest><vServ>100,50</vServ></vServPrest></valores></infDPS></DPS><valores><vBC>100,50</vBC><vISSQN>5,00</vISSQN></valores></infNFSe></NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.numeroNota, "10");
  assert.equal(parsed.serie, "70000");
  assert.equal(parsed.dataCompetencia, "2026-01-31");
  assert.equal(parsed.valorServico, "100.50");
});

test("maps competence date from DPS dCompet without changing the day", () => {
  const xml = `<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="${baseId}"><nNFSe>810</nNFSe><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infDPS><dhEmi>2026-06-01T08:57:40-03:00</dhEmi><dCompet>2026-06-01</dCompet></infDPS></DPS></infNFSe></NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.dataCompetencia, "2026-06-01");
});

test("maps service description from DPS service code", () => {
  const xml = `<NFSe><infNFSe><Id>${baseId}</Id><nNFSe>10</nNFSe><DPS><infDPS><serv><cServ><xDescServ>Servicos de manutencao industrial</xDescServ></cServ></serv></infDPS></DPS></infNFSe></NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.descricaoServico, "Servicos de manutencao industrial");
  assert.equal(
    parsed.extras["NFSe.infNFSe.DPS.infDPS.serv.cServ.xDescServ"],
    "Servicos de manutencao industrial"
  );
});

test("unknown fields go to extras", () => {
  const xml = `<NFSe><infNFSe><Id>${baseId}</Id><nNFSe>10</nNFSe><DPS><infDPS><campoDesconhecido>xyz</campoDesconhecido><itens><descricao>A</descricao></itens><itens><descricao>B</descricao></itens></infDPS></DPS></infNFSe></NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.campoDesconhecido"], "xyz");
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.itens[0].descricao"], "A");
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.itens[1].descricao"], "B");
});

test("fields persisted in Invoice are not duplicated and series remains in details", () => {
  const xml = `<NFSe><infNFSe><Id>${baseId}</Id><nNFSe>10</nNFSe><DPS><infDPS><serie>70000</serie></infDPS></DPS></infNFSe></NFSe>`;
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.extras["NFSe.infNFSe.nNFSe"], undefined);
  assert.equal(parsed.extras["NFSe.infNFSe.DPS.infDPS.serie"], "70000");
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

const abrasfXml = `<?xml version="1.0" encoding="utf-8"?>
<CompNfse><Nfse versao="2.02"><InfNfse Id="57469004">
<Numero>567531</Numero><CodigoVerificacao>2PYLRC18Q</CodigoVerificacao>
<DataEmissao>2026-08-28T11:45:10.62</DataEmissao>
<OutrasInformacoes>[CHAVE NFSE NACIONAL: 31367021210750188000149000000056753126080574690044]</OutrasInformacoes>
<ValoresNfse><BaseCalculo>690.00</BaseCalculo><Aliquota>2.00</Aliquota><ValorIss>13.80</ValorIss><ValorLiquidoNfse>690.00</ValorLiquidoNfse></ValoresNfse>
<PrestadorServico><IdentificacaoPrestador><CpfCnpj><Cnpj>10750188000149</Cnpj></CpfCnpj><InscricaoMunicipal>116559004</InscricaoMunicipal></IdentificacaoPrestador><RazaoSocial>E-AUDITORIA SOFTWARES COMO SERVICO S.A.</RazaoSocial><Contato><Email>financeiro@e-auditoria.com.br</Email></Contato></PrestadorServico>
<DeclaracaoPrestacaoServico><InfDeclaracaoPrestacaoServico>
<Rps><IdentificacaoRps><Numero>567293</Numero><Serie>000</Serie><Tipo>1</Tipo></IdentificacaoRps></Rps><Competencia>2026-08-01</Competencia>
<Servico><Valores><ValorServicos>690.00</ValorServicos><ValorIss>13.80</ValorIss><Aliquota>2.00</Aliquota></Valores><Discriminacao>Nova eA Plus</Discriminacao><CodigoNbs>111032200</CodigoNbs></Servico>
<Prestador><CpfCnpj><Cnpj>10750188000149</Cnpj></CpfCnpj><InscricaoMunicipal>116559004</InscricaoMunicipal></Prestador>
<Tomador><IdentificacaoTomador><CpfCnpj><Cnpj>31096483000101</Cnpj></CpfCnpj></IdentificacaoTomador><RazaoSocial>Minas Mineracao LTDA</RazaoSocial><Contato><Email>fiscal@minasmineracao.com.br</Email></Contato></Tomador>
</InfDeclaracaoPrestacaoServico></DeclaracaoPrestacaoServico>
</InfNfse></Nfse></CompNfse>`;

test("maps equivalent ABRASF 2.02 fields and keeps only additional fields in detail", () => {
  const parsed = parseNFSeXml(abrasfXml);

  assert.equal(parsed.codigoIdentificador, "31367021210750188000149000000056753126080574690044");
  assert.equal(parsed.numeroNota, "567531");
  assert.equal(parsed.serie, "000");
  assert.equal(parsed.dataEmissao, "2026-08-28T11:45:10.62-03:00");
  assert.equal(parsed.dataCompetencia, "2026-08-01");
  assert.equal(parsed.prestadorCnpj, "10750188000149");
  assert.equal(parsed.tomadorCnpj, "31096483000101");
  assert.equal(parsed.valorServico, "690.00");
  assert.equal(parsed.valorLiquido, "690.00");
  assert.equal(parsed.documentDetail.layout, "ABRASF");
  assert.equal(parsed.documentDetail.layoutVersion, "2.02");
  assert.equal(parsed.extras["CompNfse.Nfse.InfNfse.CodigoVerificacao"], "2PYLRC18Q");
  assert.equal(parsed.extras["CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Servico.CodigoNbs"], "111032200");
  assert.equal(parsed.extras["CompNfse.Nfse.InfNfse.ValoresNfse.ValorLiquidoNfse"], undefined);
  assert.equal(parsed.extras["CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Servico.Valores.ValorIss"], undefined);
  assert.equal(parsed.extras["CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Prestador.CpfCnpj.Cnpj"], undefined);
  assert.equal(
    parsed.extras["CompNfse.Nfse.InfNfse.OutrasInformacoes"],
    "[CHAVE NFSE NACIONAL: 31367021210750188000149000000056753126080574690044]"
  );
  assert.equal(
    parsed.extras["CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Rps.IdentificacaoRps.Serie"],
    "000"
  );
});

test("rejects ABRASF without a compatible national key", () => {
  const xml = abrasfXml.replace(
    "[CHAVE NFSE NACIONAL: 31367021210750188000149000000056753126080574690044]",
    "Informação sem chave nacional"
  );
  assert.throws(() => parseNFSeXml(xml), /CHAVE NFSE NACIONAL/);
});

test("rejects unsupported ABRASF versions", () => {
  assert.throws(() => parseNFSeXml(abrasfXml.replace('versao="2.02"', 'versao="2.03"')), /versão 2\.03/);
});

test("rejects unknown XML layouts", () => {
  assert.throws(() => parseNFSeXml("<Documento><Numero>1</Numero></Documento>"), /não reconhecido/);
});

test("ignores ABRASF signatures in additional data", () => {
  const xml = abrasfXml.replace(
    "</Nfse>",
    "<Signature><SignatureValue>abc</SignatureValue></Signature></Nfse>"
  );
  const parsed = parseNFSeXml(xml);
  assert.equal(parsed.extras["CompNfse.Nfse.Signature.SignatureValue"], undefined);
});
