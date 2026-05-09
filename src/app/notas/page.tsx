"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";

type Me = { manager: { nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR"; suppliers: Array<{ supplierId: string; supplierName: string }> } };

const INITIAL_FORM = {
  fornecedorId: "", numeroNota: "", codigoIdentificador: "", dataEmissao: "", dataCompetencia: "", valorServico: "", valorLiquido: "", tomadorNome: "", tomadorCnpj: ""
};

export default function NotasPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(INITIAL_FORM);
  const router = useRouter();

  const loadMe = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) return router.push("/login");
    setMe(await meRes.json());
  }, [router]);

  useEffect(() => { loadMe(); }, [loadMe]);

  async function lançarNotaFiscal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingInvoice(true);
    setMessage("");
    const res = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...invoiceForm,
      dataEmissao: invoiceForm.dataEmissao ? new Date(`${invoiceForm.dataEmissao}T00:00:00.000Z`).toISOString() : undefined,
      dataCompetencia: invoiceForm.dataCompetencia ? new Date(`${invoiceForm.dataCompetencia}T00:00:00.000Z`).toISOString() : undefined,
      valorServico: invoiceForm.valorServico ? Number(invoiceForm.valorServico) : undefined,
      valorLiquido: invoiceForm.valorLiquido ? Number(invoiceForm.valorLiquido) : undefined,
      tomadorNome: invoiceForm.tomadorNome || undefined,
      tomadorCnpj: invoiceForm.tomadorCnpj || undefined
    }) });
    setIsSubmittingInvoice(false);
    if (!res.ok) return setMessage("Não foi possível lançar a nota fiscal. Verifique os dados obrigatórios.");
    setInvoiceForm(INITIAL_FORM);
    setMessage("Nota fiscal lançada com sucesso.");
  }

  return <main className="container container-wide">
    <MainHeader title="Lançamento de notas" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} />

    <section className="card mt-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Nova nota fiscal</h2>
          <p className="mt-1 text-sm text-slate-600">Preencha os dados essenciais para enviar a nota ao fluxo de aprovação.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Fornecedor</span>
      </div>

      <form onSubmit={lançarNotaFiscal} className="grid-2">
        <label>Fornecedor *<select value={invoiceForm.fornecedorId} onChange={(e) => setInvoiceForm((p) => ({ ...p, fornecedorId: e.target.value }))} required><option value="">Selecione</option>{me?.manager.suppliers.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>)}</select></label>
        <label>Número da nota *<input value={invoiceForm.numeroNota} onChange={(e) => setInvoiceForm((p) => ({ ...p, numeroNota: e.target.value }))} required /></label>
        <label>Chave de acesso (44 dígitos) *<input value={invoiceForm.codigoIdentificador} onChange={(e) => setInvoiceForm((p) => ({ ...p, codigoIdentificador: e.target.value.replace(/\D/g, "").slice(0, 44) }))} minLength={44} maxLength={44} required /></label>
        <label>Data de emissão<input type="date" value={invoiceForm.dataEmissao} onChange={(e) => setInvoiceForm((p) => ({ ...p, dataEmissao: e.target.value }))} /></label>
        <label>Data de competência<input type="date" value={invoiceForm.dataCompetencia} onChange={(e) => setInvoiceForm((p) => ({ ...p, dataCompetencia: e.target.value }))} /></label>
        <label>Valor do serviço<input type="number" step="0.01" min="0" value={invoiceForm.valorServico} onChange={(e) => setInvoiceForm((p) => ({ ...p, valorServico: e.target.value }))} /></label>
        <label>Valor líquido<input type="number" step="0.01" min="0" value={invoiceForm.valorLiquido} onChange={(e) => setInvoiceForm((p) => ({ ...p, valorLiquido: e.target.value }))} /></label>
        <label>Tomador<input value={invoiceForm.tomadorNome} onChange={(e) => setInvoiceForm((p) => ({ ...p, tomadorNome: e.target.value }))} /></label>
        <label>CNPJ do tomador<input value={invoiceForm.tomadorCnpj} onChange={(e) => setInvoiceForm((p) => ({ ...p, tomadorCnpj: e.target.value.replace(/\D/g, "").slice(0, 14) }))} maxLength={14} /></label>
        <div className="flex items-end gap-2"><button className="btn-primary" type="submit" disabled={isSubmittingInvoice}>{isSubmittingInvoice ? "Enviando..." : "Enviar nota"}</button><button className="btn-secondary" type="button" onClick={() => setInvoiceForm(INITIAL_FORM)}>Limpar</button></div>
      </form>
    </section>
    {message && <p className="message">{message}</p>}
  </main>;
}
