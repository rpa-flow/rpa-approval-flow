"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";

type Me = {
  manager: {
    nome: string;
    email: string;
    role: "ADMIN" | "GESTOR" | "FORNECEDOR";
    suppliers: Array<{
      supplierId: string;
      supplierName: string;
    }>;
  };
};

type Invoice = {
  id: string;
  numeroNota: string;
  codigoIdentificador: string;
  status: string;
  processada: boolean;
  statusProcessamento: string;
  dataAtualizacao: string;
  fornecedor: {
    id: string;
    nome: string;
  };
};

type StatusFilter = "TODOS" | "AGUARDANDO_APROVACAO" | "APROVADO" | "RECUSADO";

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "AGUARDANDO_APROVACAO", label: "Aguardando aprovação" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "RECUSADO", label: "Recusada" }
];

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [historyByInvoice, setHistoryByInvoice] = useState<Record<string, any[]>>({});
  const router = useRouter();

  const loadData = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    const meData = await meRes.json();
    setMe(meData);

    const notesRes = await fetch("/api/notas/minhas");
    if (notesRes.ok) setInvoices(await notesRes.json());
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const pendentes = invoices.filter((i) => i.status === "AGUARDANDO_APROVACAO").length;
    const aprovadas = invoices.filter((i) => i.status === "APROVADO").length;
    const encerradas = invoices.filter((i) => i.status === "APROVADO" || i.status === "RECUSADO").length;
    return { total: invoices.length, pendentes, aprovadas, encerradas };
  }, [invoices]);

  const filtered = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    return invoices.filter((invoice) => {
      if (statusFilter !== "TODOS" && invoice.status !== statusFilter) return false;

      const updatedAt = new Date(invoice.dataAtualizacao);
      if (start && updatedAt < start) return false;
      if (end && updatedAt > end) return false;

      return true;
    });
  }, [statusFilter, startDate, endDate, invoices]);

  async function carregarHistorico(id: string) {
    const res = await fetch(`/api/notas/${id}/historico`);
    if (res.ok) setHistoryByInvoice((prev) => ({ ...prev, [id]: await res.json() }));
  }

  async function atualizarNota(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/notas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      setMessage("Erro ao atualizar nota.");
      return;
    }

    setMessage("Nota atualizada com sucesso.");
    await loadData();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="container container-wide">
      <MainHeader
        title="Dashboard de Notas"
        subtitle={
          me
            ? `${me.manager.nome} (${me.manager.email}) — fornecedores: ${me.manager.suppliers.map((s) => s.supplierName).join(", ")}`
            : undefined
        }
        action={<button className="button-secondary" onClick={logout}>Sair</button>}
      />

      <section className="stats-grid">
        <article className="card stat-card">
          <p className="muted small">Total de notas</p>
          <h3>{stats.total}</h3>
        </article>
        <article className="card stat-card highlight-warning">
          <p className="muted small">Aguardando aprovação</p>
          <h3>{stats.pendentes}</h3>
        </article>
        <article className="card stat-card highlight-success">
          <p className="muted small">Aprovadas</p>
          <h3>{stats.aprovadas}</h3>
        </article>
        <article className="card stat-card">
          <p className="muted small">Encerradas (aprovadas/recusadas)</p>
          <h3>{stats.encerradas}</h3>
        </article>
      </section>

      <section className="card">
        <div className="filters-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Notas fiscais</h2>
            <p className="muted small" style={{ margin: 0 }}>Acompanhe aprovações e use filtros para achar notas rapidamente.</p>
          </div>
          <div className="filter-group" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(140px, 1fr))", gap: 8, width: "100%" }}>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={statusFilter === option.value ? "chip active" : "chip"}
                onClick={() => setStatusFilter(option.value)}
                style={{ width: "100%" }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filters-header" style={{ marginTop: 12 }}>
          <div className="dashboard-filters-row">
            <label className="small muted">
              De
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                style={{ minHeight: 42 }}
              />
            </label>
            <label className="small muted">
              Até
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                style={{ minHeight: 42 }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("TODOS");
                setStartDate("");
                setEndDate("");
              }}
              className={`clear-filter-button ${statusFilter === "TODOS" && !startDate && !endDate ? "chip active" : "chip"}`}
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="table-wrap table-wrap-large">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Número</th>
                <th>Identificador</th>
                <th>Status</th>
                <th>Atualização</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => (
                <Fragment key={invoice.id}>
                  <tr>
                    <td>{invoice.fornecedor.nome}</td>
                    <td>{invoice.numeroNota}</td>
                    <td className="identifier-cell">{invoice.codigoIdentificador}</td>
                    <td><span className={invoice.status === "AGUARDANDO_APROVACAO" ? "badge warning" : "badge success"}>{invoice.status === "AGUARDANDO_APROVACAO" ? "Pendente" : invoice.status === "APROVADO" ? "Aprovada" : invoice.status === "RECUSADO" ? "Recusada" : invoice.status}</span></td>
                    <td title={new Date(invoice.dataAtualizacao).toLocaleString("pt-BR")}>{new Date(invoice.dataAtualizacao).toLocaleDateString("pt-BR")}</td>
                    <td>
                      {me?.manager.role !== "FORNECEDOR" && invoice.status === "AGUARDANDO_APROVACAO" ? (
                        <>
                          <button onClick={() => atualizarNota(invoice.id, { status: "APROVADO" })}>Aprovar</button>
                          <button className="button-secondary" onClick={() => { const reason = window.prompt("Motivo da recusa (opcional):") ?? ""; atualizarNota(invoice.id, { status: "RECUSADO", reason }); }}>Recusar nota</button>
                          <button className="chip" onClick={() => carregarHistorico(invoice.id)}>Histórico</button>
                        </>
                      ) : (
                        <button className="chip" onClick={() => carregarHistorico(invoice.id)}>Histórico</button>
                      )}
                    </td>
                  </tr>
                  {historyByInvoice[invoice.id]?.length ? (
                    <tr><td colSpan={6}><div style={{ padding: 12, background: "#f8fafc", borderRadius: 8 }}>
                      {historyByInvoice[invoice.id].map((event) => (<div key={event.id} className="small muted" style={{ marginBottom: 6 }}>• {new Date(event.createdAt).toLocaleString("pt-BR")}: {event.actionType} ({event.previousStatus || "-"} → {event.newStatus || "-"}) {event.reason ? `- ${event.reason}` : ""}</div>))}
                    </div></td></tr>
                  ) : null}
                </Fragment>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="muted center">🔎 Nenhuma nota encontrada para o filtro selecionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
