import { XMLParser, XMLValidator } from "fast-xml-parser";
import { parseNFSeXml } from "./nfse-parser.ts";

type XmlNode = Record<string, unknown>;
type FiscalType = "NFE" | "CTE";
export type ProtocolStatus = "AUTHORIZED" | "CANCELLED" | "NOT_AUTHORIZED" | "UNKNOWN";
export type FiscalReference = { kind: "NFE" | "SUBSTITUTES_CTE"; targetKey: string };
export const FISCAL_PARSER_VERSION = "1";

const parser = new XMLParser({
  ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false,
  parseAttributeValue: false, processEntities: true, htmlEntities: true, ignoreDeclaration: true, ignorePiTags: true
});
const nodes = (value: unknown): unknown[] => value == null ? [] : Array.isArray(value) ? value : [value];
const node = (value: unknown): XmlNode => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as XmlNode : {};
const str = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

function fields<Key extends string>(value: unknown, keys: Key[]) {
  const source = node(value);
  return Object.fromEntries(keys.map(key => [key, str(source[key])])) as Record<Key, string | null>;
}

function party(value: unknown) {
  const source = node(value);
  return { cnpj: str(source.CNPJ), cpf: str(source.CPF), name: str(source.xNome), ie: str(source.IE) };
}

function protocolStatus(type: FiscalType, protocol: XmlNode, accessKey: string, documentEnvironment: unknown): ProtocolStatus {
  if (protocol[type === "NFE" ? "chNFe" : "chCTe"] !== accessKey || documentEnvironment !== "1" || protocol.tpAmb !== "1") return "UNKNOWN";
  if (protocol.cStat === "101" || (type === "NFE" && protocol.cStat === "151")) return "CANCELLED";
  if (["110", "301", "302"].includes(String(protocol.cStat))) return "NOT_AUTHORIZED";
  if (str(protocol.nProt) && (protocol.cStat === "100" || (type === "NFE" && protocol.cStat === "150"))) return "AUTHORIZED";
  return "UNKNOWN";
}

function identity(info: XmlNode, prefix: string) {
  const value = str(info["@_Id"]);
  if (!value?.startsWith(prefix) || !/^\d{44}$/.test(value.slice(prefix.length))) {
    throw new Error("Chave de acesso inválida no XML.");
  }
  return value.slice(prefix.length);
}

function common(type: FiscalType, info: XmlNode, protocol: XmlNode) {
  const ide = node(info.ide);
  const accessKey = identity(info, type === "NFE" ? "NFe" : "CTe");
  const number = str(type === "NFE" ? ide.nNF : ide.nCT);
  if (!number || !/^\d{1,9}$/.test(number)) throw new Error("Número do documento fiscal inválido.");
  if (str(info["@_versao"]) !== "4.00" || ide.mod !== (type === "NFE" ? "55" : "57")) {
    throw new Error("Modelo ou versão de XML fiscal não suportado.");
  }
  return {
    accessKey, number, issuedAt: str(ide.dhEmi), supplier: party(info.emit),
    fiscalStatus: protocolStatus(type, protocol, accessKey, ide.tpAmb),
    protocol: fields(protocol, ["cStat", "xMotivo", "nProt", "dhRecbto", "tpAmb"]),
    parserVersion: FISCAL_PARSER_VERSION
  };
}

function amount(value: unknown) {
  const raw = str(value);
  if (raw !== null && !/^\d{1,15}(?:\.\d{1,2})?$/.test(raw)) throw new Error("Valor fiscal inválido no XML.");
  return raw;
}

function parseNfe(info: XmlNode, protocol: XmlNode) {
  const base = common("NFE", info, protocol);
  const companyParty = party(info.dest);
  const totals = node(node(info.total).ICMSTot);
  return {
    ...base, documentType: "NFE" as const, companyParty, referenceValue: amount(totals.vNF),
    references: [] as FiscalReference[],
    detail: {
      issuer: base.supplier, recipient: companyParty, protocol: base.protocol,
      operation: fields(info.ide, ["natOp", "tpNF", "finNFe", "tpAmb"]),
      totals: fields(totals, ["vNF", "vProd", "vFrete", "vDesc", "vICMS", "vIPI", "vOutro"]),
      items: nodes(info.det).map(item => ({
        line: str(node(item)["@_nItem"]),
        ...fields(node(item).prod, ["cProd", "xProd", "NCM", "CFOP", "uCom", "qCom", "vUnCom", "vProd"])
      }))
    }
  };
}

function references(normal: XmlNode): FiscalReference[] {
  const refs = [
    ...nodes(node(normal.infDoc).infNFe).map(value => ({ kind: "NFE" as const, key: node(value).chave })),
    ...nodes(normal.infCteSub).map(value => ({ kind: "SUBSTITUTES_CTE" as const, key: node(value).chCte }))
  ];
  const distinct = new Map<string, FiscalReference>();
  for (const ref of refs) {
    const targetKey = str(ref.key);
    if (!targetKey || !/^\d{44}$/.test(targetKey)) throw new Error("Chave referenciada pelo CT-e inválida.");
    distinct.set(ref.kind + targetKey, { kind: ref.kind, targetKey });
  }
  return [...distinct.values()];
}

function parseCte(info: XmlNode, protocol: XmlNode) {
  const base = common("CTE", info, protocol);
  const ide = node(info.ide);
  const normal = node(info.infCTeNorm);
  const parties = { rem: party(info.rem), exped: party(info.exped), receb: party(info.receb), dest: party(info.dest) };
  const takers = [parties.rem, parties.exped, parties.receb, parties.dest];
  const role = str(node(ide.toma3).toma);
  const explicit = node(ide.toma4);
  const companyParty = role !== null && /^[0-3]$/.test(role) && !ide.toma4
    ? takers[Number(role)] : !ide.toma3 && explicit.toma === "4" ? party(explicit) : party(null);
  const freight = node(info.vPrest);
  const cargo = node(normal.infCarga);
  const refs = references(normal);
  if (refs.some(ref => ref.kind === "SUBSTITUTES_CTE" && ref.targetKey === base.accessKey)) {
    throw new Error("CT-e substituto referencia a própria chave.");
  }
  return {
    ...base, documentType: "CTE" as const, companyParty, referenceValue: amount(freight.vTPrest), references: refs,
    detail: {
      issuer: base.supplier, ...parties, taker: companyParty, takerRole: role ?? str(explicit.toma),
      protocol: base.protocol, route: fields(ide, ["tpCTe", "tpServ", "tpAmb", "xMunIni", "UFIni", "xMunFim", "UFFim"]),
      freight: fields(freight, ["vTPrest", "vRec"]), components: nodes(freight.Comp).map(comp => fields(comp, ["xNome", "vComp"])),
      cargo: fields(cargo, ["vCarga", "proPred", "xOutCat"]),
      quantities: nodes(cargo.infQ).map(q => fields(q, ["cUnid", "tpMed", "qCarga"]))
    }
  };
}

/** Detect only a supported document envelope. XML bytes are retained by the caller. */
export function parseFiscalXml(xml: string) {
  // The parser's numeric-reference decoder also accepts named HTML entities.
  // Allow only XML entities and ignore literal text in comments, PI and CDATA.
  const markup = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, "");
  if (/<!DOCTYPE\b/i.test(markup) || /&(?!(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[\da-fA-F]{1,6});)/.test(markup)
    || XMLValidator.validate(xml) !== true) throw new Error("XML fiscal inválido.");
  const root = node(parser.parse(xml));
  const names = Object.keys(root);
  if (names.length !== 1) throw new Error("Envie um documento fiscal por requisição.");
  const name = names[0];
  if (name === "NFSe" || name === "CompNfse") return { documentType: "NFSE" as const, nfse: parseNFSeXml(xml) };
  const body = node(root[name]);
  if (name === "NFe" || name === "nfeProc") {
    const invoice = name === "NFe" ? body : node(body.NFe);
    return parseNfe(node(invoice.infNFe), name === "nfeProc" ? node(node(body.protNFe).infProt) : {});
  }
  if (name === "CTe" || name === "cteProc") {
    const invoice = name === "CTe" ? body : node(body.CTe);
    return parseCte(node(invoice.infCte), name === "cteProc" ? node(node(body.protCTe).infProt) : {});
  }
  throw new Error("Leiaute de documento fiscal não reconhecido.");
}

export type ParsedGoodsOrFreight = Exclude<ReturnType<typeof parseFiscalXml>, { documentType: "NFSE" }>;
