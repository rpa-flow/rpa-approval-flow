"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Me = {
  manager: {
    nome: string;
    email: string;
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

type Filter = "todas" | "pendentes" | "concluidas";

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<Filter>("pendentes");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function loadData() {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    const meData = await meRes.json();
    setMe(meData);

    const notesRes = await fetch("/api/notas/minhas");
    if (notesRes.ok) setInvoices(await notesRes.json());
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const pendentes = invoices.filter((i) => i.status === "AGUARDANDO_APROVACAO").length;
    const aprovadas = invoices.filter((i) => i.status === "APROVADO").length;
    const encerradas = invoices.filter((i) => i.status === "PROCESSADO" || i.status === "EXPIRADA").length;
    return { total: invoices.length, pendentes, aprovadas, encerradas };
  }, [invoices]);

  const filtered = useMemo(() => {
    if (filter === "pendentes") return invoices.filter((i) => i.status === "AGUARDANDO_APROVACAO");
    if (filter === "concluidas") return invoices.filter((i) => i.status !== "AGUARDANDO_APROVACAO");
    return invoices;
  }, [filter, invoices]);

  async function aprovarNota(id: string) {
    const res = await fetch(`/api/notas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APROVADO" })
    });

    if (!res.ok) {
      setMessage("Erro ao aprovar nota.");
      return;
    }

    setMessage("Nota aprovada com sucesso.");
    await loadData();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="container container-wide">
      <header className="topbar card">
        <div>
          <h1>Dashboard de Notas</h1>
          {me && (
            <p className="muted">
              {me.manager.nome} ({me.manager.email}) — fornecedores: {me.manager.suppliers.map((s) => s.supplierName).join(", ")}
            </p>
          )}
        </div>
        <div className="actions-row">
          <Link href="/configuracoes" className="button-secondary">
            Configurações
          </Link>
          <button onClick={logout}>Sair</button>
        </div>
      </header>

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
            <button className={filter === "pendentes" ? "chip active" : "chip"} onClick={() => setFilter("pendentes")}>Pendentes</button>
            <button className={filter === "concluidas" ? "chip active" : "chip"} onClick={() => setFilter("concluidas")}>Concluídas</button>
            <button className={filter === "todas" ? "chip active" : "chip"} onClick={() => setFilter("todas")}>Todas</button>
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
                    {invoice.status === "AGUARDANDO_APROVACAO" ? <button onClick={() => aprovarNota(invoice.id)}>Aprovar</button> : <span className="muted">—</span>}
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
