import { XMLParser } from "fast-xml-parser";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function decimal(value: unknown): string | undefined {
  const parsed = text(value);
  return parsed ? parsed.replace(",", ".") : undefined;
}

function getByPath(obj: any, path: string[]): unknown {
  return path.reduce((acc: any, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

export function parseNFSeXml(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    removeNSPrefix: true,
    parseTagValue: false
  });

  const doc = parser.parse(xml);
  const infNfse = doc?.NFSe?.infNFSe;
  const dps = infNfse?.DPS?.infDPS;

  if (!infNfse) {
    throw new Error("XML inválido: bloco infNFSe não encontrado.");
  }

  const rawId = text(infNfse.Id) ?? "";
  const numericId = rawId.replace(/\D/g, "");
  if (numericId.length < 44) {
    throw new Error("Identificador inválido: esperado código numérico com pelo menos 44 dígitos.");
  }

  const codigoIdentificador = numericId.slice(0, 44);

  return {
    codigoIdentificador,
    numeroNota: text(infNfse.nNFSe) ?? "SEM_NUMERO",
    nDfse: text(infNfse.nDFSe),
    localEmissao: text(infNfse.xLocEmi),
    localPrestacao: text(infNfse.xLocPrestacao),
    municipioIncidencia: text(infNfse.xLocIncid),
    itemTributacaoNac: text(infNfse.xTribNac),
    itemTributacaoMun: text(infNfse.xTribMun),
    nbsDescricao: text(infNfse.xNBS),
    dataProcessamento: text(infNfse.dhProc),
    dataEmissao: text(dps?.dhEmi),
    dataCompetencia: text(dps?.dCompet),
    prestadorCnpj: text(getByPath(infNfse, ["emit", "CNPJ"])) ?? text(getByPath(dps, ["prest", "CNPJ"])),
    prestadorNome: text(getByPath(infNfse, ["emit", "xNome"])),
    prestadorEmail: text(getByPath(infNfse, ["emit", "email"])) ?? text(getByPath(dps, ["prest", "email"])),
    tomadorCnpj: text(getByPath(dps, ["toma", "CNPJ"])),
    tomadorNome: text(getByPath(dps, ["toma", "xNome"])),
    tomadorEmail: text(getByPath(dps, ["toma", "email"])),
    valorBaseCalculo: decimal(getByPath(infNfse, ["valores", "vBC"])),
    valorIssqn: decimal(getByPath(infNfse, ["valores", "vISSQN"])),
    valorTotalRetido: decimal(getByPath(infNfse, ["valores", "vTotalRet"])),
    valorLiquido: decimal(getByPath(infNfse, ["valores", "vLiq"])),
    valorServico: decimal(getByPath(dps, ["valores", "vServPrest", "vServ"])),
    aliquota: decimal(getByPath(infNfse, ["valores", "pAliqAplic"]))
  };
}
