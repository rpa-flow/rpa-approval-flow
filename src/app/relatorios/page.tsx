"use client";

import { useEffect, useState } from "react";
import { MainHeader } from "@/app/components/main-header";
import { ChartCard, EmptyState, ErrorState, KpiCard, LoadingState, ReportPageLayout, ReportTable } from "@/app/components/reports/report-components";

type SummaryData = { total: number; approved: number; refused: number; processed: number; pending: number; avgHours: number; totalValue: number; highRisk: number };
type CreatedProcessedData = { summary: { created: number; processed: number; difference: number; conversionRate: number }; monthly: Array<{ month: string; created: number; processed: number; difference: number; conversionRate: number }> };
type SlaData = { slaHours: number; monthly: Array<{ month: string; total: number; outOfSla: number; avgApprovalHours: number; outOfSlaRate: number }>; ranking: Array<{ numeroNota: string; fornecedor: string; gestor: string; approvalHours: number; outOfSla: boolean }> };

export default function RelatoriosPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [createdProcessed, setCreatedProcessed] = useState<CreatedProcessedData | null>(null);
  const [sla, setSla] = useState<SlaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    setLoading(true);
    const query = `from=${from}&to=${to}`;
    Promise.all([
      fetch(`/api/relatorios/resumo?${query}`).then((r) => r.json()),
      fetch(`/api/relatorios/notas-criadas-lancadas?${query}`).then((r) => r.json()),
      fetch(`/api/relatorios/sla-aprovacao?${query}`).then((r) => r.json())
    ]).then(([resumo, criadas, slaData]) => {
      setSummary(resumo);
      setCreatedProcessed(criadas);
      setSla(slaData);
    }).catch(() => setError("Falha ao carregar relatórios."))
      .finally(() => setLoading(false));
  }, [from, to]);

  return <main className="container container-wide space-y-4">
    <MainHeader title="Relatórios executivos" subtitle="Histórico mensal e evolução de SLA" />
    <ReportPageLayout title="Dashboard Executivo" filters={<div className="flex gap-2"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border p-2"/><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border p-2"/></div>}>
      {loading && <LoadingState />}
      {!!error && <ErrorState text={error} />}
      {summary && <section className="grid gap-3 md:grid-cols-5">
        <KpiCard title="Total de notas" value={String(summary.total)} description="Recebidas/criadas" />
        <KpiCard title="Lançadas/processadas" value={String(summary.processed)} description="Conversão operacional" />
        <KpiCard title="Pendentes" value={String(summary.pending)} description="Aguardando aprovação" />
        <KpiCard title="Aprovadas" value={String(summary.approved)} description="Fluxo concluído" />
        <KpiCard title="Recusadas" value={String(summary.refused)} description="Rejeitadas" />
      </section>}

      <ChartCard title="Notas criadas x lançadas por mês">
        {createdProcessed?.monthly?.length
          ? <ReportTable headers={["Mês", "Criadas", "Lançadas", "Diferença", "Conversão"]} rows={createdProcessed.monthly.map((row) => [row.month, row.created, row.processed, row.difference, `${row.conversionRate}%`])} />
          : <EmptyState text="Sem dados para o período selecionado." />}
      </ChartCard>

      <ChartCard title="Evolução de SLA de aprovação">
        {sla?.monthly?.length
          ? <ReportTable headers={["Mês", "Aprovadas", "Fora SLA", "% Fora SLA", "Tempo Médio (h)"]} rows={sla.monthly.map((row) => [row.month, row.total, row.outOfSla, `${row.outOfSlaRate}%`, row.avgApprovalHours])} />
          : <EmptyState text="Sem aprovações no período." />}
      </ChartCard>

      <ChartCard title="Ranking de maiores atrasos">
        {sla?.ranking?.length
          ? <ReportTable headers={["NF", "Fornecedor", "Gestor", "Tempo (h)", "Fora SLA"]} rows={sla.ranking.map((r) => [r.numeroNota, r.fornecedor, r.gestor, r.approvalHours, r.outOfSla ? "Sim" : "Não"])} />
          : <EmptyState text="Sem dados de atraso." />}
      </ChartCard>
    </ReportPageLayout>
  </main>;
}
