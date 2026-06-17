"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout } from "@/components/ui-kit";

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
  valorServico?: number | null;
  tomadorNome?: string | null;
  fornecedor: { nome: string; cnpj?: string | null; codigoExterno?: string | null };
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

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_APROVACAO: "bg-amber-100 text-amber-800",
  APROVADO: "bg-emerald-100 text-emerald-800",
  RECUSADO: "bg-rose-100 text-rose-800",
  PROCESSADO: "bg-blue-100 text-blue-800",
  DADOS_INCONSISTENTES: "bg-orange-100 text-orange-800"
};

function isInvoiceLaunched(invoice: Invoice) {
  return invoice.status === "PROCESSADO" || Boolean(invoice.dataLancamentoDelphi);
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
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [supplierFilter, setSupplierFilter] = useState("TODOS");
  const [takerFilter, setTakerFilter] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [menuState, setMenuState] = useState<{ invoice: Invoice; x: number; y: number } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ invoice: Invoice; events: AuditEvent[] } | null>(null);
  const [approveModal, setApproveModal] = useState<Invoice | null>(null);
  const [evaluation, setEvaluation] = useState<{ rating: 1 | 2 | 3 | 4 | 5 | null; qualifica: "SIM" | "NAO" | ""; riskLevel: RiskLevel | "" }>({ rating: null, qualifica: "", riskLevel: "" });
  const [paymentDate, setPaymentDate] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const router = useRouter();

  const loadData = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) return router.push("/login");
    setMe(await meRes.json());
    const notesRes = await fetch("/api/notas/minhas");
    if (notesRes.ok) setInvoices(await notesRes.json());
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!menuState) return;

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuState(null);
    }

    window.addEventListener("keydown", closeMenuOnEscape);
    return () => window.removeEventListener("keydown", closeMenuOnEscape);
  }, [menuState]);

  const filtered = useMemo(() => invoices.filter((i) => {
    const updatedAt = new Date(i.dataAtualizacao);
    const fromDate = updatedFrom ? new Date(`${updatedFrom}T00:00:00`) : null;
    const toDate = updatedTo ? new Date(`${updatedTo}T23:59:59`) : null;

    const matchesStatus = statusFilter === "TODOS"
      || (statusFilter === "LANCADAS" && isInvoiceLaunched(i))
      || i.status === statusFilter;
    const normalizedTaker = takerFilter.trim().toLowerCase();
    const matchesTaker = !normalizedTaker || (i.tomadorNome ?? "").toLowerCase().includes(normalizedTaker);

    return matchesStatus &&
      (supplierFilter === "TODOS" || i.fornecedor.nome === supplierFilter) &&
      matchesTaker &&
      (!fromDate || updatedAt >= fromDate) &&
      (!toDate || updatedAt <= toDate);
  }), [invoices, statusFilter, supplierFilter, takerFilter, updatedFrom, updatedTo]);

  const suppliers = useMemo(() => Array.from(new Set(invoices.map((i) => i.fornecedor.nome))), [invoices]);

  async function atualizarNota(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/notas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setMenuState(null);
    if (!res.ok) return setMessage("Não foi possível concluir a ação na nota.");
    setMessage("Ação registrada com sucesso.");
    await loadData();
  }


  async function aprovarComAvaliacao() {
    if (!approveModal || !evaluation.rating || !evaluation.qualifica || !evaluation.riskLevel) {
      setMessage("Preencha a avaliação completa para aprovar a nota.");
      return;
    }

    await atualizarNota(approveModal.id, {
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

    setApproveModal(null);
    setEvaluation({ rating: null, qualifica: "", riskLevel: "" });
    setPaymentDate("");
    setPurchaseOrder("");
  }

  async function verHistorico(invoice: Invoice) {
    const res = await fetch(`/api/notas/${invoice.id}/historico`);
    if (!res.ok) return setMessage("Não foi possível carregar o histórico da nota.");
    setHistoryModal({ invoice, events: await res.json() });
    setMenuState(null);
  }

  return <AppLayout onClick={() => setMenuState(null)}>
    <MainHeader title="Central operacional de notas fiscais" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} />

    <section className="card mt-4 space-y-5" onClick={(e) => e.stopPropagation()}>
      <div className="section-header">
        <div>
          <h2 className="section-title">Notas em acompanhamento</h2>
          <p className="section-description">Filtre, analise detalhes e execute aprovações sem sair da central operacional.</p>
        </div>
        <span className="badge badge-slate">{filtered.length} de {invoices.length} nota(s)</span>
      </div>

      <div className="grid gap-3 rounded-md border border-border bg-surface-container-low p-3 md:grid-cols-3 xl:grid-cols-6">
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="TODOS">Todos status</option><option value="LANCADAS">Lançadas</option><option value="AGUARDANDO_APROVACAO">Pendente</option><option value="APROVADO">Aprovada</option><option value="RECUSADO">Reprovada</option><option value="PROCESSADO">Processada</option><option value="DADOS_INCONSISTENTES">Dados inconsistentes</option>
          </select>
        </label>
        <label>
          Fornecedor
          <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
            <option value="TODOS">Todos fornecedores</option>{suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Tomador
          <input value={takerFilter} onChange={(e) => setTakerFilter(e.target.value)} placeholder="Buscar por tomador" />
        </label>
        <label>
          Atualização de
          <input type="date" value={updatedFrom} onChange={(e) => setUpdatedFrom(e.target.value)} />
        </label>
        <label>
          Atualização até
          <input type="date" value={updatedTo} onChange={(e) => setUpdatedTo(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" className="btn-secondary w-full" onClick={() => { setStatusFilter("TODOS"); setSupplierFilter("TODOS"); setTakerFilter(""); setUpdatedFrom(""); setUpdatedTo(""); }}>Limpar filtros</button>
        </div>
      </div>

      <div className="table-shell">
        <table className="min-w-full text-sm">
          <thead><tr><th className="px-4 py-3 text-left">Fornecedor / NF</th><th className="px-4 py-3 text-left">Tomador</th><th className="px-6 py-3 text-right" style={{ minWidth: "11rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Valor</th><th className="px-4 py-3 text-left" style={{ minWidth: "7rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Emissão</th><th className="px-4 py-3 text-left" style={{ minWidth: "12rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Status</th><th className="px-4 py-3 text-left">Responsável</th><th className="px-4 py-3 text-left" style={{ minWidth: "9rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Atualização</th><th className="px-4 py-3 text-right" style={{ minWidth: "7rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Ações</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((invoice) => <Fragment key={invoice.id}>
              <tr className="cursor-pointer" onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}>
                <td className="px-4 py-3"><div className="font-semibold text-slate-900">{invoice.fornecedor.nome}</div><div className="text-xs text-slate-500">NF {invoice.numeroNota}</div></td>
                <td className="px-4 py-3 text-slate-700">{invoice.tomadorNome ?? "-"}</td>
                <td className="px-6 py-3 text-right font-medium tabular-nums text-slate-800" style={{ minWidth: "11rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{Number(invoice.valorServico || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></td>
                <td className="px-4 py-3 text-slate-700" style={{ minWidth: "7rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{invoice.dataEmissao ? new Date(invoice.dataEmissao).toLocaleDateString("pt-BR") : "-"}</span></td>
                <td className="px-4 py-3" style={{ minWidth: "12rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span className={`badge ${STATUS_COLORS[invoice.status] ?? "badge-slate"}`}>{invoice.status.replaceAll("_", " ")}</span></td>
                <td className="px-4 py-3 text-slate-700">{invoice.responsavelValidacao ?? "-"}</td><td className="px-4 py-3 text-slate-600" style={{ minWidth: "9rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{new Date(invoice.dataAtualizacao).toLocaleString("pt-BR")}</span></td>
                <td className="px-4 py-3 text-right" style={{ minWidth: "7rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><button className="btn-secondary min-h-0 whitespace-nowrap px-3 py-1.5 text-sm" onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuState({ invoice, x: Math.max(8, Math.min(r.right - 208, window.innerWidth - 248)), y: Math.min(r.bottom + 6, window.innerHeight - 260) }); }}>Ações ▾</button></td>
              </tr>
              {expandedId === invoice.id && <tr><td colSpan={8} className="bg-slate-50 p-0"><div className="grid gap-3 px-4 py-4 text-xs text-slate-700 sm:grid-cols-3"><p><strong>Identificador XML:</strong> {invoice.codigoIdentificador}</p><p><strong>CNPJ:</strong> {invoice.fornecedor.cnpj ?? "-"}</p><p><strong>Código externo fornecedor:</strong> {invoice.fornecedor.codigoExterno ?? "-"}</p><p><strong>Ordem de compra:</strong> {invoice.ordemCompra ?? "-"}</p><p><strong>OC/Contrato:</strong> {invoice.ocContrato ?? "-"}</p><p><strong>Dt. Lanc. Delphi:</strong> {invoice.dataLancamentoDelphi ? new Date(invoice.dataLancamentoDelphi).toLocaleString("pt-BR") : "-"}</p><p><strong>Código Delphi:</strong> {invoice.codigoDelphi ?? "Pendente integração"}</p><p><strong>Integração:</strong> {invoice.statusIntegracaoDelphi ?? "AGUARDANDO"}</p><p className="sm:col-span-3"><strong>Observação da validação:</strong> {invoice.observacaoValidacao ?? "-"}</p></div></td></tr>}
            </Fragment>)}
            {!filtered.length && <tr><td colSpan={8} className="px-4 py-10"><div className="empty-state">Nenhuma nota encontrada para os filtros selecionados.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    {menuState && <button type="button" aria-label="Fechar menu de ações" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={() => setMenuState(null)} />}
    {menuState && <div className="fixed z-50 w-[calc(100vw-1rem)] max-w-60 rounded-md border border-border bg-surface-container-lowest p-2 shadow-elevated" style={{ left: menuState.x, top: menuState.y }} onClick={(e) => e.stopPropagation()}>
      {['AGUARDANDO_APROVACAO', 'RECUSADO', 'DADOS_INCONSISTENTES'].includes(menuState.invoice.status) && me?.manager.role !== 'FORNECEDOR' && <button className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-emerald-700 hover:!bg-emerald-50" onClick={() => { const nextDay = new Date(); nextDay.setDate(nextDay.getDate() + 1); setPaymentDate(toLocalDateInputValue(nextDay)); setPurchaseOrder(menuState.invoice.ordemCompra ?? ""); setApproveModal(menuState.invoice); setMenuState(null); }}>{menuState.invoice.status === "AGUARDANDO_APROVACAO" ? "✅ Aprovar" : "🔁 Reaprovar"}</button>}
      {menuState.invoice.status === 'AGUARDANDO_APROVACAO' && me?.manager.role !== 'FORNECEDOR' && <button className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-rose-700 hover:!bg-rose-50" onClick={() => { const qualifica = window.confirm("A nota qualifica para este processo?") ? "SIM" : "NAO"; atualizarNota(menuState.invoice.id, { status: "RECUSADO", reason: `Qualifica: ${qualifica === "SIM" ? "Sim" : "Não"}`, observacaoValidacao: qualifica === "SIM" ? "Sim" : "Não" }); }}>⛔ Reprovar</button>}
      {menuState.invoice.status === 'APROVADO' && me?.manager.role !== 'FORNECEDOR' && <button className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-amber-700 hover:!bg-amber-50" onClick={() => { router.push(`/notas/${menuState.invoice.id}#revogar-aprovacao`); setMenuState(null); }}>↩️ Revogar aprovação</button>}
      <button className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-slate-700 hover:!bg-slate-50" onClick={() => { router.push(`/notas/${menuState.invoice.id}`); setMenuState(null); }}>🔎 Ver detalhes</button>
      <button className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-slate-700 hover:!bg-slate-50" onClick={() => { setExpandedId(menuState.invoice.id); setMenuState(null); }}>▾ Expandir resumo</button>
      <button className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-slate-700 hover:!bg-slate-50" onClick={() => verHistorico(menuState.invoice)}>🕒 Ver histórico</button>
    </div>}

    {approveModal && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={() => setApproveModal(null)} />}
    {approveModal && <section role="dialog" aria-modal="true" aria-labelledby="approval-modal-title" className="fixed inset-x-2 top-4 z-50 mx-auto max-h-[calc(100svh-2rem)] w-auto max-w-2xl overflow-y-auto rounded-md bg-surface-container-lowest p-4 shadow-elevated sm:inset-x-0 sm:top-8 sm:w-[92vw] sm:p-6" onClick={(e) => e.stopPropagation()}>
      <div className="section-header"><div><h3 id="approval-modal-title" className="section-title">Avaliação obrigatória do serviço</h3><p className="section-description">Nota {approveModal.numeroNota} • fornecedor {approveModal.fornecedor.nome}</p><p className="section-description">Código externo: {approveModal.fornecedor.codigoExterno ?? "Não informado"}</p></div><span className="badge badge-blue">Aprovação</span></div>
      <div className="space-y-4">
        <div><p className="mb-2 text-sm font-semibold text-slate-800">Pontuação do serviço</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-5">{[1, 2, 3, 4, 5].map((rate) => { const description = rate === 1 ? "Muito insatisfeito" : rate === 2 ? "Insatisfeito" : rate === 3 ? "Regular" : rate === 4 ? "Satisfeito" : "Muito satisfeito"; return <button key={rate} type="button" className={`rounded-md border p-3 text-left text-xs transition ${evaluation.rating === rate ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm" : "border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"}`} onClick={() => setEvaluation((prev) => ({ ...prev, rating: rate as 1 | 2 | 3 | 4 | 5 }))}><strong className="text-base">{rate}</strong><br />{description}</button>; })}</div></div>
        <div className="grid gap-3 sm:grid-cols-3"><label>Qualifica?<select value={evaluation.qualifica} onChange={(event) => setEvaluation((prev) => ({ ...prev, qualifica: event.target.value as "SIM" | "NAO" }))}><option value="">Selecione</option><option value="SIM">Sim</option><option value="NAO">Não</option></select></label><label>Classificação de risco<select value={evaluation.riskLevel} onChange={(event) => setEvaluation((prev) => ({ ...prev, riskLevel: event.target.value as RiskLevel }))}><option value="">Selecione</option><option value="BAIXO">Baixo</option><option value="MEDIO">Médio</option><option value="ALTO">Alto</option></select></label><label>Data de pagamento<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label></div>
        <label>Ordem de compra <span className="text-xs font-normal text-slate-500">(opcional)</span><input value={purchaseOrder} onChange={(event) => setPurchaseOrder(event.target.value)} maxLength={120} placeholder="Informe a ordem de compra, se houver" /></label>
      </div>
      <div className="form-actions mt-5"><button type="button" className="btn-secondary" onClick={() => setApproveModal(null)}>Cancelar</button><button type="button" className="btn-primary" onClick={aprovarComAvaliacao}>Confirmar aprovação</button></div>
    </section>}

    {historyModal && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={() => setHistoryModal(null)} />}
    {historyModal && <section role="dialog" aria-modal="true" aria-labelledby="history-modal-title" className="fixed inset-x-2 top-4 z-50 mx-auto max-h-[calc(100svh-2rem)] w-auto max-w-3xl overflow-y-auto rounded-md bg-surface-container-lowest p-4 shadow-elevated sm:inset-x-0 sm:top-8 sm:w-[92vw] sm:p-6" onClick={(e) => e.stopPropagation()}>
      <div className="section-header"><div><h3 id="history-modal-title" className="section-title">Histórico da nota {historyModal.invoice.numeroNota}</h3><p className="section-description">Linha do tempo de interações e auditoria.</p></div><button type="button" className="btn-secondary" onClick={() => setHistoryModal(null)}>Fechar</button></div>
      <div className="space-y-3 border-l-2 border-border pl-4">{historyModal.events.map((event) => <article key={event.id} className="rounded-md border border-border bg-surface-container-low p-4"><p className="text-xs font-bold uppercase text-slate-500">{event.actionType}</p><p className="mt-1 text-sm font-semibold text-slate-900">{event.actionDescription || "Interação registrada"}</p><p className="text-xs text-slate-500">{event.actorName || "Sistema"} • {new Date(event.createdAt).toLocaleString("pt-BR")}</p>{event.reason && <p className="mt-2 text-xs font-semibold text-rose-700">Motivo: {event.reason}</p>}{event.comment && <p className="mt-1 text-xs text-slate-700">{event.comment}</p>}</article>)}</div>
    </section>}
    {message && <p className="message" role="status">{message}</p>}
  </AppLayout>;
}
