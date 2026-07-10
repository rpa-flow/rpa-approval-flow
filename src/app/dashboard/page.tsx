"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout, PaginationControls } from "@/components/ui-kit";
import { getRatingLabel, QualificaHelpText, QualificationProcedureLink } from "@/components/evaluation-guidance";
import type { PaginationMetadata } from "@/lib/pagination";

type Me = { manager: { nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR" } };
type IntegrationStatus = "AGUARDANDO" | "SUCESSO" | "FALHA";
type RiskLevel = "BAIXO" | "MEDIO" | "ALTO";
type AuditEvent = { id: string; actionType: string; actionDescription?: string | null; actorName?: string | null; createdAt: string; reason?: string | null; comment?: string | null };

type Invoice = {
  id: string;
  numeroNota: string;
  codigoIdentificador: string;
  status: string;
  dataAtualizacao: string;
  dataEmissao?: string | null;
  dataCompetencia?: string | null;
  valorServico?: number | null;
  tomadorNome?: string | null;
  tomadorCnpj?: string | null;
  fornecedor: { nome: string; cnpj?: string | null; codigoExterno?: string | null };
  empresa?: { cnpj?: string | null; nomeExibicao?: string | null };
  responsavelValidacao?: string | null;
  dataValidacao?: string | null;
  observacaoValidacao?: string | null;
  codigoDelphi?: string | null;
  statusIntegracaoDelphi?: IntegrationStatus | null;
  ordemCompra?: string | null;
  ocContrato?: string | null;
  dataLancamentoDelphi?: string | null;
  dataPagamento?: string | null;
};

type SupplierOption = { id: string; nome: string };
type NotesResponse = {
  items: Invoice[];
  pagination: PaginationMetadata;
  supplierOptions: SupplierOption[];
};

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_APROVACAO: "bg-amber-100 text-amber-800",
  APROVADO: "bg-emerald-100 text-emerald-800",
  RECUSADO: "bg-rose-100 text-rose-800",
  PROCESSADO: "bg-blue-100 text-blue-800",
  DADOS_INCONSISTENTES: "bg-orange-100 text-orange-800"
};


function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function formatCnpj(value?: string | null) {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return value ?? "-";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCompany(invoice: Invoice) {
  const cnpj = invoice.empresa?.cnpj ?? invoice.tomadorCnpj;
  const name = invoice.empresa?.nomeExibicao ?? "Empresa não cadastrada";
  return `${name} - ${formatCnpj(cnpj)}`;
}


function formatInputDate(value: string) {
  if (!value) return "";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function isInvalidDateRange(from: string, to: string) {
  return Boolean(from && to && from > to);
}

type DateRangeFilterProps = {
  legend: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

function DateRangeFilter({ legend, from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const invalid = isInvalidDateRange(from, to);
  const normalizedLegend = legend.toLowerCase();

  return (
    <fieldset className={`rounded-md border bg-surface-container-lowest p-3 ${invalid ? "border-rose-300" : "border-border"}`}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-600">
          De
          <input
            type="date"
            lang="pt-BR"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            aria-label={`${legend}: data inicial`}
            aria-invalid={invalid}
            className="mt-1 min-w-0"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Até
          <input
            type="date"
            lang="pt-BR"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            aria-label={`${legend}: data final`}
            aria-invalid={invalid}
            className="mt-1 min-w-0"
          />
        </label>
      </div>
      {invalid && <p className="mt-2 text-xs font-medium text-rose-700">A data inicial de {normalizedLegend} é maior que a final.</p>}
    </fieldset>
  );
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [supplierFilter, setSupplierFilter] = useState("TODOS");
  const [takerFilter, setTakerFilter] = useState("");
  const [debouncedTakerFilter, setDebouncedTakerFilter] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [issueFrom, setIssueFrom] = useState("");
  const [issueTo, setIssueTo] = useState("");
  const [competenceFrom, setCompetenceFrom] = useState("");
  const [competenceTo, setCompetenceTo] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [menuState, setMenuState] = useState<{ invoice: Invoice; x: number; y: number } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ invoice: Invoice; events: AuditEvent[] } | null>(null);
  const [approveModal, setApproveModal] = useState<Invoice | null>(null);
  const [evaluation, setEvaluation] = useState<{ rating: 1 | 2 | 3 | 4 | 5 | null; qualifica: "SIM" | "NAO" | ""; riskLevel: RiskLevel | "" }>({ rating: null, qualifica: "", riskLevel: "" });
  const [paymentDate, setPaymentDate] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const router = useRouter();

  const loadMe = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) return router.push("/login");
    setMe(await meRes.json());
  }, [router]);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });

    if (statusFilter !== "TODOS") params.set("status", statusFilter);
    if (supplierFilter !== "TODOS") params.set("supplierId", supplierFilter);
    if (debouncedTakerFilter) params.set("taker", debouncedTakerFilter);
    if (updatedFrom) params.set("updatedFrom", updatedFrom);
    if (updatedTo) params.set("updatedTo", updatedTo);
    if (issueFrom) params.set("issueFrom", issueFrom);
    if (issueTo) params.set("issueTo", issueTo);
    if (competenceFrom) params.set("competenceFrom", competenceFrom);
    if (competenceTo) params.set("competenceTo", competenceTo);

    setIsLoadingNotes(true);
    try {
      const notesRes = await fetch(`/api/notas/minhas?${params.toString()}`);
      if (notesRes.status === 401) return router.push("/login");
      if (!notesRes.ok) {
        setMessageType("error");
        setMessage("Não foi possível carregar as notas.");
        return;
      }

      const data = await notesRes.json() as NotesResponse;
      setInvoices(data.items);
      setPagination(data.pagination);
      setSupplierOptions(data.supplierOptions);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [competenceFrom, competenceTo, debouncedTakerFilter, issueFrom, issueTo, page, pageSize, router, statusFilter, supplierFilter, updatedFrom, updatedTo]);

  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTakerFilter(takerFilter.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [takerFilter]);

  useEffect(() => {
    if (!menuState) return;

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuState(null);
    }

    window.addEventListener("keydown", closeMenuOnEscape);
    return () => window.removeEventListener("keydown", closeMenuOnEscape);
  }, [menuState]);

  async function atualizarNota(id: string, payload: Record<string, unknown>) {
    setMenuState(null);
    setMessage("");

    try {
      const res = await fetch(`/api/notas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setMessageType("error");
        setMessage(error?.error ?? "Não foi possível concluir a ação na nota.");
        return false;
      }

      setMessageType("success");
      setMessage("Ação registrada com sucesso.");
      await loadData();
      return true;
    } catch {
      setMessageType("error");
      setMessage("Não foi possível comunicar com o servidor. Recarregue a página e tente novamente.");
      return false;
    }
  }

  function abrirModalAprovacao(invoice: Invoice) {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    setPaymentDate(toLocalDateInputValue(nextDay));
    setPurchaseOrder(invoice.ordemCompra ?? "");
    setApproveModal(invoice);
    setMenuState(null);
  }

  function handleMenuPointerDown(event: React.PointerEvent<HTMLButtonElement>, action: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  async function aprovarComAvaliacao() {
    if (!approveModal || !evaluation.rating || !evaluation.qualifica || !evaluation.riskLevel) {
      setMessageType("error");
      setMessage("Preencha a pontuação, o campo Qualifica e a classificação de risco para aprovar a nota.");
      return;
    }

    setIsApproving(true);
    const approved = await atualizarNota(approveModal.id, {
      status: "APROVADO",
      dataPagamento: paymentDate ? new Date(`${paymentDate}T12:00:00`).toISOString() : null,
      ordemCompra: purchaseOrder.trim() || null,
      serviceEvaluation: {
        rating: evaluation.rating,
        comment: `Qualificação registrada`,
        riskLevel: evaluation.riskLevel,
        qualifica: evaluation.qualifica
      }
    });
    setIsApproving(false);

    if (!approved) return;

    setApproveModal(null);
    setEvaluation({ rating: null, qualifica: "", riskLevel: "" });
    setPaymentDate("");
    setPurchaseOrder("");
  }

  async function verHistorico(invoice: Invoice) {
    setMenuState(null);
    try {
      const res = await fetch(`/api/notas/${invoice.id}/historico`);
      if (!res.ok) {
        setMessageType("error");
        setMessage("Não foi possível carregar o histórico da nota.");
        return;
      }
      setHistoryModal({ invoice, events: await res.json() });
    } catch {
      setMessageType("error");
      setMessage("Não foi possível comunicar com o servidor para carregar o histórico.");
    }
  }

  const activeFilters = [
    statusFilter !== "TODOS" ? { key: "status", label: `Status: ${statusFilter === "LANCADAS" ? "Lançadas" : statusFilter.replaceAll("_", " ")}`, clear: () => setStatusFilter("TODOS") } : null,
    supplierFilter !== "TODOS" ? { key: "supplier", label: `Fornecedor: ${supplierOptions.find((supplier) => supplier.id === supplierFilter)?.nome ?? "Selecionado"}`, clear: () => setSupplierFilter("TODOS") } : null,
    takerFilter.trim() ? { key: "taker", label: `Tomador: ${takerFilter.trim()}`, clear: () => setTakerFilter("") } : null,
    issueFrom || issueTo ? { key: "issue", label: `Emissão: ${issueFrom ? formatInputDate(issueFrom) : "início"} até ${issueTo ? formatInputDate(issueTo) : "fim"}`, clear: () => { setIssueFrom(""); setIssueTo(""); } } : null,
    competenceFrom || competenceTo ? { key: "competence", label: `Competência: ${competenceFrom ? formatInputDate(competenceFrom) : "início"} até ${competenceTo ? formatInputDate(competenceTo) : "fim"}`, clear: () => { setCompetenceFrom(""); setCompetenceTo(""); } } : null,
    updatedFrom || updatedTo ? { key: "updated", label: `Atualização: ${updatedFrom ? formatInputDate(updatedFrom) : "início"} até ${updatedTo ? formatInputDate(updatedTo) : "fim"}`, clear: () => { setUpdatedFrom(""); setUpdatedTo(""); } } : null
  ].filter((filter): filter is { key: string; label: string; clear: () => void } => Boolean(filter));

  const hasInvalidDateRange = isInvalidDateRange(issueFrom, issueTo) || isInvalidDateRange(competenceFrom, competenceTo) || isInvalidDateRange(updatedFrom, updatedTo);
  const activeAdvancedFiltersCount = [issueFrom || issueTo, competenceFrom || competenceTo, updatedFrom || updatedTo].filter(Boolean).length;

  return <AppLayout onClick={() => setMenuState(null)}>
    <MainHeader title="Central operacional de notas fiscais" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} />

    {message && <p className={`message ${messageType === "error" ? "feedback-error" : ""}`} role="status">{message}</p>}

    <section className="card mt-4 space-y-5" onClick={(e) => e.stopPropagation()}>
      <div className="section-header">
        <div>
          <h2 className="section-title">Notas em acompanhamento</h2>
          <p className="section-description">Filtre, analise detalhes e execute aprovações sem sair da central operacional.</p>
        </div>
        <span className="badge badge-slate">{isLoadingNotes ? "Carregando..." : `${pagination.total} nota(s)`}</span>
      </div>

      <div className="space-y-3 rounded-md border border-border bg-surface-container-low p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(8rem,0.8fr)_minmax(12rem,1.2fr)_minmax(12rem,1.4fr)_auto] md:items-end">
          <label className="text-xs font-medium text-slate-600">
            Status
            <select className="mt-1" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="TODOS">Todos status</option><option value="LANCADAS">Lançadas</option><option value="AGUARDANDO_APROVACAO">Pendente</option><option value="APROVADO">Aprovada</option><option value="RECUSADO">Reprovada</option><option value="PROCESSADO">Processada</option><option value="DADOS_INCONSISTENTES">Dados inconsistentes</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Empresa/Fornecedor
            <select className="mt-1" value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}>
              <option value="TODOS">Todos fornecedores</option>{supplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Tomador
            <input className="mt-1" value={takerFilter} onChange={(e) => { setTakerFilter(e.target.value); setPage(1); }} placeholder="Buscar tomador" />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
            <button
              type="button"
              className="btn-secondary relative whitespace-nowrap"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              aria-expanded={showAdvancedFilters}
              aria-controls="advanced-invoice-filters"
            >
              Mais filtros
              {activeAdvancedFiltersCount > 0 && <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{activeAdvancedFiltersCount}</span>}
            </button>
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => { setStatusFilter("TODOS"); setSupplierFilter("TODOS"); setTakerFilter(""); setUpdatedFrom(""); setUpdatedTo(""); setIssueFrom(""); setIssueTo(""); setCompetenceFrom(""); setCompetenceTo(""); setPage(1); }}>Limpar filtros</button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div id="advanced-invoice-filters" className="rounded-md border border-border bg-surface-container-lowest p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Filtros avançados</h3>
              <span className="text-xs text-slate-500">Períodos de datas da nota e do sistema</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <DateRangeFilter legend="Emissão" from={issueFrom} to={issueTo} onFromChange={(value) => { setIssueFrom(value); setPage(1); }} onToChange={(value) => { setIssueTo(value); setPage(1); }} />
              <DateRangeFilter legend="Competência" from={competenceFrom} to={competenceTo} onFromChange={(value) => { setCompetenceFrom(value); setPage(1); }} onToChange={(value) => { setCompetenceTo(value); setPage(1); }} />
              <DateRangeFilter legend="Atualização" from={updatedFrom} to={updatedTo} onFromChange={(value) => { setUpdatedFrom(value); setPage(1); }} onToChange={(value) => { setUpdatedTo(value); setPage(1); }} />
            </div>
          </div>
        )}

        {(activeFilters.length > 0 || hasInvalidDateRange) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="rounded-full border border-blue-200 !bg-blue-50 px-3 py-1 text-xs font-semibold !text-blue-800 hover:!bg-blue-100"
                onClick={() => { filter.clear(); setPage(1); }}
                aria-label={`Remover filtro ${filter.label}`}
              >
                {filter.label} ×
              </button>
            ))}
            {hasInvalidDateRange && <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Revise os intervalos de data</span>}
          </div>
        )}
      </div>

      <div className="table-shell">
        <table className="min-w-[64rem] text-sm">
          <thead>
            <tr>
              <th className="px-3 py-3 text-center">Fornecedor / NF</th>
              <th className="px-3 py-3 text-center">Empresa</th>
              <th className="px-3 py-3 text-center" style={{ minWidth: "8.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Valor</th>
              <th className="px-2 py-3 text-center" style={{ minWidth: "6.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Emissão</th>
              <th className="px-2 py-3 text-center" style={{ minWidth: "7rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Competência</th>
              <th className="px-2 py-3 text-center" style={{ minWidth: "10rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Status</th>
              <th className="px-3 py-3 text-center">Responsável</th>
              <th className="px-2 py-3 text-center" style={{ minWidth: "8.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Atualização</th>
              <th className="sticky right-0 z-20 bg-surface-container-low px-2 py-3 text-center shadow-[-8px_0_16px_rgba(25,28,32,0.06)]" style={{ minWidth: "6rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((invoice) => <Fragment key={invoice.id}>
              <tr className="cursor-pointer" onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}>
                <td className="px-3 py-3 text-center"><div className="font-semibold text-slate-900">{invoice.fornecedor.nome}</div><div className="text-xs text-slate-500">NF {invoice.numeroNota}</div></td>
                <td className="px-3 py-3 text-center text-slate-700"><div className="font-medium text-slate-800">{invoice.empresa?.nomeExibicao ?? "Empresa não cadastrada"}</div><div className="whitespace-nowrap text-xs text-slate-500">{formatCnpj(invoice.empresa?.cnpj ?? invoice.tomadorCnpj)}</div></td>
                <td className="px-3 py-3 text-center font-medium tabular-nums text-slate-800" style={{ minWidth: "8.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{Number(invoice.valorServico || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></td>
                <td className="px-2 py-3 text-center text-slate-700" style={{ minWidth: "6.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{invoice.dataEmissao ? new Date(invoice.dataEmissao).toLocaleDateString("pt-BR") : "-"}</span></td>
                <td className="px-2 py-3 text-center text-slate-700" style={{ minWidth: "7rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{invoice.dataCompetencia ? new Date(invoice.dataCompetencia).toLocaleDateString("pt-BR") : "-"}</span></td>
                <td className="px-2 py-3 text-center" style={{ minWidth: "10rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span className={`badge ${STATUS_COLORS[invoice.status] ?? "badge-slate"}`}>{invoice.status.replaceAll("_", " ")}</span></td>
                <td className="px-3 py-3 text-center text-slate-700">{invoice.responsavelValidacao ?? "-"}</td>
                <td className="px-2 py-3 text-center text-slate-600" style={{ minWidth: "8.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{new Date(invoice.dataAtualizacao).toLocaleString("pt-BR")}</span></td>
                <td className="sticky right-0 z-10 bg-surface-container-lowest px-2 py-3 text-center shadow-[-8px_0_16px_rgba(25,28,32,0.06)]" style={{ minWidth: "6rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><button className="btn-secondary min-h-0 whitespace-nowrap px-2.5 py-1.5 text-sm" onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuState({ invoice, x: Math.max(8, Math.min(r.right - 208, window.innerWidth - 248)), y: Math.min(r.bottom + 6, window.innerHeight - 260) }); }}>Ações ▾</button></td>
              </tr>
              {expandedId === invoice.id && <tr><td colSpan={9} className="bg-slate-50 p-0"><div className="grid gap-3 px-4 py-4 text-xs text-slate-700 sm:grid-cols-3"><p><strong>Identificador XML:</strong> {invoice.codigoIdentificador}</p><p><strong>Empresa:</strong> <span className="whitespace-nowrap">{formatCompany(invoice)}</span></p><p><strong>CNPJ fornecedor:</strong> <span className="whitespace-nowrap">{invoice.fornecedor.cnpj ?? "-"}</span></p><p><strong>Código externo fornecedor:</strong> {invoice.fornecedor.codigoExterno ?? "-"}</p><p><strong>Ordem de compra:</strong> {invoice.ordemCompra ?? "-"}</p><p><strong>OC/Contrato:</strong> {invoice.ocContrato ?? "-"}</p><p><strong>Dt. Lanc. Delphi:</strong> {invoice.dataLancamentoDelphi ? new Date(invoice.dataLancamentoDelphi).toLocaleString("pt-BR") : "-"}</p><p><strong>Código Delphi:</strong> {invoice.codigoDelphi ?? "Pendente integração"}</p><p><strong>Integração:</strong> {invoice.statusIntegracaoDelphi ?? "AGUARDANDO"}</p><p className="sm:col-span-3"><strong>Observação da validação:</strong> {invoice.observacaoValidacao ?? "-"}</p></div></td></tr>}
            </Fragment>)}
            {!invoices.length && <tr><td colSpan={9} className="px-4 py-10"><div className="empty-state">{isLoadingNotes ? "Carregando notas..." : "Nenhuma nota encontrada para os filtros selecionados."}</div></td></tr>}
          </tbody>
        </table>
        <PaginationControls
          pagination={pagination}
          itemLabel="nota(s)"
          loading={isLoadingNotes}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
        />
      </div>
    </section>

    {menuState && <button type="button" aria-label="Fechar menu de ações" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={() => setMenuState(null)} />}
    {menuState && <div className="fixed z-50 w-[calc(100vw-1rem)] max-w-60 rounded-md border border-border bg-surface-container-lowest p-2 shadow-elevated" style={{ left: menuState.x, top: menuState.y }} onClick={(e) => e.stopPropagation()}>
      {['AGUARDANDO_APROVACAO', 'RECUSADO', 'DADOS_INCONSISTENTES'].includes(menuState.invoice.status) && me?.manager.role !== 'FORNECEDOR' && <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-emerald-700 hover:!bg-emerald-50" onPointerDown={(event) => handleMenuPointerDown(event, () => abrirModalAprovacao(menuState.invoice))}>{menuState.invoice.status === "AGUARDANDO_APROVACAO" ? "✅ Aprovar" : "🔁 Reaprovar"}</button>}
      {menuState.invoice.status === 'AGUARDANDO_APROVACAO' && me?.manager.role !== 'FORNECEDOR' && <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-rose-700 hover:!bg-rose-50" onPointerDown={(event) => handleMenuPointerDown(event, () => { const qualifica = window.confirm("A nota qualifica para este processo?") ? "SIM" : "NAO"; void atualizarNota(menuState.invoice.id, { status: "RECUSADO", reason: `Qualifica: ${qualifica === "SIM" ? "Sim" : "Não"}`, observacaoValidacao: qualifica === "SIM" ? "Sim" : "Não" }); })}>⛔ Reprovar</button>}
      {menuState.invoice.status === 'APROVADO' && me?.manager.role !== 'FORNECEDOR' && <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-amber-700 hover:!bg-amber-50" onPointerDown={(event) => handleMenuPointerDown(event, () => { router.push(`/notas/${menuState.invoice.id}#revogar-aprovacao`); setMenuState(null); })}>↩️ Revogar aprovação</button>}
      <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-slate-700 hover:!bg-slate-50" onPointerDown={(event) => handleMenuPointerDown(event, () => { router.push(`/notas/${menuState.invoice.id}`); setMenuState(null); })}>🔎 Ver detalhes</button>
      <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-slate-700 hover:!bg-slate-50" onPointerDown={(event) => handleMenuPointerDown(event, () => { setExpandedId(menuState.invoice.id); setMenuState(null); })}>▾ Expandir resumo</button>
      <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-slate-700 hover:!bg-slate-50" onPointerDown={(event) => handleMenuPointerDown(event, () => void verHistorico(menuState.invoice))}>🕒 Ver histórico</button>
    </div>}

    {approveModal && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={() => setApproveModal(null)} />}
    {approveModal && <section role="dialog" aria-modal="true" aria-labelledby="approval-modal-title" className="fixed inset-x-2 top-4 z-50 mx-auto max-h-[calc(100svh-2rem)] w-auto max-w-2xl overflow-y-auto rounded-md bg-surface-container-lowest p-4 shadow-elevated sm:inset-x-0 sm:top-8 sm:w-[92vw] sm:p-6" onClick={(e) => e.stopPropagation()}>
      <div className="section-header"><div><h3 id="approval-modal-title" className="section-title">Avaliação obrigatória do serviço</h3><p className="section-description">Nota {approveModal.numeroNota} • fornecedor {approveModal.fornecedor.nome}</p><p className="section-description">Código externo: {approveModal.fornecedor.codigoExterno ?? "Não informado"}</p></div><span className="badge badge-blue">Aprovação</span></div>
      <div className="space-y-4">
        <div role="group" aria-labelledby="dashboard-rating-label"><p id="dashboard-rating-label" className="mb-2 text-sm font-semibold text-slate-800">Pontuação do serviço</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-5">{[1, 2, 3, 4, 5].map((rate) => { const description = getRatingLabel(rate); return <button key={rate} type="button" aria-label={`${rate} - ${description}`} title={`${rate} - ${description}`} className={`rounded-md border p-3 text-left text-xs transition ${evaluation.rating === rate ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm" : "border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"}`} onClick={() => setEvaluation((prev) => ({ ...prev, rating: rate as 1 | 2 | 3 | 4 | 5 }))}><strong className="text-base">{rate}</strong><br />{description}</button>; })}</div></div>
        <div className="grid gap-3 sm:grid-cols-3"><label className="content-start">Qualifica?<select aria-describedby="dashboard-qualifica-help" value={evaluation.qualifica} onChange={(event) => setEvaluation((prev) => ({ ...prev, qualifica: event.target.value as "SIM" | "NAO" }))}><option value="">Selecione</option><option value="SIM">Sim</option><option value="NAO">Não</option></select><QualificaHelpText id="dashboard-qualifica-help" /></label><label className="content-start">Classificação de risco<select value={evaluation.riskLevel} onChange={(event) => setEvaluation((prev) => ({ ...prev, riskLevel: event.target.value as RiskLevel }))}><option value="">Selecione</option><option value="BAIXO">Baixo</option><option value="MEDIO">Médio</option><option value="ALTO">Alto</option></select></label><label className="content-start">Data de pagamento<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label></div>
        <label>Ordem de compra <span className="text-xs font-normal text-slate-500">(opcional)</span><input value={purchaseOrder} onChange={(event) => setPurchaseOrder(event.target.value)} maxLength={120} placeholder="Informe a ordem de compra, se houver" /></label>
        <QualificationProcedureLink />
      </div>
      <div className="form-actions mt-5"><button type="button" className="btn-secondary" onClick={() => setApproveModal(null)}>Cancelar</button><button type="button" className="btn-primary" onClick={aprovarComAvaliacao} disabled={isApproving}>{isApproving ? "Aprovando..." : "Confirmar aprovação"}</button></div>
    </section>}

    {historyModal && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={() => setHistoryModal(null)} />}
    {historyModal && <section role="dialog" aria-modal="true" aria-labelledby="history-modal-title" className="fixed inset-x-2 top-4 z-50 mx-auto max-h-[calc(100svh-2rem)] w-auto max-w-3xl overflow-y-auto rounded-md bg-surface-container-lowest p-4 shadow-elevated sm:inset-x-0 sm:top-8 sm:w-[92vw] sm:p-6" onClick={(e) => e.stopPropagation()}>
      <div className="section-header"><div><h3 id="history-modal-title" className="section-title">Histórico da nota {historyModal.invoice.numeroNota}</h3><p className="section-description">Linha do tempo de interações e auditoria.</p></div><button type="button" className="btn-secondary" onClick={() => setHistoryModal(null)}>Fechar</button></div>
      <div className="space-y-3 border-l-2 border-border pl-4">{historyModal.events.map((event) => <article key={event.id} className="rounded-md border border-border bg-surface-container-low p-4"><p className="text-xs font-bold uppercase text-slate-500">{event.actionType}</p><p className="mt-1 text-sm font-semibold text-slate-900">{event.actionDescription || "Interação registrada"}</p><p className="text-xs text-slate-500">{event.actorName || "Sistema"} • {new Date(event.createdAt).toLocaleString("pt-BR")}</p>{event.reason && <p className="mt-2 text-xs font-semibold text-rose-700">Motivo: {event.reason}</p>}{event.comment && <p className="mt-1 text-xs text-slate-700">{event.comment}</p>}</article>)}</div>
    </section>}
  </AppLayout>;
}