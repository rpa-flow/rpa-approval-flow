"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";

type Me = { manager: { nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR" } };
type Invoice = { id: string; numeroNota: string; codigoIdentificador: string; status: string; dataAtualizacao: string; fornecedor: { nome: string } };
type AuditEvent = { id: string; actionType: string; actionDescription?: string | null; actorName?: string | null; createdAt: string; reason?: string | null; comment?: string | null };
type StatusFilter = "TODOS" | "AGUARDANDO_APROVACAO" | "APROVADO" | "RECUSADO";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "AGUARDANDO_APROVACAO", label: "Pendentes" },
  { value: "APROVADO", label: "Aprovadas" },
  { value: "RECUSADO", label: "Recusadas" }
];
const ACTION_LABELS: Record<string, string> = {
  NOTE_CREATED: "Criação da nota",
  STATUS_CHANGED: "Alteração de status",
  NOTE_UPDATED: "Atualização de dados",
  NOTIFICATION_RESENT: "Envio de notificação",
  OWNER_CHANGED: "Alteração de responsável",
  REOPENED: "Reabertura da nota",
  COMMENT_ADDED: "Comentário registrado"
};

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
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
  useEffect(() => {
    const close = () => setMenuState(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);

  const filtered = useMemo(() => invoices.filter((i) => statusFilter === "TODOS" || i.status === statusFilter), [invoices, statusFilter]);

  async function atualizarNota(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/notas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setMenuState(null);
    if (!res.ok) return setMessage("Não foi possível concluir a ação na nota.");
    setMessage("Ação registrada com sucesso.");
    await loadData();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function verHistorico(invoice: Invoice) {
    const res = await fetch(`/api/notas/${invoice.id}/historico`);
    if (!res.ok) return setMessage("Não foi possível carregar o histórico da nota.");
    setHistoryModal({ invoice, events: await res.json() });
    setMenuState(null);
  }

  return (
    <main className="container container-wide" onClick={() => setMenuState(null)}>
      <MainHeader title="Aprovação de notas" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} action={<button className="button-secondary" onClick={logout}>Sair</button>} />
      <section className="card space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Notas fiscais</h2>
          <p className="text-sm text-slate-500">{filtered.length} nota(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => <button key={filter.value} onClick={() => setStatusFilter(filter.value)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${statusFilter === filter.value ? "bg-slate-800 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{filter.label}</button>)}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">Fornecedor</th><th className="px-4 py-3 text-left">Número</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Atualização</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-3">{invoice.fornecedor.nome}</td>
                  <td className="px-4 py-3">{invoice.numeroNota}</td>
                  <td className="px-4 py-3">{invoice.status === "AGUARDANDO_APROVACAO" ? "Pendente" : invoice.status === "APROVADO" ? "Aprovada" : "Recusada"}</td>
                  <td className="px-4 py-3">{new Date(invoice.dataAtualizacao).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right"><button className="rounded-lg border border-zinc-300 !bg-white px-3 py-1.5 text-sm !text-zinc-700 hover:!bg-zinc-50" onClick={(e) => { const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuState({ invoice, x: Math.min(r.right - 208, window.innerWidth - 224), y: r.bottom + 6 }); }}>Ações ▾</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {menuState && (
        <div className="fixed z-50 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-2xl ring-1 ring-black/5" style={{ left: menuState.x, top: menuState.y }} onClick={(e) => e.stopPropagation()}>
          {menuState.invoice.status === "AGUARDANDO_APROVACAO" && me?.manager.role !== "FORNECEDOR" && <button className="w-full rounded-lg !bg-white px-3 py-2 text-left text-sm !text-emerald-700 hover:!bg-emerald-50" onClick={() => atualizarNota(menuState.invoice.id, { status: "APROVADO" })}>✅ Aprovar nota</button>}
          {menuState.invoice.status === "AGUARDANDO_APROVACAO" && me?.manager.role !== "FORNECEDOR" && <button className="w-full rounded-lg !bg-white px-3 py-2 text-left text-sm !text-rose-700 hover:!bg-rose-50" onClick={() => { const reason = window.prompt("Informe o motivo da recusa (opcional):") ?? ""; atualizarNota(menuState.invoice.id, { status: "RECUSADO", reason }); }}>⛔ Recusar nota</button>}
          <button className="w-full rounded-lg !bg-white px-3 py-2 text-left text-sm !text-zinc-700 hover:!bg-zinc-100" onClick={() => verHistorico(menuState.invoice)}>🕒 Ver histórico da nota</button>
        </div>
      )}

      {historyModal && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setHistoryModal(null)} />}

      {historyModal && (
        <section className="fixed inset-x-0 top-16 z-50 mx-auto max-h-[80vh] w-[92vw] max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Histórico da nota {historyModal.invoice.numeroNota}</h3><button className="rounded-lg border border-zinc-300 !bg-white px-3 py-1 text-sm !text-zinc-700 hover:!bg-zinc-50" onClick={() => setHistoryModal(null)}>Fechar</button></div>
          <div className="space-y-3 border-l-2 border-slate-200 pl-4">{historyModal.events.map((event) => <article key={event.id} className="rounded-xl border bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ACTION_LABELS[event.actionType] || "Ação registrada"}</p><p className="text-sm font-medium">{event.actionDescription || "Interação registrada"}</p><p className="text-xs text-slate-500">{event.actorName || "Sistema"} • {new Date(event.createdAt).toLocaleString("pt-BR")}</p>{event.reason && <p className="text-xs text-rose-700">Motivo: {event.reason}</p>}</article>)}</div>
        </section>
      )}

      {message && <p className="message">{message}</p>}
    </main>
  );
}
