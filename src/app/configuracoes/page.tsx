"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = {
  manager: {
    suppliers: Array<{
      supplierId: string;
      supplierName: string;
    }>;
  };
};

export default function ConfiguracoesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [rule, setRule] = useState({ diasLembrete: 2, ativo: true, destinatarioAdicional: "" });
  const [supplierConfig, setSupplierConfig] = useState({ ativo: true, recorrenciaDias: 2, emailsExtras: "" });
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function loadSupplierConfig(supplierId: string) {
    const supplierRes = await fetch(`/api/configuracoes/fornecedores/${supplierId}/avisos`);
    if (supplierRes.ok) {
      const payload = await supplierRes.json();
      setSupplierConfig({
        ativo: payload.config.ativo,
        recorrenciaDias: payload.config.recorrenciaDias,
        emailsExtras: (payload.config.emailsExtras ?? []).join(", ")
      });
    }
  }

  async function loadData() {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    const meData = await meRes.json();
    setMe(meData);

    const firstSupplierId = meData.manager.suppliers?.[0]?.supplierId ?? "";
    setSelectedSupplierId(firstSupplierId);

    const globalRes = await fetch("/api/configuracoes/avisos");
    if (globalRes.ok) setRule(await globalRes.json());

    if (firstSupplierId) await loadSupplierConfig(firstSupplierId);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function salvarRegraGlobal(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/configuracoes/avisos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, destinatarioAdicional: rule.destinatarioAdicional || null })
    });

    setMessage(res.ok ? "Configuração global salva." : "Erro ao salvar configuração global.");
  }

  async function salvarRegraFornecedor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplierId) return;

    const res = await fetch(`/api/configuracoes/fornecedores/${selectedSupplierId}/avisos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ativo: supplierConfig.ativo,
        recorrenciaDias: Number(supplierConfig.recorrenciaDias),
        emailsExtras: supplierConfig.emailsExtras.split(",").map((s) => s.trim()).filter(Boolean)
      })
    });

    setMessage(res.ok ? "Configuração do fornecedor salva." : "Erro ao salvar configuração do fornecedor.");
  }

  return (
    <main className="container">
      <header className="topbar card">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Selecione o fornecedor para editar regras específicas.</p>
        </div>
        <Link href="/dashboard" className="button-secondary">Voltar ao dashboard</Link>
      </header>

      <section className="card">
        <h2>Regra global de aviso</h2>
        <p className="muted small">Define lembretes gerais e destinatário adicional padrão.</p>
        <form onSubmit={salvarRegraGlobal} className="form-grid">
          <label>
            Dias para lembrete
            <input type="number" min={0} max={60} value={rule.diasLembrete} onChange={(e) => setRule((p) => ({ ...p, diasLembrete: Number(e.target.value) }))} />
          </label>
          <label>
            E-mail adicional global
            <input type="email" placeholder="financeiro@empresa.com" value={rule.destinatarioAdicional ?? ""} onChange={(e) => setRule((p) => ({ ...p, destinatarioAdicional: e.target.value }))} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={rule.ativo} onChange={(e) => setRule((p) => ({ ...p, ativo: e.target.checked }))} />
            Ativar lembretes globais
          </label>
          <button type="submit">Salvar regra global</button>
        </form>
      </section>

      <section className="card">
        <h2>Regra do fornecedor</h2>
        <label>
          Fornecedor
          <select
            value={selectedSupplierId}
            onChange={async (e) => {
              setSelectedSupplierId(e.target.value);
              await loadSupplierConfig(e.target.value);
            }}
          >
            {(me?.manager.suppliers ?? []).map((s) => (
              <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
            ))}
          </select>
        </label>
        <p className="muted small">Defina recorrência e e-mails extras para o fornecedor selecionado.</p>
        <form onSubmit={salvarRegraFornecedor} className="form-grid">
          <label>
            Recorrência (dias)
            <input type="number" min={1} max={90} value={supplierConfig.recorrenciaDias} onChange={(e) => setSupplierConfig((p) => ({ ...p, recorrenciaDias: Number(e.target.value) }))} />
          </label>
          <label>
            E-mails extras (separados por vírgula)
            <input placeholder="compras@empresa.com, fiscal@empresa.com" value={supplierConfig.emailsExtras} onChange={(e) => setSupplierConfig((p) => ({ ...p, emailsExtras: e.target.value }))} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={supplierConfig.ativo} onChange={(e) => setSupplierConfig((p) => ({ ...p, ativo: e.target.checked }))} />
            Ativar lembretes do fornecedor
          </label>
          <button type="submit">Salvar regra do fornecedor</button>
        </form>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
