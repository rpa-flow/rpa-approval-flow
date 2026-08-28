"use client";

import Link from "next/link";
import { ComponentType, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, FileText, LayoutDashboard, RefreshCw } from "lucide-react";
import { MainHeader } from "@/app/components/main-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppLayout, EmptyState, LoadingState, SectionCard } from "@/components/ui-kit";
import type { SupportDashboard as DashboardData } from "@/lib/support-dashboard";

type DayPoint = DashboardData["download"]["byDay"][number];

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Kpi({ label, value, detail, tone = "neutral", icon: Icon }: { label: string; value: string; detail: string; tone?: "neutral" | "danger" | "warning" | "success"; icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" }> }) {
  const toneClass = { neutral: "text-brand", danger: "text-rose-700", warning: "text-amber-700", success: "text-emerald-700" }[tone];
  return <Card><CardContent className="pt-5 sm:pt-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p><p className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</p><p className="mt-1 text-xs leading-5 text-muted">{detail}</p></div><Icon aria-hidden="true" className={toneClass} size={22} /></div></CardContent></Card>;
}

function ErrorChart({ points }: { points: DayPoint[] }) {
  const max = Math.max(1, ...points.flatMap((point) => [point.errors, point.downloads]));
  if (!points.some((point) => point.errors || point.downloads)) return <EmptyState title="Nenhuma atividade de download no período." />;
  return <div><div className="mb-4 flex gap-4 text-xs text-muted"><span><i className="mr-1 inline-block h-2.5 w-2.5 bg-brand" />Downloads</span><span><i className="mr-1 inline-block h-2.5 w-2.5 bg-rose-600" />Erros</span></div><div className="flex h-52 items-end gap-1 overflow-x-auto border-b border-border pb-1" role="img" aria-label={`Histórico de downloads e erros em ${points.length} dias`}>
    {points.map((point) => <div key={point.date} className="flex h-full min-w-3 flex-1 items-end gap-px" title={`${point.date}: ${point.downloads} downloads, ${point.errors} erros`}><span className="w-1/2 bg-brand" style={{ height: `${Math.max(point.downloads ? 2 : 0, point.downloads / max * 100)}%` }} /><span className="w-1/2 bg-rose-600" style={{ height: `${Math.max(point.errors ? 2 : 0, point.errors / max * 100)}%` }} /></div>)}
  </div><details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-brand">Ver dados do gráfico</summary><div className="mt-2 max-h-48 overflow-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Data</th><th className="p-2">Downloads</th><th className="p-2">Erros</th></tr></thead><tbody>{points.map((p) => <tr key={p.date} className="border-t border-border"><td className="p-2">{p.date}</td><td className="p-2">{p.downloads}</td><td className="p-2">{p.errors}</td></tr>)}</tbody></table></div></details></div>;
}

function urgencyBadge(days: number) {
  if (days < 0) return <Badge variant="destructive">Vencida há {Math.abs(days)} dia{Math.abs(days) === 1 ? "" : "s"}</Badge>;
  if (days === 0) return <Badge variant="destructive">Vence hoje</Badge>;
  return <Badge variant="warning">Vence em {days} dia{days === 1 ? "" : "s"}</Badge>;
}

export function SupportDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch("/api/admin/suporte/dashboard", { cache: "no-store" }); if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error || "Não foi possível carregar os indicadores."); } setData(await response.json() as DashboardData); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar os indicadores."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const healthPct = useMemo(() => data?.health.totalCompanies ? Math.round((data.health.healthyCompanies / data.health.totalCompanies) * 100) : 0, [data]);

  return <AppLayout><MainHeader title="Suporte" subtitle="Monitoramento operacional" /><section className="space-y-4" aria-labelledby="support-title"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase text-brand">Área restrita</p><h1 id="support-title" className="text-2xl font-semibold text-text">Saúde da operação</h1><p className="mt-1 text-sm text-muted">Falhas de download, vencimentos e sinais para atuação do suporte.</p></div><Button type="button" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw aria-hidden="true" className={loading ? "animate-spin" : ""} size={16} /> Atualizar</Button></header>
    {loading && !data && <LoadingState rows={6} />}
    {error && <Alert variant="destructive"><div className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button type="button" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div></Alert>}
    {data && <><p className="text-xs text-muted" aria-live="polite">Atualizado em {dateFormatter.format(new Date(data.generatedAt))} · janela de {data.filters.periodDays} dias · vencimentos em até {data.filters.dueDays} dias</p>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principais"><Kpi label="Erros atuais" value={numberFormatter.format(data.download.currentRetryErrors)} detail={`${data.download.affectedCompanies} empresa(s) afetada(s)`} tone="danger" icon={AlertCircle} /><Kpi label="Taxa de erro" value={`${data.download.errorRatePct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} detail={`${data.download.errorsInPeriod} erros no período`} tone={data.download.errorRatePct > 0 ? "warning" : "success"} icon={LayoutDashboard} /><Kpi label="Notas urgentes" value={numberFormatter.format(data.due.overdueCount + data.due.dueTodayCount + data.due.dueSoonCount)} detail={`${data.due.overdueCount} vencida(s), ${data.due.dueTodayCount} hoje`} tone="warning" icon={FileText} /><Kpi label="Empresas saudáveis" value={`${healthPct}%`} detail={`${data.health.healthyCompanies} de ${data.health.totalCompanies} empresas`} tone="success" icon={Building2} /></section>
      <div className="grid gap-4 xl:grid-cols-3"><SectionCard title="Downloads e erros" description="Volume diário da integração" className="xl:col-span-2"><ErrorChart points={data.download.byDay} /></SectionCard><SectionCard title="Saúde das empresas" description="Sinais que exigem investigação"><dl className="space-y-3 text-sm">{[["Com erros", data.health.companiesWithErrors], ["Com gaps", data.health.companiesWithGaps], ["Nunca consultadas", data.health.companiesNeverScanned], ["Sem atualização recente", data.health.staleCompanies], ["Gaps pendentes", data.health.totalPendingGaps], ["Falhas de processamento", data.health.invoicesProcessingError], ["Falhas Delphi", data.health.delphiFailures]].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0"><dt className="text-muted">{label}</dt><dd className="font-semibold text-text">{numberFormatter.format(Number(value))}</dd></div>)}</dl></SectionCard></div>
      <SectionCard title="Erros recentes de download" description="Ocorrências atuais para diagnóstico">{data.download.recentErrors.length === 0 ? <EmptyState title="Nenhum erro atual de download." description="As integrações estão sem falhas pendentes." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase text-muted"><th className="p-3">Empresa</th><th className="p-3">NSU</th><th className="p-3">Tentativas</th><th className="p-3">HTTP</th><th className="p-3">Última tentativa</th><th className="p-3">Erro</th><th className="p-3"><span className="sr-only">Ação</span></th></tr></thead><tbody>{data.download.recentErrors.map((item) => <tr key={`${item.companyId}-${item.nsu}`} className="border-b border-border align-top last:border-0"><td className="p-3"><strong className="block text-text">{item.companyName}</strong></td><td className="p-3 font-mono">{item.nsu}</td><td className="p-3">{item.attempts}</td><td className="p-3">{item.httpStatus ?? "—"}</td><td className="p-3 whitespace-nowrap">{dateFormatter.format(new Date(item.attemptedAt))}</td><td className="max-w-xs p-3 text-muted"><span className="line-clamp-2" title={item.message ?? undefined}>{item.message || "Sem detalhe informado"}</span></td><td className="p-3"><Link className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2" href={`/empresas?empresa=${item.companyId}`}>Diagnóstico</Link></td></tr>)}</tbody></table></div>}</SectionCard>
      <SectionCard title="Notas próximas do vencimento" description={`${data.due.overdueCount} vencida(s), ${data.due.dueTodayCount} hoje e ${data.due.withoutDueDateCount} sem vencimento`}>{data.due.items.length === 0 ? <EmptyState title="Nenhuma nota próxima do vencimento." description="Não há vencidas nem vencimentos na janela monitorada." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.due.items.map((item) => <article key={item.id} className="rounded-card border border-border bg-surface-container-lowest p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-muted">Nota {item.numeroNota}</p><h3 className="font-semibold text-text">{item.supplierName}</h3></div>{urgencyBadge(item.daysUntilDue)}</div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted">Vencimento</dt><dd className="font-medium">{new Date(item.dataPagamento).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</dd></div><div><dt className="text-xs text-muted">Valor</dt><dd className="font-medium">{item.valorServico ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.valorServico)) : "—"}</dd></div></dl><Link className="mt-4 inline-flex font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2" href={`/notas/${item.id}`}>Abrir nota</Link></article>)}</div>}</SectionCard>
      {data.health.totalCompanies === 0 && <EmptyState title="Ainda não há empresas monitoradas." description="Os indicadores aparecerão quando houver empresas configuradas." icon={<Building2 aria-hidden="true" size={28} />} />}
    </>}
  </section></AppLayout>;
}
