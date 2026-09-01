import { XMLParser, XMLValidator } from "fast-xml-parser";

export type InvoiceDocumentDetailDto = {
  documentFamily: "NFSE";
  layout: "NACIONAL" | "ABRASF";
  layoutVersion?: string;
  schemaVersion: 1;
  additionalData: Record<string, string>;
};

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
  descricaoServico?: string;
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
  documentDetail: InvoiceDocumentDetailDto;
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function collectPathValues(value: unknown, path: string[]): unknown[] {
  if (value === null || value === undefined) return [];
  if (!path.length) return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectPathValues(item, path));
  if (typeof value !== "object") return [];

  const [current, ...rest] = path;
  return collectPathValues((value as Record<string, unknown>)[current], rest);
}

function textByPath(value: unknown, path: string[]) {
  const values = collectPathValues(value, path)
    .map(text)
    .filter((item): item is string => Boolean(item));

  return values.length ? values.join(" | ") : undefined;
}

function firstTextByPath(value: unknown, paths: string[][]) {
  for (const path of paths) {
    const parsed = textByPath(value, path);
    if (parsed) return parsed;
  }
  return undefined;
}

function decimal(value: unknown): string | undefined {
  const parsed = text(value);
  return parsed ? parsed.replace(",", ".") : undefined;
}

function getByPath(obj: any, path: string[]): unknown {
  return path.reduce((acc: any, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

const EXTRAS_BLOCKED_PATH_PREFIXES = [
  "?xml",
  "NFSe.Signature",
  "CompNfse.Signature",
  "CompNfse.Nfse.Signature"
];

function shouldSkipExtrasPath(path: string) {
  return EXTRAS_BLOCKED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}.`));
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
      const nextPath = path ? `${path}.${key}` : key;
      if (shouldSkipExtrasPath(nextPath)) continue;
      flattenXmlFields(nested, nextPath, output);
    }
    return;
  }

  const normalized = String(value).trim();
  if (!normalized || !path || shouldSkipExtrasPath(path)) return;
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

function createParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    removeNSPrefix: true,
    parseTagValue: false
  });
}

function validateIdentifier(rawId: unknown) {
  const numericId = text(rawId)?.replace(/\D/g, "") ?? "";
  if (numericId.length < 44 || numericId.length > 50) {
    throw new Error("Identificador inválido: esperado código numérico entre 44 e 50 dígitos.");
  }
  return numericId;
}

function parseNacional(doc: any): NormalizedInvoiceDto {
  const infNfse = doc.NFSe.infNFSe;
  const dps = infNfse?.DPS?.infDPS;
  const codigoIdentificador = validateIdentifier(infNfse.Id);

  const extras: Record<string, string> = {};
  flattenXmlFields(doc, "", extras);
  const descricaoServico = firstTextByPath(infNfse, [
    ["DPS", "infDPS", "serv", "cServ", "xDescServ"],
    ["DPS", "infDPS", "servico", "descricao"],
    ["DPS", "infDPS", "servico", "discriminacao"],
    ["DPS", "infDPS", "itens", "descricao"],
    ["xDescServ"],
    ["xServ"]
  ]);

  const knownPaths = [
    "NFSe.versao",
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
    descricaoServico,
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
    extras,
    documentDetail: {
      documentFamily: "NFSE",
      layout: "NACIONAL",
      layoutVersion: text(doc.NFSe.versao),
      schemaVersion: 1,
      additionalData: extras
    }
  };
}

function extractAbrasfNationalKey(otherInformation: unknown) {
  const value = text(otherInformation);
  const match = value?.match(/CHAVE\s+NFS-?E\s+NACIONAL\s*:\s*(\d{44,50})/i);
  if (!match) {
    throw new Error(
      "Identificador da NFS-e ABRASF não encontrado: informe a CHAVE NFSE NACIONAL com 44 a 50 dígitos em OutrasInformacoes."
    );
  }
  return validateIdentifier(match[1]);
}

function normalizeAbrasfDateTime(value: unknown) {
  const parsed = text(value);
  if (!parsed) return undefined;

  const hasTimeWithoutOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(parsed);
  return hasTimeWithoutOffset ? `${parsed}-03:00` : parsed;
}

function parseAbrasf(doc: any): NormalizedInvoiceDto {
  const nfse = doc.CompNfse.Nfse;
  const infNfse = nfse.InfNfse;
  const declaration = infNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico;
  const service = declaration?.Servico;
  const serviceValues = service?.Valores;
  const nfseValues = infNfse?.ValoresNfse;
  const provider = infNfse?.PrestadorServico;
  const taker = declaration?.Tomador;
  const codigoIdentificador = extractAbrasfNationalKey(infNfse?.OutrasInformacoes);
  const extras: Record<string, string> = {};
  flattenXmlFields(doc, "", extras);

  const knownPaths = [
    "CompNfse.Nfse.versao",
    "CompNfse.Nfse.InfNfse.Numero",
    "CompNfse.Nfse.InfNfse.DataEmissao",
    "CompNfse.Nfse.InfNfse.ValoresNfse.BaseCalculo",
    "CompNfse.Nfse.InfNfse.ValoresNfse.Aliquota",
    "CompNfse.Nfse.InfNfse.ValoresNfse.ValorIss",
    "CompNfse.Nfse.InfNfse.ValoresNfse.ValorLiquidoNfse",
    "CompNfse.Nfse.InfNfse.PrestadorServico.IdentificacaoPrestador.CpfCnpj.Cnpj",
    "CompNfse.Nfse.InfNfse.PrestadorServico.RazaoSocial",
    "CompNfse.Nfse.InfNfse.PrestadorServico.Contato.Email",
    "CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Competencia",
    "CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Servico.Valores.ValorServicos",
    "CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Servico.Valores.ValorIss",
    "CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Servico.Valores.Aliquota",
    "CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Prestador.CpfCnpj.Cnpj",
    "CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Tomador.IdentificacaoTomador.CpfCnpj.Cnpj",
    "CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Tomador.RazaoSocial",
    "CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Tomador.Contato.Email"
  ];
  for (const knownPath of knownPaths) delete extras[knownPath];

  return {
    codigoIdentificador,
    numeroNota: text(infNfse.Numero) ?? "SEM_NUMERO",
    serie: text(declaration?.Rps?.IdentificacaoRps?.Serie),
    descricaoServico: text(service?.Discriminacao),
    dataEmissao: normalizeAbrasfDateTime(infNfse.DataEmissao),
    dataCompetencia: text(declaration?.Competencia),
    prestadorCnpj: text(provider?.IdentificacaoPrestador?.CpfCnpj?.Cnpj),
    prestadorNome: text(provider?.RazaoSocial),
    prestadorEmail: text(provider?.Contato?.Email),
    tomadorCnpj: text(taker?.IdentificacaoTomador?.CpfCnpj?.Cnpj),
    tomadorNome: text(taker?.RazaoSocial),
    tomadorEmail: text(taker?.Contato?.Email),
    valorBaseCalculo: decimal(nfseValues?.BaseCalculo),
    valorIssqn: decimal(nfseValues?.ValorIss),
    valorLiquido: decimal(nfseValues?.ValorLiquidoNfse),
    valorServico: decimal(serviceValues?.ValorServicos),
    aliquota: decimal(nfseValues?.Aliquota ?? serviceValues?.Aliquota),
    extras,
    documentDetail: {
      documentFamily: "NFSE",
      layout: "ABRASF",
      layoutVersion: text(nfse.versao),
      schemaVersion: 1,
      additionalData: extras
    }
  };
}

export function parseNFSeXml(xml: string): NormalizedInvoiceDto {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error(`XML inválido: ${validation.err.msg}`);
  }

  const doc = createParser().parse(xml);
  const isNacional = Boolean(doc?.NFSe?.infNFSe);
  const isAbrasf = Boolean(doc?.CompNfse?.Nfse?.InfNfse);

  if (isNacional && isAbrasf) {
    throw new Error("XML inválido: mais de um leiaute de NFS-e foi identificado.");
  }
  if (isNacional) return parseNacional(doc);
  if (isAbrasf) {
    const version = text(doc.CompNfse.Nfse.versao);
    if (version !== "2.02") {
      throw new Error(`Leiaute ABRASF não suportado: versão ${version ?? "não informada"}.`);
    }
    return parseAbrasf(doc);
  }

  throw new Error("XML inválido: leiaute de NFS-e não reconhecido.");
}
