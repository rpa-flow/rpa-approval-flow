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

const EVENT_META: Record<string, { icon: string; title: string; color: string }> = {
  NOTE_CREATED: { icon: "🧾", title: "Criação da nota", color: "bg-sky-100 text-sky-700" },
  STATUS_CHANGED: { icon: "🔄", title: "Status alterado", color: "bg-indigo-100 text-indigo-700" },
  NOTE_UPDATED: { icon: "✏️", title: "Atualização", color: "bg-amber-100 text-amber-700" },
  NOTIFICATION_RESENT: { icon: "🔔", title: "Notificação enviada", color: "bg-emerald-100 text-emerald-700" }
};

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
  const [message, setMessage] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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

  const filtered = useMemo(() => invoices.filter((i) => statusFilter === "TODOS" || i.status === statusFilter), [invoices, statusFilter]);

  async function atualizarNota(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/notas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setOpenMenuId(null);
    if (!res.ok) return setMessage("Não foi possível concluir a ação na nota.");
    setMessage("Ação registrada com sucesso.");
    await loadData();
  }

  async function verHistorico(invoice: Invoice) {
    const res = await fetch(`/api/notas/${invoice.id}/historico`);
    if (!res.ok) return setMessage("Não foi possível carregar o histórico da nota.");
    setHistoryModal({ invoice, events: await res.json() });
    setOpenMenuId(null);
  }

  return (
    <main className="container container-wide">
      <MainHeader title="Aprovação de notas" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} />
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Notas fiscais</h2>
          <p className="text-sm text-slate-500">{filtered.length} nota(s)</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button key={filter.value} onClick={() => setStatusFilter(filter.value)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${statusFilter === filter.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {filter.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fornecedor</th>
                <th className="px-4 py-3 text-left font-medium">Número</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Atualização</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">{invoice.fornecedor.nome}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{invoice.numeroNota}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${invoice.status === "AGUARDANDO_APROVACAO" ? "bg-amber-100 text-amber-700" : invoice.status === "APROVADO" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {invoice.status === "AGUARDANDO_APROVACAO" ? "Pendente" : invoice.status === "APROVADO" ? "Aprovada" : "Recusada"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(invoice.dataAtualizacao).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <div className="relative flex justify-end">
                      <button onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">Ações ▾</button>
                      {openMenuId === invoice.id && (
                        <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                          {invoice.status === "AGUARDANDO_APROVACAO" && me?.manager.role !== "FORNECEDOR" && <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-emerald-50" onClick={() => atualizarNota(invoice.id, { status: "APROVADO" })}>✅ Aprovar nota</button>}
                          {invoice.status === "AGUARDANDO_APROVACAO" && me?.manager.role !== "FORNECEDOR" && <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-rose-50" onClick={() => { const reason = window.prompt("Informe o motivo da recusa (opcional):") ?? ""; atualizarNota(invoice.id, { status: "RECUSADO", reason }); }}>⛔ Recusar nota</button>}
                          <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100" onClick={() => verHistorico(invoice)}>🕒 Ver histórico da nota</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {historyModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <section className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">Histórico da nota {historyModal.invoice.numeroNota}</h3>
                <p className="text-sm text-slate-500">Timeline completa das ações realizadas.</p>
              </div>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100" onClick={() => setHistoryModal(null)}>Fechar</button>
            </div>

            <div className="space-y-4 border-l-2 border-slate-200 pl-4">
              {historyModal.events.map((event) => {
                const meta = EVENT_META[event.actionType] || { icon: "📌", title: "Interação registrada", color: "bg-slate-100 text-slate-700" };
                const who = event.actorName || "Sistema";
                const friendly = event.actionDescription || `${who} realizou uma ação na nota`;
                return (
                  <article key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.color}`}>{meta.icon} {meta.title}</span>
                      <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{friendly}</p>
                    <p className="mt-1 text-xs text-slate-500">Responsável: {who}</p>
                    {event.reason && <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700"><strong>Motivo:</strong> {event.reason}</p>}
                    {event.comment && <p className="mt-2 rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-700"><strong>Comentário:</strong> {event.comment}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {message && <p className="message">{message}</p>}
    </main>
  );
}
