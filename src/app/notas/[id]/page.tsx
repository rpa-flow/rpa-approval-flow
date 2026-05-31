"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";

type Me = { manager: { nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR" } };
type RiskLevel = "BAIXO" | "MEDIO" | "ALTO";
type InvoiceStatus = "AGUARDANDO_APROVACAO" | "APROVADO" | "RECUSADO" | "PROCESSADO" | "EXPIRADA" | "DADOS_INCONSISTENTES";
type AuditEvent = { id: string; actionType: string; actionDescription?: string | null; actorName?: string | null; createdAt: string; reason?: string | null; comment?: string | null };

type Invoice = {
  id: string;
  numeroNota: string;
  codigoIdentificador: string;
  status: InvoiceStatus;
  dataAtualizacao: string;
  dataEmissao?: string | null;
  dataCompetencia?: string | null;
  valorServico?: number | null;
  valorLiquido?: number | null;
  valorBaseCalculo?: number | null;
  valorIssqn?: number | null;
  valorTotalRetido?: number | null;
  aliquota?: number | null;
  tomadorNome?: string | null;
  tomadorCnpj?: string | null;
  tomadorEmail?: string | null;
  prestadorNome?: string | null;
  prestadorCnpj?: string | null;
  prestadorEmail?: string | null;
  localEmissao?: string | null;
  localPrestacao?: string | null;
  municipioIncidencia?: string | null;
  itemTributacaoNac?: string | null;
  itemTributacaoMun?: string | null;
  nbsDescricao?: string | null;
  responsavelValidacao?: string | null;
  dataValidacao?: string | null;
  observacaoValidacao?: string | null;
  codigoDelphi?: string | null;
  ocContrato?: string | null;
  dataLancamentoDelphi?: string | null;
  dataPagamento?: string | null;
  fornecedor: { nome: string; cnpj?: string | null; codigoExterno?: string | null };
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  AGUARDANDO_APROVACAO: "bg-amber-100 text-amber-800",
  APROVADO: "bg-emerald-100 text-emerald-800",
  RECUSADO: "bg-rose-100 text-rose-800",
  PROCESSADO: "bg-blue-100 text-blue-800",
  EXPIRADA: "bg-slate-100 text-slate-800",
  DADOS_INCONSISTENTES: "bg-orange-100 text-orange-800"
};

const APPROVED_STATUS_CHANGE_OPTIONS: Array<{ value: Exclude<InvoiceStatus, "APROVADO">; label: string; description: string }> = [
  { value: "AGUARDANDO_APROVACAO", label: "Cancelar aprovação", description: "Volta a nota para a fila de aprovação." },
  { value: "RECUSADO", label: "Recusar nota", description: "Marca a nota como recusada por erro identificado após aprovação." },
  { value: "DADOS_INCONSISTENTES", label: "Dados inconsistentes", description: "Sinaliza que a nota precisa de correção de dados." },
  { value: "PROCESSADO", label: "Marcar processada", description: "Confirma manualmente que a nota já foi processada." },
  { value: "EXPIRADA", label: "Expirada", description: "Indica que a aprovação não deve mais seguir o fluxo atual." }
];

function formatCurrency(value?: number | null) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "-";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "-";
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value ?? "-"}</p>
  </div>;
}

export default function NotaDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [evaluation, setEvaluation] = useState<{ rating: 1 | 2 | 3 | 4 | 5 | null; qualifica: "SIM" | "NAO" | ""; riskLevel: RiskLevel | "" }>({ rating: null, qualifica: "", riskLevel: "" });
  const [paymentDate, setPaymentDate] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [statusChange, setStatusChange] = useState<{ status: Exclude<InvoiceStatus, "APROVADO">; reason: string }>({ status: "AGUARDANDO_APROVACAO", reason: "" });
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push(`/login?redirect=${encodeURIComponent(`/notas/${params.id}`)}`);
      return;
    }
    setMe(await meRes.json());

    const [invoiceRes, historyRes] = await Promise.all([
      fetch(`/api/notas/${params.id}`),
      fetch(`/api/notas/${params.id}/historico`)
    ]);

    if (invoiceRes.status === 401 || historyRes.status === 401) {
      router.push(`/login?redirect=${encodeURIComponent(`/notas/${params.id}`)}`);
      return;
    }

    if (invoiceRes.status === 403 || historyRes.status === 403) {
      setMessage("Você não tem acesso a esta nota fiscal.");
      setLoading(false);
      return;
    }

    if (!invoiceRes.ok) {
      setMessage("Nota fiscal não encontrada.");
      setLoading(false);
      return;
    }

    const loadedInvoice = await invoiceRes.json();
    setInvoice(loadedInvoice);
    if (historyRes.ok) setEvents(await historyRes.json());
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    setPaymentDate(loadedInvoice.dataPagamento ? toLocalDateInputValue(new Date(loadedInvoice.dataPagamento)) : toLocalDateInputValue(nextDay));
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!loading && invoice && window.location.hash === "#revogar-aprovacao") {
      document.getElementById("revogar-aprovacao")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [invoice, loading]);

  async function aprovarComAvaliacao() {
    if (!invoice || !evaluation.rating || !evaluation.qualifica || !evaluation.riskLevel) {
      setMessage("Preencha a avaliação completa para aprovar a nota.");
      return;
    }

    setIsApproving(true);
    const res = await fetch(`/api/notas/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "APROVADO",
        dataPagamento: paymentDate ? new Date(`${paymentDate}T12:00:00`).toISOString() : null,
        serviceEvaluation: {
          rating: evaluation.rating,
          comment: "Qualificação registrada",
          riskLevel: evaluation.riskLevel,
          qualifica: evaluation.qualifica
        }
      })
    });
    setIsApproving(false);

    if (!res.ok) {
      setMessage("Não foi possível aprovar a nota. Confira a avaliação obrigatória e tente novamente.");
      return;
    }

    setMessage("Nota aprovada com sucesso.");
    setEvaluation({ rating: null, qualifica: "", riskLevel: "" });
    await loadData();
  }

  async function alterarStatusAprovado() {
    if (!invoice) return;

    const reason = statusChange.reason.trim();
    if (!reason) {
      setMessage("Informe o motivo para alterar ou cancelar uma aprovação.");
      return;
    }

    setIsChangingStatus(true);
    const res = await fetch(`/api/notas/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: statusChange.status,
        reason
      })
    });
    setIsChangingStatus(false);

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      setMessage(error?.error ?? "Não foi possível alterar o status da nota aprovada.");
      return;
    }

    setMessage(statusChange.status === "AGUARDANDO_APROVACAO" ? "Aprovação cancelada com sucesso." : "Status da nota aprovada alterado com sucesso.");
    setStatusChange({ status: "AGUARDANDO_APROVACAO", reason: "" });
    await loadData();
  }

  const canApprove = Boolean(invoice && me?.manager.role !== "FORNECEDOR" && ["AGUARDANDO_APROVACAO", "RECUSADO", "DADOS_INCONSISTENTES"].includes(invoice.status));
  const canChangeApprovedStatus = Boolean(invoice && me?.manager.role !== "FORNECEDOR" && invoice.status === "APROVADO");

  return <main className="container container-wide">
    <MainHeader title="Detalhes da nota" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} action={<button type="button" className="btn-secondary" onClick={() => router.push("/dashboard")}>Voltar ao dashboard</button>} />

    {loading && <section className="card mt-4"><p className="section-description">Carregando nota fiscal...</p></section>}

    {!loading && invoice && <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="card space-y-5">
        <div className="section-header">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Nota fiscal</p>
            <h2 className="section-title">NF {invoice.numeroNota}</h2>
            <p className="section-description">{invoice.fornecedor.nome} • código identificador {invoice.codigoIdentificador}</p>
          </div>
          <span className={`badge ${STATUS_COLORS[invoice.status] ?? "badge-slate"}`}>{invoice.status.replaceAll("_", " ")}</span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <DetailItem label="Valor de serviço" value={formatCurrency(invoice.valorServico ?? invoice.valorLiquido ?? invoice.valorBaseCalculo)} />
          <DetailItem label="Emissão" value={formatDate(invoice.dataEmissao)} />
          <DetailItem label="Competência" value={formatDate(invoice.dataCompetencia)} />
          <DetailItem label="Fornecedor" value={invoice.fornecedor.nome} />
          <DetailItem label="CNPJ fornecedor" value={invoice.fornecedor.cnpj ?? invoice.prestadorCnpj} />
          <DetailItem label="Código externo" value={invoice.fornecedor.codigoExterno} />
          <DetailItem label="Tomador" value={invoice.tomadorNome} />
          <DetailItem label="CNPJ tomador" value={invoice.tomadorCnpj} />
          <DetailItem label="E-mail tomador" value={invoice.tomadorEmail} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <DetailItem label="Local de emissão" value={invoice.localEmissao} />
          <DetailItem label="Local de prestação" value={invoice.localPrestacao} />
          <DetailItem label="Município de incidência" value={invoice.municipioIncidencia} />
          <DetailItem label="NBS / serviço" value={invoice.nbsDescricao} />
          <DetailItem label="Item tributação nacional" value={invoice.itemTributacaoNac} />
          <DetailItem label="Item tributação municipal" value={invoice.itemTributacaoMun} />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <DetailItem label="Base cálculo" value={formatCurrency(invoice.valorBaseCalculo)} />
          <DetailItem label="ISSQN" value={formatCurrency(invoice.valorIssqn)} />
          <DetailItem label="Total retido" value={formatCurrency(invoice.valorTotalRetido)} />
          <DetailItem label="Alíquota" value={invoice.aliquota === null || invoice.aliquota === undefined ? "-" : `${invoice.aliquota}%`} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <DetailItem label="Responsável validação" value={invoice.responsavelValidacao} />
          <DetailItem label="Data validação" value={formatDateTime(invoice.dataValidacao)} />
          <DetailItem label="Pagamento previsto" value={formatDate(invoice.dataPagamento)} />
          <DetailItem label="Código Delphi" value={invoice.codigoDelphi} />
          <DetailItem label="OC contrato" value={invoice.ocContrato} />
          <DetailItem label="Lançamento Delphi" value={formatDateTime(invoice.dataLancamentoDelphi)} />
        </div>

        {invoice.observacaoValidacao && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><strong>Observação de validação:</strong> {invoice.observacaoValidacao}</div>}
      </section>

      <aside className="space-y-4">

        {canChangeApprovedStatus && <section id="revogar-aprovacao" className="card space-y-4 border-amber-200 bg-amber-50/50 scroll-mt-6 ring-1 ring-amber-100">
          <div>
            <h3 className="section-title">Revogar ou alterar aprovação</h3>
            <p className="section-description">Escolha “Cancelar aprovação” para voltar a nota para a fila, ou selecione outro status quando a aprovação anterior foi feita com erro. A alteração será registrada no histórico.</p>
          </div>
          <label>Novo status<select value={statusChange.status} onChange={(event) => setStatusChange((prev) => ({ ...prev, status: event.target.value as Exclude<InvoiceStatus, "APROVADO"> }))}>{APPROVED_STATUS_CHANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <p className="rounded-2xl border border-amber-200 bg-white p-3 text-xs font-semibold text-amber-900">{APPROVED_STATUS_CHANGE_OPTIONS.find((option) => option.value === statusChange.status)?.description}</p>
          <label>Motivo da alteração<textarea value={statusChange.reason} onChange={(event) => setStatusChange((prev) => ({ ...prev, reason: event.target.value }))} rows={4} maxLength={500} placeholder="Descreva o erro ou motivo para cancelar/alterar a aprovação" /></label>
          <button type="button" className="btn-secondary w-full" onClick={alterarStatusAprovado} disabled={isChangingStatus}>{isChangingStatus ? "Registrando..." : statusChange.status === "AGUARDANDO_APROVACAO" ? "Cancelar aprovação" : "Alterar status"}</button>
        </section>}

        {canApprove && <section className="card space-y-4">
          <div>
            <h3 className="section-title">Aprovar nota</h3>
            <p className="section-description">Registre a avaliação obrigatória do serviço antes da aprovação.</p>
          </div>
          <div><p className="mb-2 text-sm font-semibold text-slate-800">Pontuação do serviço</p><div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((rate) => <button key={rate} type="button" className={`rounded-xl border p-3 text-center text-sm font-bold transition ${evaluation.rating === rate ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm" : "border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"}`} onClick={() => setEvaluation((prev) => ({ ...prev, rating: rate as 1 | 2 | 3 | 4 | 5 }))}>{rate}</button>)}</div></div>
          <label>Qualifica?<select value={evaluation.qualifica} onChange={(event) => setEvaluation((prev) => ({ ...prev, qualifica: event.target.value as "SIM" | "NAO" }))}><option value="">Selecione</option><option value="SIM">Sim</option><option value="NAO">Não</option></select></label>
          <label>Classificação de risco<select value={evaluation.riskLevel} onChange={(event) => setEvaluation((prev) => ({ ...prev, riskLevel: event.target.value as RiskLevel }))}><option value="">Selecione</option><option value="BAIXO">Baixo</option><option value="MEDIO">Médio</option><option value="ALTO">Alto</option></select></label>
          <label>Data de pagamento<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
          <button type="button" className="btn-primary w-full" onClick={aprovarComAvaliacao} disabled={isApproving}>{isApproving ? "Aprovando..." : "Aprovar nota"}</button>
        </section>}

        <section className="card">
          <div className="section-header">
            <div><h3 className="section-title">Histórico</h3><p className="section-description">Linha do tempo da nota.</p></div>
            <span className="badge badge-slate">{events.length}</span>
          </div>
          <div className="space-y-3 border-l-2 border-slate-200 pl-4">{events.length ? events.map((event) => <article key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{event.actionType}</p><p className="mt-1 text-sm font-semibold text-slate-900">{event.actionDescription || "Interação registrada"}</p><p className="text-xs text-slate-500">{event.actorName || "Sistema"} • {formatDateTime(event.createdAt)}</p>{event.reason && <p className="mt-2 text-xs font-semibold text-rose-700">Motivo: {event.reason}</p>}{event.comment && <p className="mt-1 text-xs text-slate-700">{event.comment}</p>}</article>) : <p className="section-description">Nenhum histórico registrado.</p>}</div>
        </section>
      </aside>
    </div>}

    {message && <p className="message" role="status">{message}</p>}
  </main>;
}
