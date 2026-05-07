"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";

type Me = { manager: { nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR" } };
type IntegrationStatus = "AGUARDANDO" | "SUCESSO" | "FALHA";
type InvoiceSituation = "AUTORIZADA" | "CANCELADA";
type AuditEvent = { id: string; actionType: string; actionDescription?: string | null; actorName?: string | null; createdAt: string; reason?: string | null; comment?: string | null };

type Invoice = {
  id: string;
  numeroNota: string;
  codigoIdentificador: string;
  status: string;
  dataAtualizacao: string;
  dataEmissao?: string | null;
  valorServico?: number | null;
  fornecedor: { nome: string; cnpj?: string | null };
  responsavelValidacao?: string | null;
  dataValidacao?: string | null;
  observacaoValidacao?: string | null;
  situacaoNotaFiscal?: InvoiceSituation | null;
  codigoDelphi?: string | null;
  statusIntegracaoDelphi?: IntegrationStatus | null;
  ocContrato?: string | null;
  dataLancamentoDelphi?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_APROVACAO: "bg-amber-100 text-amber-800",
  APROVADO: "bg-emerald-100 text-emerald-800",
  RECUSADO: "bg-rose-100 text-rose-800"
};

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [supplierFilter, setSupplierFilter] = useState("TODOS");
  const [situacaoFilter, setSituacaoFilter] = useState("TODOS");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [menuState, setMenuState] = useState<{ invoice: Invoice; x: number; y: number } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ invoice: Invoice; events: AuditEvent[] } | null>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) return router.push("/login");
    setMe(await meRes.json());
    const notesRes = await fetch("/api/notas/minhas");
    if (notesRes.ok) setInvoices(await notesRes.json());
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => invoices.filter((i) =>
    (statusFilter === "TODOS" || i.status === statusFilter) &&
    (supplierFilter === "TODOS" || i.fornecedor.nome === supplierFilter) &&
    (situacaoFilter === "TODOS" || (i.situacaoNotaFiscal ?? "AUTORIZADA") === situacaoFilter)
  ), [invoices, statusFilter, supplierFilter, situacaoFilter]);

  const suppliers = useMemo(() => Array.from(new Set(invoices.map((i) => i.fornecedor.nome))), [invoices]);

  async function atualizarNota(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/notas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setMenuState(null);
    if (!res.ok) return setMessage("Não foi possível concluir a ação na nota.");
    setMessage("Ação registrada com sucesso.");
    await loadData();
  }

  async function verHistorico(invoice: Invoice) {
    const res = await fetch(`/api/notas/${invoice.id}/historico`);
    if (!res.ok) return setMessage("Não foi possível carregar o histórico da nota.");
    setHistoryModal({ invoice, events: await res.json() });
    setMenuState(null);
  }

  return <main className="container container-wide" onClick={() => setMenuState(null)}>
    <MainHeader title="Central operacional de notas fiscais" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} action={<button className="button-secondary" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}>Sair</button>} />
    <section className="card space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="TODOS">Todos status</option><option value="AGUARDANDO_APROVACAO">Pendente</option><option value="APROVADO">Aprovada</option><option value="RECUSADO">Reprovada</option></select>
        <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="TODOS">Todos fornecedores</option>{suppliers.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={situacaoFilter} onChange={(e) => setSituacaoFilter(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="TODOS">Todas situações</option><option value="AUTORIZADA">Autorizada</option><option value="CANCELADA">Cancelada</option></select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">Fornecedor</th><th className="px-4 py-3 text-left">NF</th><th className="px-4 py-3 text-left">Valor</th><th className="px-4 py-3 text-left">Emissão</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Situação</th><th className="px-4 py-3 text-left">Responsável</th><th className="px-4 py-3 text-left">Atualização</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((invoice) => <div key={invoice.id} className="contents">
              <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}>
                <td className="px-4 py-3">{invoice.fornecedor.nome}</td><td className="px-4 py-3">{invoice.numeroNota}</td><td className="px-4 py-3">{Number(invoice.valorServico || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="px-4 py-3">{invoice.dataEmissao ? new Date(invoice.dataEmissao).toLocaleDateString("pt-BR") : "-"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[invoice.status] ?? "bg-zinc-100 text-zinc-700"}`}>{invoice.status.replaceAll("_", " ")}</span></td>
                <td className="px-4 py-3">{invoice.situacaoNotaFiscal ?? "AUTORIZADA"}</td><td className="px-4 py-3">{invoice.responsavelValidacao ?? "-"}</td><td className="px-4 py-3">{new Date(invoice.dataAtualizacao).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 text-right"><button className="rounded-lg border border-zinc-300 !bg-white px-3 py-1.5 text-sm" onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuState({ invoice, x: Math.min(r.right - 208, window.innerWidth - 224), y: r.bottom + 6 }); }}>Ações ▾</button></td>
              </tr>
              {expandedId === invoice.id && <tr><td colSpan={9} className="bg-slate-50 p-0"><div className="grid gap-2 px-4 py-3 text-xs text-slate-700 sm:grid-cols-3"><p><strong>Identificador XML:</strong> {invoice.codigoIdentificador}</p><p><strong>CNPJ:</strong> {invoice.fornecedor.cnpj ?? "-"}</p><p><strong>OC/Contrato:</strong> {invoice.ocContrato ?? "-"}</p><p><strong>Dt. Lanc. Delphi:</strong> {invoice.dataLancamentoDelphi ? new Date(invoice.dataLancamentoDelphi).toLocaleString("pt-BR") : "-"}</p><p><strong>Código Delphi:</strong> {invoice.codigoDelphi ?? "Pendente integração"}</p><p><strong>Integração:</strong> {invoice.statusIntegracaoDelphi ?? "AGUARDANDO"}</p><p className="sm:col-span-3"><strong>Observação:</strong> {invoice.observacaoValidacao ?? "-"}</p></div></td></tr>}
            </div>)}
          </tbody>
        </table>
      </div>
    </section>
    {menuState && <div className="fixed z-50 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-2xl" style={{ left: menuState.x, top: menuState.y }} onClick={(e) => e.stopPropagation()}>
      {menuState.invoice.status === "AGUARDANDO_APROVACAO" && me?.manager.role !== "FORNECEDOR" && <button className="w-full rounded-lg !bg-white px-3 py-2 text-left text-sm !text-emerald-700 hover:!bg-emerald-50" onClick={() => atualizarNota(menuState.invoice.id, { status: "APROVADO" })}>✅ Aprovar</button>}
      {menuState.invoice.status === "AGUARDANDO_APROVACAO" && me?.manager.role !== "FORNECEDOR" && <button className="w-full rounded-lg !bg-white px-3 py-2 text-left text-sm !text-rose-700 hover:!bg-rose-50" onClick={() => { const reason = window.prompt("Motivo da reprovação:") ?? ""; atualizarNota(menuState.invoice.id, { status: "RECUSADO", reason, observacaoValidacao: reason }); }}>⛔ Reprovar</button>}
      <button className="w-full rounded-lg !bg-white px-3 py-2 text-left text-sm" onClick={() => { setExpandedId(menuState.invoice.id); setMenuState(null); }}>🔎 Ver detalhes</button>
      <button className="w-full rounded-lg !bg-white px-3 py-2 text-left text-sm" onClick={() => verHistorico(menuState.invoice)}>🕒 Ver histórico</button>
    </div>}

    {historyModal && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setHistoryModal(null)} />}
    {historyModal && <section className="fixed inset-x-0 top-16 z-50 mx-auto max-h-[80vh] w-[92vw] max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Histórico da nota {historyModal.invoice.numeroNota}</h3><button className="rounded-lg border border-zinc-300 !bg-white px-3 py-1 text-sm" onClick={() => setHistoryModal(null)}>Fechar</button></div>
      <div className="space-y-3 border-l-2 border-slate-200 pl-4">{historyModal.events.map((event) => <article key={event.id} className="rounded-xl border bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{event.actionType}</p><p className="text-sm font-medium">{event.actionDescription || "Interação registrada"}</p><p className="text-xs text-slate-500">{event.actorName || "Sistema"} • {new Date(event.createdAt).toLocaleString("pt-BR")}</p>{event.reason && <p className="text-xs text-rose-700">Motivo: {event.reason}</p>}{event.comment && <p className="text-xs text-slate-700">{event.comment}</p>}</article>)}</div>
    </section>}
    {message && <p className="message">{message}</p>}
  </main>;
}
