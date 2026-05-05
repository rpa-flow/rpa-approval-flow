"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";

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

export default function NotasPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    fornecedorId: "",
    numeroNota: "",
    codigoIdentificador: "",
    dataEmissao: "",
    dataCompetencia: "",
    valorServico: "",
    valorLiquido: "",
    tomadorNome: "",
    tomadorCnpj: ""
  });
  const router = useRouter();

  const loadMe = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    setMe(await meRes.json());
  }, [router]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function lançarNotaFiscal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingInvoice(true);
    setMessage("");

    const payload = {
      fornecedorId: invoiceForm.fornecedorId,
      numeroNota: invoiceForm.numeroNota,
      codigoIdentificador: invoiceForm.codigoIdentificador,
      dataEmissao: invoiceForm.dataEmissao ? new Date(`${invoiceForm.dataEmissao}T00:00:00.000Z`).toISOString() : undefined,
      dataCompetencia: invoiceForm.dataCompetencia
        ? new Date(`${invoiceForm.dataCompetencia}T00:00:00.000Z`).toISOString()
        : undefined,
      valorServico: invoiceForm.valorServico ? Number(invoiceForm.valorServico) : undefined,
      valorLiquido: invoiceForm.valorLiquido ? Number(invoiceForm.valorLiquido) : undefined,
      tomadorNome: invoiceForm.tomadorNome || undefined,
      tomadorCnpj: invoiceForm.tomadorCnpj || undefined
    };

    const res = await fetch("/api/notas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setIsSubmittingInvoice(false);

    if (!res.ok) {
      setMessage("Não foi possível lançar a nota fiscal. Verifique os dados obrigatórios.");
      return;
    }

    setInvoiceForm({
      fornecedorId: "",
      numeroNota: "",
      codigoIdentificador: "",
      dataEmissao: "",
      dataCompetencia: "",
      valorServico: "",
      valorLiquido: "",
      tomadorNome: "",
      tomadorCnpj: ""
    });
    setMessage("Nota fiscal lançada com sucesso.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="container container-wide" style={{ maxWidth: 1100 }}>
      <AppHeader
        title="Lançamento de notas"
        subtitle={
          me
            ? `${me.manager.nome} (${me.manager.email}) — fornecedores: ${me.manager.suppliers.map((s) => s.supplierName).join(", ")}`
            : undefined
        }
        links={[
          { href: "/dashboard", label: "Dashboard", icon: "📊" },
          { href: "/notas", label: "Lançar nota", icon: "🧾" },
          { href: "/fornecedores", label: "Fornecedores", icon: "🏢" },
          { href: "/configuracoes", label: "Configurações", icon: "⚙️" },
          { href: "/perfil", label: "Perfil", icon: "👤" }
        ]}
      />

      <div className="actions-row">
        <button className="button-secondary" onClick={logout}>Sair</button>
      </div>

      <div className="actions-row">
        <button type="button" className="button-secondary" onClick={() => router.push("/dashboard")}>
          ← Voltar para listagem
        </button>
      </div>

      <section className="card" style={{ borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ marginBottom: 4 }}>Lançar nota fiscal</h2>
          <span className="chip active" style={{ cursor: "default" }}>Formulário do fornecedor</span>
        </div>
        <p className="muted small" style={{ marginTop: 2 }}>Campos com * são obrigatórios. Revise os dados antes de enviar para agilizar a aprovação.</p>
        <div style={{ height: 6 }} />
        <form onSubmit={lançarNotaFiscal} className="grid-2" style={{ marginTop: 16, gap: 14 }}>
          <label>
            Fornecedor*
            <select
              value={invoiceForm.fornecedorId}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, fornecedorId: event.target.value }))}
              required
            >
              <option value="">Selecione</option>
              {me?.manager.suppliers.map((supplier) => (
                <option key={supplier.supplierId} value={supplier.supplierId}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Número da nota*
            <input
              value={invoiceForm.numeroNota}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, numeroNota: event.target.value }))}
              required
            />
          </label>

          <label>
            Código identificador (44 dígitos)*
            <input
              value={invoiceForm.codigoIdentificador}
              onChange={(event) =>
                setInvoiceForm((prev) => ({
                  ...prev,
                  codigoIdentificador: event.target.value.replace(/\D/g, "").slice(0, 44)
                }))
              }
              minLength={44}
              maxLength={44}
              required
            />
          </label>

          <label>
            Data de emissão
            <input
              type="date"
              value={invoiceForm.dataEmissao}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, dataEmissao: event.target.value }))}
            />
          </label>

          <label>
            Data de competência
            <input
              type="date"
              value={invoiceForm.dataCompetencia}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, dataCompetencia: event.target.value }))}
            />
          </label>

          <label>
            Valor do serviço
            <input
              type="number"
              step="0.01"
              min="0"
              value={invoiceForm.valorServico}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, valorServico: event.target.value }))}
            />
          </label>

          <label>
            Valor líquido
            <input
              type="number"
              step="0.01"
              min="0"
              value={invoiceForm.valorLiquido}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, valorLiquido: event.target.value }))}
            />
          </label>

          <label>
            Tomador
            <input
              value={invoiceForm.tomadorNome}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, tomadorNome: event.target.value }))}
            />
          </label>

          <label>
            CNPJ do tomador
            <input
              value={invoiceForm.tomadorCnpj}
              onChange={(event) =>
                setInvoiceForm((prev) => ({ ...prev, tomadorCnpj: event.target.value.replace(/\D/g, "").slice(0, 14) }))
              }
              maxLength={14}
            />
          </label>

          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <button type="submit" disabled={isSubmittingInvoice} style={{ minHeight: 44, padding: "0 18px", fontWeight: 600 }}>
              {isSubmittingInvoice ? "Enviando..." : "Lançar nota"}
            </button>
            <button
              type="button"
              className="chip"
              onClick={() =>
                setInvoiceForm({
                  fornecedorId: "",
                  numeroNota: "",
                  codigoIdentificador: "",
                  dataEmissao: "",
                  dataCompetencia: "",
                  valorServico: "",
                  valorLiquido: "",
                  tomadorNome: "",
                  tomadorCnpj: ""
                })
              }
            >
              Limpar
            </button>
          </div>
        </form>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
