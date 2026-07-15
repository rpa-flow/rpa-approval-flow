"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { DataTable, FormField, PaginationControls, SectionCard } from "@/components/ui-kit";
import type { PaginationMetadata } from "@/lib/pagination";
import { NfseProcessingStatusBadge } from "./nfse-processing-status-badge";

type Summary = { companyId: string; cnpj: string; companyName: string; lastContiguousNsu: number | null; highestScannedNsu: number | null; checkpointDistance: number | null; lastScanAt: string | null; lastDocumentDownloadedAt: string | null; pendingGapCount: number; retryErrorCount: number; downloadedCount: number; ignoredCount: number; totalAttempts: number; processingStatus: string };
type NsuRow = { nsu: number; status: string; attempts: number; firstAttemptAt: string; lastAttemptAt: string; lastHttpStatus: number | null; lastError: string | null; documentId: string | null; hasLaterResolvedNsus: boolean };
type Attempt = { attemptedAt: string; resultStatus: string; httpStatus: number | null; errorMessage: string | null; wasNsuScanned: boolean; documentId: string | null; accessKey: string | null; ignoreReason: string | null };
const defaultPagination: PaginationMetadata = { page: 1, pageSize: 10, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false };
function fmt(value?: string | null) { return value ? new Date(value).toLocaleString("pt-BR") : "—"; }
function metric(label: string, value: ReactNode, hint?: string) { return <div className="rounded-md border border-border bg-surface-container-low p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 text-xl font-bold text-slate-900" title={hint}>{value ?? "—"}</div></div>; }

export function NfseProcessingSection({ companyId }: { companyId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<NsuRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>(defaultPagination);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [nsuFrom, setNsuFrom] = useState("");
  const [nsuTo, setNsuTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedNsu, setSelectedNsu] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (status) params.set("status", status);
    if (nsuFrom) params.set("nsuFrom", nsuFrom);
    if (nsuTo) params.set("nsuTo", nsuTo);
    if (quickFilter) params.set(quickFilter, "true");
    try {
      const [summaryRes, nsusRes] = await Promise.all([fetch(`/api/companies/${companyId}/nfse/nsu-summary`), fetch(`/api/companies/${companyId}/nfse/nsus?${params}`)]);
      if (!summaryRes.ok) throw new Error("summary");
      if (!nsusRes.ok) throw new Error("nsus");
      setSummary(await summaryRes.json());
      const payload = await nsusRes.json();
      setRows(payload.items); setPagination(payload.pagination);
    } catch { setError("Erro ao carregar dados de processamento de NFS-e."); }
    finally { setLoading(false); }
  }, [companyId, nsuFrom, nsuTo, page, quickFilter, status]);

  useEffect(() => { load(); }, [load]);

  async function openAttempts(nsu: number) {
    setSelectedNsu(nsu); setAttempts([]);
    const res = await fetch(`/api/companies/${companyId}/nfse/nsus/${nsu}/attempts`);
    if (res.ok) setAttempts((await res.json()).items);
  }

  const never = summary?.processingStatus === "NeverScanned";
  return <SectionCard title="Processamento de NFS-e" description="Acompanhamento somente de leitura dos NSUs informados pelo serviço consumidor." actions={<Button type="button" variant="outline" onClick={load} disabled={loading}>Atualizar</Button>}>
    {error && <Alert variant="destructive">{error}</Alert>}
    {summary && <div className="mb-4 grid gap-3 md:grid-cols-4">
      {metric("Situação", <NfseProcessingStatusBadge status={summary.processingStatus} />)}
      {metric("Gaps pendentes", summary.pendingGapCount)}
      {metric("Erros pendentes", summary.retryErrorCount)}
      {metric("Documentos baixados", summary.downloadedCount)}
      {metric("Último NSU contínuo", summary.lastContiguousNsu)}
      {metric("Maior NSU consultado", summary.highestScannedNsu)}
      {metric("Distância checkpoints", summary.checkpointDistance, "A diferença entre os checkpoints indica que existem NSUs posteriores consultados, mas não representa necessariamente a quantidade de gaps.")}
      {metric("Última consulta", fmt(summary.lastScanAt))}
    </div>}
    {never && <Alert>Ainda não existem registros de processamento de NFS-e para esta empresa.</Alert>}
    {summary && !never && summary.pendingGapCount === 0 && summary.retryErrorCount === 0 && <Alert variant="success">Nenhum gap ou erro pendente foi identificado.</Alert>}
    <div className="mb-4 grid gap-3 rounded-md border border-border bg-surface-container-low p-3 md:grid-cols-5">
      <FormField label="Status"><Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Todos</option><option value="Downloaded">Baixado</option><option value="PendingGap">Gap</option><option value="RetryError">Erro</option><option value="IgnoredByRule">Ignorado</option></Select></FormField>
      <FormField label="NSU inicial"><Input value={nsuFrom} onChange={(e) => { setNsuFrom(e.target.value.replace(/\D/g, "")); setPage(1); }} /></FormField>
      <FormField label="NSU final"><Input value={nsuTo} onChange={(e) => { setNsuTo(e.target.value.replace(/\D/g, "")); setPage(1); }} /></FormField>
      <FormField label="Filtro rápido"><Select value={quickFilter} onChange={(e) => { setQuickFilter(e.target.value); setPage(1); }}><option value="">Todos</option><option value="onlyGaps">Somente gaps</option><option value="onlyErrors">Somente erros</option><option value="onlyResolved">Somente resolvidos</option></Select></FormField>
      <div className="flex items-end"><Button type="button" variant="outline" onClick={() => { setStatus(""); setNsuFrom(""); setNsuTo(""); setQuickFilter(""); setPage(1); }}>Limpar filtros</Button></div>
    </div>
    <DataTable data={rows} getRowKey={(r) => String(r.nsu)} loading={loading} emptyTitle="Nenhum registro corresponde aos filtros selecionados" columns={[{ key: "nsu", header: "NSU", cell: (r) => <span className="font-mono">{r.nsu}</span> }, { key: "status", header: "Status", cell: (r) => <NfseProcessingStatusBadge status={r.status} /> }, { key: "attempts", header: "Tentativas", cell: (r) => r.attempts }, { key: "first", header: "Primeira tentativa", cell: (r) => fmt(r.firstAttemptAt) }, { key: "last", header: "Última tentativa", cell: (r) => fmt(r.lastAttemptAt) }, { key: "http", header: "HTTP", cell: (r) => r.lastHttpStatus ?? "—" }, { key: "error", header: "Último erro", cell: (r) => <span className="line-clamp-2">{r.lastError ?? "—"}</span> }, { key: "doc", header: "Documento", cell: (r) => r.documentId ?? "—" }]} actions={(r) => <Button type="button" size="sm" variant="outline" onClick={() => openAttempts(r.nsu)}>Histórico</Button>} />
    <PaginationControls pagination={pagination} itemLabel="NSU(s)" loading={loading} onPageChange={setPage} onPageSizeChange={() => undefined} />
    <Dialog open={selectedNsu !== null} title={`Histórico do NSU ${selectedNsu ?? ""}`} onOpenChange={(open) => { if (!open) setSelectedNsu(null); }}><DataTable data={attempts} getRowKey={(a) => `${a.attemptedAt}-${a.resultStatus}`} emptyTitle="Nenhuma tentativa registrada" columns={[{ key: "at", header: "Data", cell: (a) => fmt(a.attemptedAt) }, { key: "st", header: "Resultado", cell: (a) => <NfseProcessingStatusBadge status={a.resultStatus} /> }, { key: "http", header: "HTTP", cell: (a) => a.httpStatus ?? "—" }, { key: "err", header: "Erro/Motivo", cell: (a) => a.errorMessage ?? a.ignoreReason ?? "—" }, { key: "doc", header: "Documento", cell: (a) => a.documentId ?? "—" }]} /></Dialog>
  </SectionCard>;
}
