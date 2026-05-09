"use client";

import { useEffect, useMemo, useState } from "react";
import { MainHeader } from "@/app/components/main-header";
import { ChartCard, EmptyState, ErrorState, KpiCard, LoadingState, ReportPageLayout, ReportTable, RiskBadge, StatusBadge } from "@/app/components/reports/report-components";

type Data = { total: number; approved: number; refused: number; processed: number; pending: number; avgHours: number; totalValue: number; highRisk: number; invoices: any[] };

export default function RelatoriosPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/relatorios/resumo?from=${from}&to=${to}`).then(async (r) => {
      if (!r.ok) throw new Error("Falha ao carregar relatórios");
      return r.json();
    }).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [from, to]);

  const createdVsProcessed = useMemo(() => {
    if (!data) return [];
    return data.invoices.slice(0, 10).map((i) => [new Date(i.createdAt).toLocaleDateString("pt-BR"), i.numeroNota, <StatusBadge key={i.id} status={i.status} />]);
  }, [data]);

  return <main className="container container-wide space-y-4">
    <MainHeader title="Relatórios executivos" subtitle="Visão estratégica e operacional" />
    <ReportPageLayout title="Dashboard Executivo" filters={<div className="flex gap-2"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border p-2"/><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border p-2"/></div>}>
      {loading && <LoadingState />}
      {!!error && <ErrorState text={error} />}
      {data && <>
        <section className="grid gap-3 md:grid-cols-5">
          <KpiCard title="Total de notas" value={String(data.total)} description="Recebidas/criadas" />
          <KpiCard title="Lançadas/processadas" value={String(data.processed)} description="Conversão operacional" />
          <KpiCard title="Pendentes" value={String(data.pending)} description="Aguardando aprovação" />
          <KpiCard title="Aprovadas" value={String(data.approved)} description="Fluxo concluído" />
          <KpiCard title="Recusadas" value={String(data.refused)} description="Rejeitadas" />
          <KpiCard title="Valor processado" value={data.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} description="Somatório filtrado" />
          <KpiCard title="Tempo médio aprovação" value={`${data.avgHours.toFixed(1)}h`} description="SLA de aprovação" />
          <KpiCard title="Alto risco" value={String(data.highRisk)} description="Fornecedores críticos" />
        </section>
        <ChartCard title="Notas criadas x lançadas (amostra)">{createdVsProcessed.length ? <ReportTable headers={["Data", "NF", "Status"]} rows={createdVsProcessed} /> : <EmptyState text="Sem dados no período." />}</ChartCard>
        <ChartCard title="Atenção necessária"><p className="text-sm">Pendências: {data.pending} • Recusas: {data.refused} • Alto risco: <RiskBadge risk={String(data.highRisk)} /></p></ChartCard>
      </>}
    </ReportPageLayout>
  </main>;
}
