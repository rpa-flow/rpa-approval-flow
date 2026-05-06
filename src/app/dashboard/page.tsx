"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";

type Me = { manager: { nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR"; suppliers: Array<{ supplierId: string; supplierName: string; }>; }; };
type Invoice = { id: string; numeroNota: string; codigoIdentificador: string; status: string; dataAtualizacao: string; fornecedor: { id: string; nome: string; }; };
type AuditEvent = { id: string; actionType: string; actionDescription?: string | null; actorName?: string | null; createdAt: string; reason?: string | null; comment?: string | null; previousStatus?: string | null; newStatus?: string | null; };
type StatusFilter = "TODOS" | "AGUARDANDO_APROVACAO" | "APROVADO" | "RECUSADO";

const STATUS_FILTER_OPTIONS = [
  { value: "TODOS", label: "Todos" },
  { value: "AGUARDANDO_APROVACAO", label: "Pendente" },
  { value: "APROVADO", label: "Aprovada" },
  { value: "RECUSADO", label: "Recusada" }
] as const;

const EVENT_META: Record<string, { icon: string; label: string }> = {
  NOTE_CREATED: { icon: "🧾", label: "Criação da nota" },
  STATUS_CHANGED: { icon: "🔄", label: "Alteração de status" },
  NOTE_UPDATED: { icon: "✏️", label: "Atualização" },
  NOTIFICATION_RESENT: { icon: "🔔", label: "Notificação enviada" }
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
      <section className="card">
        <h2 style={{ marginBottom: 8 }}>Notas fiscais</h2>
        <div className="filter-group" style={{ display: "flex", gap: 8, marginBottom: 16 }}>{STATUS_FILTER_OPTIONS.map((o) => <button key={o.value} className={statusFilter === o.value ? "chip active" : "chip"} onClick={() => setStatusFilter(o.value)}>{o.label}</button>)}</div>
        <div className="table-wrap table-wrap-large">
          <table className="dashboard-table">
            <thead><tr><th>Fornecedor</th><th>Número</th><th>Status</th><th>Atualização</th><th style={{ width: 100 }}>Ações</th></tr></thead>
            <tbody>
              {filtered.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.fornecedor.nome}</td>
                  <td>{invoice.numeroNota}</td>
                  <td>{invoice.status === "AGUARDANDO_APROVACAO" ? "Pendente" : invoice.status === "APROVADO" ? "Aprovada" : "Recusada"}</td>
                  <td>{new Date(invoice.dataAtualizacao).toLocaleString("pt-BR")}</td>
                  <td style={{ position: "relative" }}>
                    <button className="chip" onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)}>⋯ Ações</button>
                    {openMenuId === invoice.id && (
                      <div style={{ position: "absolute", right: 0, marginTop: 8, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, minWidth: 190, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 20 }}>
                        {invoice.status === "AGUARDANDO_APROVACAO" && me?.manager.role !== "FORNECEDOR" && <button style={{ width: "100%" }} onClick={() => atualizarNota(invoice.id, { status: "APROVADO" })}>✅ Aprovar nota</button>}
                        {invoice.status === "AGUARDANDO_APROVACAO" && me?.manager.role !== "FORNECEDOR" && <button style={{ width: "100%" }} onClick={() => { const reason = window.prompt("Informe o motivo da recusa (opcional):") ?? ""; atualizarNota(invoice.id, { status: "RECUSADO", reason }); }}>⛔ Recusar nota</button>}
                        <button style={{ width: "100%" }} onClick={() => verHistorico(invoice)}>🕒 Ver histórico da nota</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {historyModal && (
        <section className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Histórico da nota {historyModal.invoice.numeroNota}</h3>
            <button className="button-secondary" onClick={() => setHistoryModal(null)}>Fechar</button>
          </div>
          <div style={{ marginTop: 12, borderLeft: "2px solid #e2e8f0", paddingLeft: 12 }}>
            {historyModal.events.map((event) => {
              const meta = EVENT_META[event.actionType] || { icon: "📌", label: "Interação registrada" };
              const who = event.actorName || "Sistema";
              const friendly = event.actionDescription || `${who} realizou uma ação na nota`;
              return (
                <Fragment key={event.id}>
                  <article style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 600 }}>{meta.icon} {meta.label}</div>
                    <div>{friendly}</div>
                    <div className="muted small">{who} • {new Date(event.createdAt).toLocaleString("pt-BR")}</div>
                    {event.reason ? <div className="small">Motivo: {event.reason}</div> : null}
                    {event.comment ? <div className="small">Comentário: {event.comment}</div> : null}
                  </article>
                </Fragment>
              );
            })}
          </div>
        </section>
      )}

      {message && <p className="message">{message}</p>}
    </main>
  );
}
