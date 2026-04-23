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

export default function ConfiguracoesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [rule, setRule] = useState({ diasLembrete: 2, ativo: true, destinatarioAdicional: "" });
  const [supplierConfig, setSupplierConfig] = useState({ ativo: true, recorrenciaDias: 2, maxTentativas: 2, emailsExtras: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
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

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage("A confirmação da nova senha não confere.");
      return;
    }

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      setMessage(payload?.error ?? "Erro ao alterar senha.");
      return;
    }

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setMessage("Senha alterada com sucesso.");
  }

  return (
    <main className="container container-wide">
      <header className="topbar card">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Gerencie regras globais e políticas de lembrete por fornecedor.</p>
        </div>
        <div className="actions-row">
          <Link href="/dashboard" className="button-secondary">
            Dashboard
          </Link>
          <Link href="/fornecedores" className="button-secondary">
            Fornecedores
          </Link>
        </div>
      </header>

      {me?.manager.role === "ADMIN" && (
        <section className="card">
          <h2>Cadastros administrativos</h2>
          <p className="muted small">Para melhorar a experiência, o cadastro de fornecedores e gestores fica em uma tela separada.</p>
          <Link href="/fornecedores" className="button-secondary">
            Ir para tela de cadastros
          </Link>
        </section>
      )}

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

      <section className="card">
        <h2>Alterar minha senha</h2>
        <p className="muted small">Atualize sua senha de acesso com segurança.</p>
        <form onSubmit={alterarSenha} className="form-grid">
          <label>
            Senha atual
            <input
              required
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
            />
          </label>
          <label>
            Nova senha
            <input
              required
              minLength={6}
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
            />
          </label>
          <label>
            Confirmar nova senha
            <input
              required
              minLength={6}
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            />
          </label>
          <button type="submit">Alterar senha</button>
        </form>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
