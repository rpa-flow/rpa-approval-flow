import Link from "next/link";
import { formatFiscalDecimal as formatDecimal } from "@/app/components/fiscal-document-labels";
import { SectionCard } from "@/components/ui-kit/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FiscalReference, ParsedGoodsOrFreight } from "@/lib/fiscal-document-parser";

type NfeDetail = Extract<ParsedGoodsOrFreight, { documentType: "NFE" }>["detail"];
type CteDetail = Extract<ParsedGoodsOrFreight, { documentType: "CTE" }>["detail"];

export type FiscalDetailReference = FiscalReference | {
  kind: "SUBSTITUTED_BY_CTE";
  targetKey: string;
};

export type FiscalDocumentDetailsProps = (
  | { documentType: "NFE"; detail: NfeDetail }
  | { documentType: "CTE"; detail: CteDetail }
) & {
  references?: readonly (FiscalDetailReference & { accessibleInvoiceId?: string | null })[];
};

const REFERENCE_LABEL = {
  NFE: "NF-e referenciada",
  SUBSTITUTES_CTE: "CT-e original",
  SUBSTITUTED_BY_CTE: "CT-e substituto"
} as const;

const TAKER_ROLE: Record<string, string> = {
  "0": "Remetente", "1": "Expedidor", "2": "Recebedor", "3": "Destinatário", "4": "Outro tomador"
};

type Field = [label: string, value: string | null | undefined];

function Fields({ items }: { items: Field[] }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
    {items.map(([label, value]) => <div key={label} className="min-w-0">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="break-words text-sm text-text">{value ?? "Não informado"}</dd>
    </div>)}
  </dl>;
}

function Party({ label, value, role }: { label: string; value: NfeDetail["issuer"]; role?: string | null }) {
  const identifiers = [value.cnpj && `CNPJ ${value.cnpj}`, value.cpf && `CPF ${value.cpf}`, value.ie && `IE ${value.ie}`].filter(Boolean);
  return <div className="min-w-0 border-l border-border pl-3">
    <dt className="text-xs font-medium text-muted">{label}{role ? ` · ${role}` : ""}</dt>
    <dd className="break-words text-sm text-text">
      {value.name ?? (identifiers.length ? "Nome não informado" : "Não informado")}
      {identifiers.length > 0 && <span className="block text-xs text-muted">{identifiers.join(" · ")}</span>}
    </dd>
  </div>;
}

function NfeSections({ detail }: { detail: NfeDetail }) {
  return <>
    <SectionCard title="Operação e totais" description={detail.operation.natOp ?? undefined}>
      <dl className="mb-5 grid gap-4 sm:grid-cols-2">
        <Party label="Emitente" value={detail.issuer} />
        <Party label="Destinatário" value={detail.recipient} />
      </dl>
      <Fields items={[
        ["Total da NF-e", formatDecimal(detail.totals.vNF, true)],
        ["Total dos produtos", formatDecimal(detail.totals.vProd, true)],
        ["Frete", formatDecimal(detail.totals.vFrete, true)],
        ["Desconto", formatDecimal(detail.totals.vDesc, true)],
        ["ICMS", formatDecimal(detail.totals.vICMS, true)],
        ["IPI", formatDecimal(detail.totals.vIPI, true)],
        ["Outras despesas", formatDecimal(detail.totals.vOutro, true)]
      ]} />
    </SectionCard>
    <SectionCard title="Itens da NF-e">
      {detail.items.length === 0 ? <p className="text-sm text-muted">O XML não informa itens.</p> :
        <div className="overflow-x-auto rounded-card border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" tabIndex={0} role="region" aria-label="Tabela de itens da NF-e">
          <Table>
            <caption className="sr-only">Produtos, classificação fiscal, quantidades e valores da NF-e</caption>
            <TableHeader><TableRow>
              <TableHead scope="col">Produto</TableHead>
              <TableHead scope="col">Classificação fiscal</TableHead>
              <TableHead scope="col" className="text-right">Quantidade</TableHead>
              <TableHead scope="col" className="whitespace-nowrap text-right">Valor unitário</TableHead>
              <TableHead scope="col" className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>{detail.items.map((item, index) => <TableRow key={`${item.line ?? "item"}-${index}`}>
              <TableCell className="min-w-40"><span className="font-medium">{item.xProd ?? "Não informado"}</span>
                {item.cProd && <span className="block text-xs text-muted">Cód. {item.cProd}</span>}
              </TableCell>
              <TableCell className="min-w-28 text-xs">
                <span className="block">NCM {item.NCM ?? "—"}</span>
                <span className="block">CFOP {item.CFOP ?? "—"}</span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatDecimal(item.qCom) ?? "—"}{item.uCom && <span className="ml-1 text-xs text-muted">{item.uCom}</span>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatDecimal(item.vUnCom, true) ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{formatDecimal(item.vProd, true) ?? "—"}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>}
    </SectionCard>
  </>;
}

function location(city: string | null, region: string | null) {
  return [city, region].filter(Boolean).join(" / ") || null;
}

function CteSections({ detail }: { detail: CteDetail }) {
  return <>
    <SectionCard title="Partes e trajeto">
      <dl className="mb-5 grid gap-4 sm:grid-cols-2">
        <Party label="Emitente" value={detail.issuer} />
        <Party label="Tomador" value={detail.taker} role={detail.takerRole && (TAKER_ROLE[detail.takerRole] ?? detail.takerRole)} />
        <Party label="Remetente" value={detail.rem} />
        <Party label="Destinatário" value={detail.dest} />
        <Party label="Expedidor" value={detail.exped} />
        <Party label="Recebedor" value={detail.receb} />
      </dl>
      <Fields items={[["Origem", location(detail.route.xMunIni, detail.route.UFIni)], ["Destino", location(detail.route.xMunFim, detail.route.UFFim)]]} />
    </SectionCard>
    <SectionCard title="Frete">
      <Fields items={[["Valor total da prestação", formatDecimal(detail.freight.vTPrest, true)], ["Valor a receber", formatDecimal(detail.freight.vRec, true)]]} />
      {detail.components.length > 0 && <div className="mt-4 border-t border-border pt-3">
        <h4 className="mb-2 text-sm font-semibold text-text">Componentes do frete</h4>
        <dl className="divide-y divide-border">
          {detail.components.map((component, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm">
            <dt className="break-words">{component.xNome ?? "Não informado"}</dt>
            <dd className="tabular-nums">{formatDecimal(component.vComp, true) ?? "Não informado"}</dd>
          </div>)}
        </dl>
      </div>}
    </SectionCard>
    <SectionCard title="Carga">
      <Fields items={[
        ["Produto predominante", detail.cargo.proPred], ["Valor da carga", formatDecimal(detail.cargo.vCarga, true)],
        ["Outras características", detail.cargo.xOutCat]
      ]} />
      {detail.quantities.length > 0 && <div className="mt-4 border-t border-border pt-3">
        <h4 className="mb-2 text-sm font-semibold text-text">Medidas da carga</h4>
        <dl className="divide-y divide-border">
          {detail.quantities.map((quantity, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm">
            <dt className="break-words">{quantity.tpMed ?? "Medida não informada"}</dt>
            <dd className="text-right tabular-nums">{formatDecimal(quantity.qCarga) ?? "Não informado"}{quantity.cUnid && <span className="block text-xs text-muted">Cód. da unidade {quantity.cUnid}</span>}</dd>
          </div>)}
        </dl>
      </div>}
    </SectionCard>
  </>;
}

export function FiscalDocumentDetails(props: FiscalDocumentDetailsProps) {
  const { detail, references } = props;
  return <>
    {props.documentType === "NFE" ? <NfeSections detail={props.detail} /> : <CteSections detail={props.detail} />}
    {(props.documentType === "CTE" || Boolean(references?.length)) && <SectionCard title="Documentos relacionados">
      {references?.length ? <ul className="divide-y divide-border">
        {references.map((reference) => <li key={`${reference.kind}-${reference.targetKey}`} className="py-2 first:pt-0 last:pb-0">
          {reference.accessibleInvoiceId ? <Link className="inline-grid gap-1 rounded-sm text-sm text-brand underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href={`/notas/${encodeURIComponent(reference.accessibleInvoiceId)}`}>
            <span>{REFERENCE_LABEL[reference.kind]}</span>
            <span className="break-all font-mono text-xs">{reference.targetKey}</span>
          </Link> : <div className="grid gap-1">
            <span className="text-sm text-text">{REFERENCE_LABEL[reference.kind]}</span>
            <span className="break-all font-mono text-xs text-muted">{reference.targetKey}</span>
          </div>}
        </li>)}
      </ul> : <p className="text-sm text-muted">Nenhuma referência disponível.</p>}
    </SectionCard>}
    <SectionCard title="Protocolo fiscal" description="Dados informados no XML.">
      <Fields items={[["Número do protocolo", detail.protocol.nProt], ["Código da situação", detail.protocol.cStat], ["Motivo informado", detail.protocol.xMotivo]]} />
    </SectionCard>
  </>;
}
