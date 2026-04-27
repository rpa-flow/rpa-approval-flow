"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";

type Me = {
  manager: {
    nome: string;
    email: string;
    role: "ADMIN" | "GESTOR";
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

type QuickFilter = "todas" | "pendentes" | "concluidas";
type StatusFilter = "TODOS" | "AGUARDANDO_APROVACAO" | "APROVADO" | "PROCESSADO" | "EXPIRADA";

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("pendentes");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
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
    const encerradas = invoices.filter((i) => i.status === "PROCESSADO" || i.status === "EXPIRADA").length;
    return { total: invoices.length, pendentes, aprovadas, encerradas };
  }, [invoices]);

  const filtered = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    return invoices.filter((invoice) => {
      if (quickFilter === "pendentes" && invoice.status !== "AGUARDANDO_APROVACAO") return false;
      if (quickFilter === "concluidas" && invoice.status === "AGUARDANDO_APROVACAO") return false;
      if (statusFilter !== "TODOS" && invoice.status !== statusFilter) return false;

      const updatedAt = new Date(invoice.dataAtualizacao);
      if (start && updatedAt < start) return false;
      if (end && updatedAt > end) return false;

      return true;
    });
  }, [quickFilter, statusFilter, startDate, endDate, invoices]);

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
      <AppHeader
        title="Dashboard de Notas"
        subtitle={
          me
            ? `${me.manager.nome} (${me.manager.email}) — fornecedores: ${me.manager.suppliers.map((s) => s.supplierName).join(", ")}`
            : undefined
        }
        links={[
          { href: "/dashboard", label: "Dashboard", icon: "📊" },
          { href: "/fornecedores", label: "Fornecedores", icon: "🏢" },
          { href: "/configuracoes", label: "Configurações", icon: "⚙️" },
          { href: "/perfil", label: "Perfil", icon: "👤" }
        ]}
      />
      <div className="actions-row">
        <button onClick={logout}>Sair</button>
      </div>

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
          <p className="muted small">Encerradas (processadas/expiradas)</p>
          <h3>{stats.encerradas}</h3>
        </article>
      </section>

      <section className="card">
        <div className="filters-header">
          <h2>Notas fiscais</h2>
          <div className="filter-group">
            <button className={quickFilter === "pendentes" ? "chip active" : "chip"} onClick={() => setQuickFilter("pendentes")}>Pendentes</button>
            <button className={quickFilter === "concluidas" ? "chip active" : "chip"} onClick={() => setQuickFilter("concluidas")}>Concluídas</button>
            <button className={quickFilter === "todas" ? "chip active" : "chip"} onClick={() => setQuickFilter("todas")}>Todas</button>
          </div>
        </div>

        <div className="filters-header" style={{ marginTop: 12 }}>
          <div className="filter-group" style={{ flexWrap: "wrap" }}>
            <label className="small muted">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                style={{ marginLeft: 8 }}
              >
                <option value="TODOS">Todos</option>
                <option value="AGUARDANDO_APROVACAO">Aguardando aprovação</option>
                <option value="APROVADO">Aprovado</option>
                <option value="PROCESSADO">Processado</option>
                <option value="EXPIRADA">Expirada</option>
              </select>
            </label>
            <label className="small muted">
              De
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                style={{ marginLeft: 8 }}
              />
            </label>
            <label className="small muted">
              Até
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                style={{ marginLeft: 8 }}
              />
            </label>
            <button
              type="button"
              className="chip"
              onClick={() => {
                setStatusFilter("TODOS");
                setStartDate("");
                setEndDate("");
              }}
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="table-wrap table-wrap-large">
          <table>
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
                <tr key={invoice.id}>
                  <td>{invoice.fornecedor.nome}</td>
                  <td>{invoice.numeroNota}</td>
                  <td>{invoice.codigoIdentificador}</td>
                  <td><span className={invoice.status === "AGUARDANDO_APROVACAO" ? "badge warning" : "badge success"}>{invoice.status === "AGUARDANDO_APROVACAO" ? "Aguardando aprovação" : invoice.status === "APROVADO" ? "Aprovado" : invoice.status === "PROCESSADO" ? "Processado" : "Expirada"}</span></td>
                  <td>{new Date(invoice.dataAtualizacao).toLocaleString("pt-BR")}</td>
                  <td>
                    {invoice.status === "AGUARDANDO_APROVACAO" ? (
                      <button onClick={() => atualizarNota(invoice.id, { status: "APROVADO" })}>Aprovar</button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="muted center">Nenhuma nota encontrada para o filtro selecionado.</td>
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
