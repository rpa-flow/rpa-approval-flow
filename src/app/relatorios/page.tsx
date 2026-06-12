"use client";

import { useEffect, useMemo, useState } from "react";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout } from "@/components/ui-kit";
import { ChartCard, EmptyState, ErrorState, KpiCard, LoadingState, ReportPageLayout, ReportTable } from "@/app/components/reports/report-components";
import { Input } from "@/components/ui/input";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/ui-kit";

type SummaryData = { total: number; approved: number; refused: number; processed: number; pending: number };
type CreatedProcessedData = { monthly: Array<{ month: string; created: number; processed: number; difference: number; conversionRate: number }> };
type SlaData = { monthly: Array<{ month: string; total: number; outOfSla: number; avgApprovalHours: number; outOfSlaRate: number }>; ranking: Array<{ numeroNota: string; fornecedor: string; gestor: string; approvalHours: number; outOfSla: boolean }> };
type RatingsRiskData = { summary: { totalInvoices: number; totalEvaluated: number; averageRating: number; highRiskEvaluations: number }; distribution: Record<string, number>; risks: Record<string, number>; supplierRanking: Array<{ supplierName: string; totalInvoices: number; evaluatedInvoices: number; avgRating: number; evaluationCoverage: number; highRisk: number; mediumRisk: number; lowRisk: number }> };

export default function RelatoriosPage() {
  const [tab, setTab] = useState<"geral" | "avaliacoes">("geral");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [createdProcessed, setCreatedProcessed] = useState<CreatedProcessedData | null>(null);
  const [sla, setSla] = useState<SlaData | null>(null);
  const [ratingsRisk, setRatingsRisk] = useState<RatingsRiskData | null>(null);
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
      fetch(`/api/relatorios/sla-aprovacao?${query}`).then((r) => r.json()),
      fetch(`/api/relatorios/avaliacoes?${query}`).then((r) => r.json())
    ]).then(([resumo, criadas, slaData, ratings]) => {
      setSummary(resumo);
      setCreatedProcessed(criadas);
      setSla(slaData);
      setRatingsRisk(ratings);
    }).catch(() => setError("Falha ao carregar relatórios."))
      .finally(() => setLoading(false));
  }, [from, to]);

  const riskBars = useMemo(() => {
    if (!ratingsRisk) return [];
    return Object.entries(ratingsRisk.risks).map(([level, value]) => [level, `${"█".repeat(Math.max(1, value))} (${value})`]);
  }, [ratingsRisk]);

  return <AppLayout>
    <MainHeader title="Relatórios executivos" subtitle="Histórico mensal, SLA, avaliações e risco" />
    <ReportPageLayout title="Dashboard Executivo" filters={<div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><div className="grid gap-3 sm:grid-cols-2"><FormField label="Data inicial"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></FormField><FormField label="Data final"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></FormField></div><TabsList role="tablist" aria-label="Tipo de relatório"><TabsTrigger type="button" active={tab === "geral"} onClick={() => setTab("geral")}>Visão Geral</TabsTrigger><TabsTrigger type="button" active={tab === "avaliacoes"} onClick={() => setTab("avaliacoes")}>Avaliações & Risco</TabsTrigger></TabsList></div>}>
      {loading && <LoadingState />}
      {!!error && <ErrorState text={error} />}
      {!loading && !error && tab === "geral" && <>
        {summary && <section className="grid gap-3 md:grid-cols-5">
          <KpiCard title="Total de notas" value={String(summary.total)} description="Recebidas/criadas" />
          <KpiCard title="Lançadas/processadas" value={String(summary.processed)} description="Conversão operacional" />
          <KpiCard title="Pendentes" value={String(summary.pending)} description="Aguardando aprovação" />
          <KpiCard title="Aprovadas" value={String(summary.approved)} description="Fluxo concluído" />
          <KpiCard title="Recusadas" value={String(summary.refused)} description="Rejeitadas" />
        </section>}
        <ChartCard title="Notas criadas x lançadas por mês">{createdProcessed?.monthly?.length ? <ReportTable headers={["Mês", "Criadas", "Lançadas", "Diferença", "Conversão"]} rows={createdProcessed.monthly.map((row) => [row.month, row.created, row.processed, row.difference, `${row.conversionRate}%`])} /> : <EmptyState text="Sem dados para o período selecionado." />}</ChartCard>
        <ChartCard title="Evolução de SLA de aprovação">{sla?.monthly?.length ? <ReportTable headers={["Mês", "Aprovadas", "Fora SLA", "% Fora SLA", "Tempo Médio (h)"]} rows={sla.monthly.map((row) => [row.month, row.total, row.outOfSla, `${row.outOfSlaRate}%`, row.avgApprovalHours])} /> : <EmptyState text="Sem aprovações no período." />}</ChartCard>
      </>}

      {!loading && !error && tab === "avaliacoes" && <>
        {ratingsRisk && <section className="grid gap-3 md:grid-cols-4">
          <KpiCard title="Notas avaliadas" value={String(ratingsRisk.summary.totalEvaluated)} description="Com avaliação registrada" />
          <KpiCard title="Média de avaliação" value={ratingsRisk.summary.averageRating.toFixed(2)} description="Escala 1 a 5" />
          <KpiCard title="Risco alto" value={String(ratingsRisk.summary.highRiskEvaluations)} description="Avaliações de risco ALTO" />
          <KpiCard title="Total de notas" value={String(ratingsRisk.summary.totalInvoices)} description="Base do período" />
        </section>}
        <ChartCard title="Distribuição de avaliações (1 a 5)">{ratingsRisk ? <ReportTable headers={["Nota", "Quantidade"]} rows={Object.entries(ratingsRisk.distribution).map(([n, q]) => [n, q])} /> : <EmptyState text="Sem avaliações." />}</ChartCard>
        <ChartCard title="Gráfico de risco (força relativa)">{riskBars.length ? <ReportTable headers={["Risco", "Barra"]} rows={riskBars} /> : <EmptyState text="Sem distribuição de risco." />}</ChartCard>
        <ChartCard title="Avaliações e riscos por fornecedor">{ratingsRisk?.supplierRanking?.length ? <ReportTable headers={["Fornecedor", "Notas", "Avaliadas", "Média", "% Cobertura", "Risco Alto", "Médio", "Baixo"]} rows={ratingsRisk.supplierRanking.map((s) => [s.supplierName, s.totalInvoices, s.evaluatedInvoices, s.avgRating, `${s.evaluationCoverage}%`, s.highRisk, s.mediumRisk, s.lowRisk])} /> : <EmptyState text="Sem fornecedores avaliados." />}</ChartCard>
      </>}
    </ReportPageLayout>
  </AppLayout>;
}
