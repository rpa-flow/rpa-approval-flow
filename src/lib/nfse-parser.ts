import { XMLParser } from "fast-xml-parser";

export type NormalizedInvoiceDto = {
  codigoIdentificador: string;
  numeroNota: string;
  serie?: string;
  nDfse?: string;
  localEmissao?: string;
  localPrestacao?: string;
  municipioIncidencia?: string;
  itemTributacaoNac?: string;
  itemTributacaoMun?: string;
  nbsDescricao?: string;
  dataProcessamento?: string;
  dataEmissao?: string;
  dataCompetencia?: string;
  prestadorCnpj?: string;
  prestadorNome?: string;
  prestadorEmail?: string;
  tomadorCnpj?: string;
  tomadorNome?: string;
  tomadorEmail?: string;
  valorBaseCalculo?: string;
  valorIssqn?: string;
  valorTotalRetido?: string;
  valorLiquido?: string;
  valorServico?: string;
  aliquota?: string;
  extras: Record<string, string>;
};

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

function flattenXmlFields(value: unknown, path: string, output: Record<string, string>) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenXmlFields(item, `${path}[${index}]`, output));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith("@_")) continue;
      flattenXmlFields(nested, path ? `${path}.${key}` : key, output);
    }
    return;
  }

  const normalized = String(value).trim();
  if (!normalized || !path) return;
  output[path] = normalized;
}


export function groupExtrasByFieldName(extras: Record<string, string>) {
  const grouped: Record<string, Array<{ path: string; value: string }>> = {};

  for (const [path, value] of Object.entries(extras)) {
    const fieldName = path.split(".").pop()?.replace(/\[\d+\]$/g, "") ?? path;
    if (!grouped[fieldName]) grouped[fieldName] = [];
    grouped[fieldName].push({ path, value });
  }

  return grouped;
}


export function simplifyExtrasByFieldName(extras: Record<string, string>) {
  const grouped = groupExtrasByFieldName(extras);
  const simplified: Record<string, string | string[]> = {};

  for (const [fieldName, entries] of Object.entries(grouped)) {
    if (entries.length === 1) {
      simplified[fieldName] = entries[0].value;
      continue;
    }

    simplified[fieldName] = entries.map((entry) => entry.value);
  }

  return simplified;
}

export function parseNFSeXml(xml: string): NormalizedInvoiceDto {
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
  const extras: Record<string, string> = {};
  flattenXmlFields(doc, "", extras);

  const knownPaths = [
    "NFSe.infNFSe.Id",
    "NFSe.infNFSe.nNFSe",
    "NFSe.infNFSe.nDFSe",
    "NFSe.infNFSe.xLocEmi",
    "NFSe.infNFSe.xLocPrestacao",
    "NFSe.infNFSe.xLocIncid",
    "NFSe.infNFSe.xTribNac",
    "NFSe.infNFSe.xTribMun",
    "NFSe.infNFSe.xNBS",
    "NFSe.infNFSe.dhProc",
    "NFSe.infNFSe.DPS.infDPS.serie",
    "NFSe.infNFSe.DPS.infDPS.dhEmi",
    "NFSe.infNFSe.DPS.infDPS.dCompet",
    "NFSe.infNFSe.emit.CNPJ",
    "NFSe.infNFSe.emit.xNome",
    "NFSe.infNFSe.emit.email",
    "NFSe.infNFSe.DPS.infDPS.prest.CNPJ",
    "NFSe.infNFSe.DPS.infDPS.prest.email",
    "NFSe.infNFSe.DPS.infDPS.toma.CNPJ",
    "NFSe.infNFSe.DPS.infDPS.toma.xNome",
    "NFSe.infNFSe.DPS.infDPS.toma.email",
    "NFSe.infNFSe.valores.vBC",
    "NFSe.infNFSe.valores.vISSQN",
    "NFSe.infNFSe.valores.vTotalRet",
    "NFSe.infNFSe.valores.vLiq",
    "NFSe.infNFSe.DPS.infDPS.valores.vServPrest.vServ",
    "NFSe.infNFSe.valores.pAliqAplic"
  ];

  for (const knownPath of knownPaths) {
    delete extras[knownPath];
  }

  return {
    codigoIdentificador,
    numeroNota: text(infNfse.nNFSe) ?? "SEM_NUMERO",
    serie: text(dps?.serie),
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
    aliquota: decimal(getByPath(infNfse, ["valores", "pAliqAplic"])),
    extras
  };
}
