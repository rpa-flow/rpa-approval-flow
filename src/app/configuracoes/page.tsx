"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Me = {
  manager: {
    role: "ADMIN" | "GESTOR";
    suppliers: Array<{
      supplierId: string;
      supplierName: string;
    }>;
  };
};

type SupplierListItem = {
  id: string;
  nome: string;
  cnpj: string | null;
  managers: Array<{
    id: string;
    nome: string;
    email: string;
    role: "ADMIN" | "GESTOR";
    ativo: boolean;
  }>;
};

export default function ConfiguracoesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [rule, setRule] = useState({ diasLembrete: 2, ativo: true, destinatarioAdicional: "" });
  const [supplierConfig, setSupplierConfig] = useState({ ativo: true, recorrenciaDias: 2, maxTentativas: 2, emailsExtras: "" });
  const [supplierForm, setSupplierForm] = useState({
    nome: "",
    cnpj: "",
    managerNome: "",
    managerEmail: "",
    managerSenha: ""
  });
  const [message, setMessage] = useState("");
  const router = useRouter();

  const selectedSupplierName = useMemo(() => {
    return me?.manager.suppliers.find((s) => s.supplierId === selectedSupplierId)?.supplierName ?? "Fornecedor";
  }, [me, selectedSupplierId]);

  async function loadSupplierConfig(supplierId: string) {
    const supplierRes = await fetch(`/api/configuracoes/fornecedores/${supplierId}/avisos`);
    if (supplierRes.ok) {
      const payload = await supplierRes.json();
      setSupplierConfig({
        ativo: payload.config.ativo,
        recorrenciaDias: payload.config.recorrenciaDias,
        maxTentativas: payload.config.maxTentativas ?? 2,
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

  async function loadSuppliers() {
    const suppliersRes = await fetch("/api/fornecedores");
    if (!suppliersRes.ok) return;

    const payload = (await suppliersRes.json()) as SupplierListItem[];
    setSuppliers(payload);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (me?.manager.role === "ADMIN") {
      loadSuppliers();
    }
  }, [me?.manager.role]);

  async function salvarRegraGlobal(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/configuracoes/avisos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, destinatarioAdicional: rule.destinatarioAdicional || null })
    });

    setMessage(res.ok ? "Configuração global salva com sucesso." : "Erro ao salvar configuração global.");
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
        maxTentativas: Number(supplierConfig.maxTentativas),
        emailsExtras: supplierConfig.emailsExtras.split(",").map((s) => s.trim()).filter(Boolean)
      })
    });

    setMessage(
      res.ok
        ? `Configuração do fornecedor ${selectedSupplierName} salva com sucesso.`
        : "Erro ao salvar configuração do fornecedor."
    );
  }

  async function cadastrarFornecedor(e: React.FormEvent) {
    e.preventDefault();
    const cnpjDigits = supplierForm.cnpj.replace(/\D/g, "");

    const res = await fetch("/api/fornecedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: supplierForm.nome,
        cnpj: cnpjDigits || undefined,
        managers: [
          {
            nome: supplierForm.managerNome,
            email: supplierForm.managerEmail,
            senha: supplierForm.managerSenha
          }
        ]
      })
    });

    if (!res.ok) {
      setMessage("Erro ao cadastrar fornecedor/gestor. Verifique os dados.");
      return;
    }

    setSupplierForm({
      nome: "",
      cnpj: "",
      managerNome: "",
      managerEmail: "",
      managerSenha: ""
    });

    setMessage("Fornecedor e gestor cadastrados com sucesso.");
    await loadSuppliers();
  }

  return (
    <main className="container container-wide">
      <header className="topbar card">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Gerencie regras globais e políticas de lembrete por fornecedor.</p>
        </div>
        <Link href="/dashboard" className="button-secondary">
          Voltar ao dashboard
        </Link>
      </header>

      <section className="card info-banner">
        <strong>Como funciona:</strong> o lembrete respeita recorrência em dias e quantidade máxima de tentativas por fornecedor.
        Ao atingir o limite, a nota muda para <strong>EXPIRADA</strong>.
      </section>

      <section className="settings-grid">
        <article className="card">
          <h2>Regra global da plataforma</h2>
          <p className="muted small">Usada como padrão para destinatário adicional e política geral de lembrete.</p>
          <form onSubmit={salvarRegraGlobal} className="form-grid">
            <label>
              Dias para lembrete
              <input
                type="number"
                min={0}
                max={60}
                value={rule.diasLembrete}
                onChange={(e) => setRule((p) => ({ ...p, diasLembrete: Number(e.target.value) }))}
              />
            </label>
            <label>
              E-mail adicional global
              <input
                type="email"
                placeholder="financeiro@empresa.com"
                value={rule.destinatarioAdicional ?? ""}
                onChange={(e) => setRule((p) => ({ ...p, destinatarioAdicional: e.target.value }))}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={rule.ativo}
                onChange={(e) => setRule((p) => ({ ...p, ativo: e.target.checked }))}
              />
              Ativar regra global
            </label>
            <button type="submit">Salvar regra global</button>
          </form>
        </article>

        <article className="card">
          <h2>Regra por fornecedor</h2>
          <p className="muted small">Escolha um fornecedor e ajuste recorrência, tentativas e e-mails de notificação.</p>

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
                <option key={s.supplierId} value={s.supplierId}>
                  {s.supplierName}
                </option>
              ))}
            </select>
          </label>

          <form onSubmit={salvarRegraFornecedor} className="form-grid">
            <label>
              Recorrência (dias)
              <input
                type="number"
                min={1}
                max={90}
                value={supplierConfig.recorrenciaDias}
                onChange={(e) => setSupplierConfig((p) => ({ ...p, recorrenciaDias: Number(e.target.value) }))}
              />
            </label>
            <label>
              Máximo de tentativas
              <input
                type="number"
                min={1}
                max={10}
                value={supplierConfig.maxTentativas}
                onChange={(e) => setSupplierConfig((p) => ({ ...p, maxTentativas: Number(e.target.value) }))}
              />
            </label>
            <label>
              E-mails extras (separados por vírgula)
              <input
                placeholder="compras@empresa.com, fiscal@empresa.com"
                value={supplierConfig.emailsExtras}
                onChange={(e) => setSupplierConfig((p) => ({ ...p, emailsExtras: e.target.value }))}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={supplierConfig.ativo}
                onChange={(e) => setSupplierConfig((p) => ({ ...p, ativo: e.target.checked }))}
              />
              Ativar regra do fornecedor
            </label>
            <button type="submit">Salvar regra do fornecedor</button>
          </form>
        </article>
      </section>

      {me?.manager.role === "ADMIN" && (
        <section className="card">
          <h2>Cadastro de fornecedor e gestor</h2>
          <p className="muted small">
            Hoje a configuração é feita via API em <code>POST /api/fornecedores</code>. Nesta tela você pode cadastrar
            direto pelo painel.
          </p>

          <form onSubmit={cadastrarFornecedor} className="form-grid">
            <label>
              Nome do fornecedor
              <input
                required
                minLength={2}
                placeholder="Fornecedor ABC"
                value={supplierForm.nome}
                onChange={(e) => setSupplierForm((p) => ({ ...p, nome: e.target.value }))}
              />
            </label>
            <label>
              CNPJ (opcional)
              <input
                placeholder="12345678000199"
                value={supplierForm.cnpj}
                onChange={(e) => setSupplierForm((p) => ({ ...p, cnpj: e.target.value }))}
              />
            </label>
            <label>
              Nome do gestor
              <input
                required
                minLength={2}
                placeholder="Maria Gestora"
                value={supplierForm.managerNome}
                onChange={(e) => setSupplierForm((p) => ({ ...p, managerNome: e.target.value }))}
              />
            </label>
            <label>
              E-mail do gestor
              <input
                required
                type="email"
                placeholder="gestor@empresa.com"
                value={supplierForm.managerEmail}
                onChange={(e) => setSupplierForm((p) => ({ ...p, managerEmail: e.target.value }))}
              />
            </label>
            <label>
              Senha inicial do gestor
              <input
                required
                minLength={6}
                type="password"
                placeholder="mínimo 6 caracteres"
                value={supplierForm.managerSenha}
                onChange={(e) => setSupplierForm((p) => ({ ...p, managerSenha: e.target.value }))}
              />
            </label>
            <button type="submit">Cadastrar fornecedor e gestor</button>
          </form>

          <h3>Fornecedores cadastrados</h3>
          <ul className="list">
            {suppliers.map((supplier) => (
              <li key={supplier.id}>
                <strong>{supplier.nome}</strong> {supplier.cnpj ? `(${supplier.cnpj})` : "(sem CNPJ)"} — gestores:{" "}
                {supplier.managers.map((manager) => `${manager.nome} <${manager.email}>`).join(", ")}
              </li>
            ))}
            {suppliers.length === 0 && <li>Nenhum fornecedor cadastrado ainda.</li>}
          </ul>
        </section>
      )}

      {message && <p className="message">{message}</p>}
    </main>
  );
}
