import type { RetentionDetails } from "@/lib/retention-details";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function RetentionHint({ details }: { details?: RetentionDetails }) {
  return <details className="mt-2 text-xs">
    <summary className="w-fit cursor-pointer rounded text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
      Ver retenções
    </summary>
    <div className="mt-2 rounded-md border border-border bg-surface-container-low p-3 text-text">
      {details?.items.length ? <>
        <p className="font-semibold">Retenções identificadas no XML</p>
        <dl className="mt-2 space-y-1">
          {details.items.map((item) => <div key={item.label} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt>{item.label}</dt>
            <dd className="font-medium tabular-nums">{currency.format(Number(item.amount))}</dd>
          </div>)}
        </dl>
        {details.status === "partial" && <p className="mt-2 text-muted">Os valores identificados não fecham com o total retido. A composição completa não pôde ser confirmada.</p>}
      </> : <p>O detalhamento das retenções não está disponível para esta nota.</p>}
    </div>
  </details>;
}
