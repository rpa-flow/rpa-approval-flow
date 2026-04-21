"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = {
  manager: {
    nome: string;
    email: string;
    supplierId: string;
    supplierName: string;
  };
};

type Invoice = {
  id: string;
  numeroNota: string;
  codigoIdentificador: string;
  status: string;
  processada: boolean;
  fornecedor: {
    nome: string;
  };
};

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rule, setRule] = useState({ diasLembrete: 2, ativo: true, destinatarioAdicional: "" });
  const [supplierConfig, setSupplierConfig] = useState({ ativo: true, recorrenciaDias: 2, emailsExtras: "" });
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

    const [notesRes, globalRes, supplierRes] = await Promise.all([
      fetch("/api/notas/minhas"),
      fetch("/api/configuracoes/avisos"),
      fetch(`/api/configuracoes/fornecedores/${meData.manager.supplierId}/avisos`)
    ]);

    if (notesRes.ok) setInvoices(await notesRes.json());
    if (globalRes.ok) setRule(await globalRes.json());
    if (supplierRes.ok) {
      const payload = await supplierRes.json();
      setSupplierConfig({
        ativo: payload.config.ativo,
        recorrenciaDias: payload.config.recorrenciaDias,
        emailsExtras: (payload.config.emailsExtras ?? []).join(",")
      });
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function aprovarNota(id: string) {
    const res = await fetch(`/api/notas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APROVADO", processada: true, statusProcessamento: "CONCLUIDO" })
    });

    if (!res.ok) {
      setMessage("Erro ao aprovar nota.");
      return;
    }

    setMessage("Nota aprovada com sucesso.");
    await loadData();
  }

  async function salvarRegraGlobal(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/configuracoes/avisos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, destinatarioAdicional: rule.destinatarioAdicional || null })
    });

    setMessage(res.ok ? "Regra global salva." : "Erro ao salvar regra global.");
  }

  async function salvarRegraFornecedor(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;

    const res = await fetch(`/api/configuracoes/fornecedores/${me.manager.supplierId}/avisos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ativo: supplierConfig.ativo,
        recorrenciaDias: Number(supplierConfig.recorrenciaDias),
        emailsExtras: supplierConfig.emailsExtras
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      })
    });

    setMessage(res.ok ? "Regra do fornecedor salva." : "Erro ao salvar regra do fornecedor.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="container">
      <h1>Painel do Gestor</h1>
      {me && (
        <p>
          Logado como <strong>{me.manager.nome}</strong> ({me.manager.email}) — fornecedor:
          <strong> {me.manager.supplierName}</strong>
        </p>
      )}
      <button onClick={logout}>Sair</button>

      <section className="card">
        <h2>Aprovação de notas (somente do seu fornecedor)</h2>
        <ul>
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              NF {invoice.numeroNota} ({invoice.codigoIdentificador}) - {invoice.status}
              {!invoice.processada && (
                <button onClick={() => aprovarNota(invoice.id)} style={{ marginLeft: 8 }}>
                  Aprovar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Regra global de aviso</h2>
        <form onSubmit={salvarRegraGlobal} className="form-grid">
          <input
            type="number"
            value={rule.diasLembrete}
            onChange={(e) => setRule((p) => ({ ...p, diasLembrete: Number(e.target.value) }))}
          />
          <input
            type="email"
            placeholder="destinatario@empresa.com"
            value={rule.destinatarioAdicional ?? ""}
            onChange={(e) => setRule((p) => ({ ...p, destinatarioAdicional: e.target.value }))}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={rule.ativo}
              onChange={(e) => setRule((p) => ({ ...p, ativo: e.target.checked }))}
            />
            Regra ativa
          </label>
          <button type="submit">Salvar regra global</button>
        </form>
      </section>

      <section className="card">
        <h2>Regra de recorrência do seu fornecedor</h2>
        <form onSubmit={salvarRegraFornecedor} className="form-grid">
          <input
            type="number"
            min={1}
            max={90}
            value={supplierConfig.recorrenciaDias}
            onChange={(e) =>
              setSupplierConfig((p) => ({ ...p, recorrenciaDias: Number(e.target.value) }))
            }
          />
          <input
            placeholder="emails extras separados por vírgula"
            value={supplierConfig.emailsExtras}
            onChange={(e) => setSupplierConfig((p) => ({ ...p, emailsExtras: e.target.value }))}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={supplierConfig.ativo}
              onChange={(e) => setSupplierConfig((p) => ({ ...p, ativo: e.target.checked }))}
            />
            Recorrência ativa
          </label>
          <button type="submit">Salvar regra do fornecedor</button>
        </form>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
