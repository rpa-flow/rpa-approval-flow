"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";

type Me = { manager: { nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR"; suppliers: Array<{ supplierId: string; supplierName: string }> } };
type LaunchMode = "XML" | "MANUAL";

const INITIAL_FORM = {
  fornecedorId: "", numeroNota: "", codigoIdentificador: "", dataEmissao: "", dataCompetencia: "", valorServico: "", valorLiquido: "", tomadorNome: "", tomadorCnpj: "", tomadorEmail: "", nDfse: "", localEmissao: "", localPrestacao: "", municipioIncidencia: "", itemTributacaoNac: "", itemTributacaoMun: "", nbsDescricao: "", dataProcessamento: "", prestadorCnpj: "", prestadorNome: "", prestadorEmail: "", valorBaseCalculo: "", valorIssqn: "", valorTotalRetido: "", aliquota: ""
};

export default function NotasPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [mode, setMode] = useState<LaunchMode>("XML");
  const [xmlFile, setXmlFile] = useState<File | null>(null);
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

    const request = mode === "XML"
      ? (() => {
          const formData = new FormData();
          formData.append("fornecedorId", invoiceForm.fornecedorId);
          if (xmlFile) formData.append("xmlFile", xmlFile);
          return fetch("/api/notas", { method: "POST", body: formData });
        })()
      : fetch("/api/notas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...invoiceForm,
            dataEmissao: invoiceForm.dataEmissao ? new Date(`${invoiceForm.dataEmissao}T00:00:00.000Z`).toISOString() : undefined,
            dataCompetencia: invoiceForm.dataCompetencia ? new Date(`${invoiceForm.dataCompetencia}T00:00:00.000Z`).toISOString() : undefined,
            valorServico: invoiceForm.valorServico ? Number(invoiceForm.valorServico) : undefined,
            valorLiquido: invoiceForm.valorLiquido ? Number(invoiceForm.valorLiquido) : undefined,
            tomadorNome: invoiceForm.tomadorNome || undefined,
            tomadorCnpj: invoiceForm.tomadorCnpj || undefined,
            tomadorEmail: invoiceForm.tomadorEmail || undefined,
            nDfse: invoiceForm.nDfse || undefined,
            localEmissao: invoiceForm.localEmissao || undefined,
            localPrestacao: invoiceForm.localPrestacao || undefined,
            municipioIncidencia: invoiceForm.municipioIncidencia || undefined,
            itemTributacaoNac: invoiceForm.itemTributacaoNac || undefined,
            itemTributacaoMun: invoiceForm.itemTributacaoMun || undefined,
            nbsDescricao: invoiceForm.nbsDescricao || undefined,
            dataProcessamento: invoiceForm.dataProcessamento ? new Date(invoiceForm.dataProcessamento).toISOString() : undefined,
            prestadorCnpj: invoiceForm.prestadorCnpj || undefined,
            prestadorNome: invoiceForm.prestadorNome || undefined,
            prestadorEmail: invoiceForm.prestadorEmail || undefined,
            valorBaseCalculo: invoiceForm.valorBaseCalculo ? Number(invoiceForm.valorBaseCalculo) : undefined,
            valorIssqn: invoiceForm.valorIssqn ? Number(invoiceForm.valorIssqn) : undefined,
            valorTotalRetido: invoiceForm.valorTotalRetido ? Number(invoiceForm.valorTotalRetido) : undefined,
            aliquota: invoiceForm.aliquota ? Number(invoiceForm.aliquota) : undefined
          })
        });

    const res = await request;
    setIsSubmittingInvoice(false);
    if (!res.ok) return setMessage("Não foi possível lançar a nota fiscal. Verifique os dados obrigatórios.");
    setInvoiceForm(INITIAL_FORM);
    setXmlFile(null);
    setMessage("Nota fiscal lançada com sucesso.");
  }

  return <main className="container container-wide">
    <MainHeader title="Lançamento de notas" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} />

    <section className="card mt-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Nova nota fiscal</h2>
          <p className="mt-1 text-sm text-slate-600">Escolha como deseja lançar a nota: via arquivo XML (automático) ou digitando os dados manualmente.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Fornecedor</span>
      </div>

      <form onSubmit={lançarNotaFiscal} className="grid-2">
        <label>Modo de envio *
          <select value={mode} onChange={(e) => setMode(e.target.value as LaunchMode)}>
            <option value="XML">Arquivo XML (automático)</option>
            <option value="MANUAL">Digitar dados manualmente</option>
          </select>
        </label>

        <label>Fornecedor *<select value={invoiceForm.fornecedorId} onChange={(e) => setInvoiceForm((p) => ({ ...p, fornecedorId: e.target.value }))} required><option value="">Selecione</option>{me?.manager.suppliers.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>)}</select></label>

        {mode === "XML" ? (
          <label className="col-span-2">Arquivo XML da NFSe *
            <input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)} required />
          </label>
        ) : (
          <>
            <label>Número da nota *<input value={invoiceForm.numeroNota} onChange={(e) => setInvoiceForm((p) => ({ ...p, numeroNota: e.target.value }))} required /></label>
            <label>Chave de acesso (44 dígitos) *<input value={invoiceForm.codigoIdentificador} onChange={(e) => setInvoiceForm((p) => ({ ...p, codigoIdentificador: e.target.value.replace(/\D/g, "").slice(0, 44) }))} minLength={44} maxLength={44} required /></label>
            <label>Data de emissão<input type="date" value={invoiceForm.dataEmissao} onChange={(e) => setInvoiceForm((p) => ({ ...p, dataEmissao: e.target.value }))} /></label>
            <label>Data de competência<input type="date" value={invoiceForm.dataCompetencia} onChange={(e) => setInvoiceForm((p) => ({ ...p, dataCompetencia: e.target.value }))} /></label>
            <label>Valor do serviço<input type="number" step="0.01" min="0" value={invoiceForm.valorServico} onChange={(e) => setInvoiceForm((p) => ({ ...p, valorServico: e.target.value }))} /></label>
            <label>Valor líquido<input type="number" step="0.01" min="0" value={invoiceForm.valorLiquido} onChange={(e) => setInvoiceForm((p) => ({ ...p, valorLiquido: e.target.value }))} /></label>
            <label>Tomador<input value={invoiceForm.tomadorNome} onChange={(e) => setInvoiceForm((p) => ({ ...p, tomadorNome: e.target.value }))} /></label>
            <label>CNPJ do tomador<input value={invoiceForm.tomadorCnpj} onChange={(e) => setInvoiceForm((p) => ({ ...p, tomadorCnpj: e.target.value.replace(/\D/g, "").slice(0, 14) }))} maxLength={14} /></label>
            <label>Email do tomador<input type="email" value={invoiceForm.tomadorEmail} onChange={(e) => setInvoiceForm((p) => ({ ...p, tomadorEmail: e.target.value }))} /></label>
            <label>nDFSe<input value={invoiceForm.nDfse} onChange={(e) => setInvoiceForm((p) => ({ ...p, nDfse: e.target.value }))} /></label>
            <label>Local de emissão<input value={invoiceForm.localEmissao} onChange={(e) => setInvoiceForm((p) => ({ ...p, localEmissao: e.target.value }))} /></label>
            <label>Local de prestação<input value={invoiceForm.localPrestacao} onChange={(e) => setInvoiceForm((p) => ({ ...p, localPrestacao: e.target.value }))} /></label>
            <label>Município incidência<input value={invoiceForm.municipioIncidencia} onChange={(e) => setInvoiceForm((p) => ({ ...p, municipioIncidencia: e.target.value }))} /></label>
            <label>Tributação nacional<input value={invoiceForm.itemTributacaoNac} onChange={(e) => setInvoiceForm((p) => ({ ...p, itemTributacaoNac: e.target.value }))} /></label>
            <label>Tributação municipal<input value={invoiceForm.itemTributacaoMun} onChange={(e) => setInvoiceForm((p) => ({ ...p, itemTributacaoMun: e.target.value }))} /></label>
            <label>Descrição NBS<input value={invoiceForm.nbsDescricao} onChange={(e) => setInvoiceForm((p) => ({ ...p, nbsDescricao: e.target.value }))} /></label>
            <label>Data processamento<input type="datetime-local" value={invoiceForm.dataProcessamento} onChange={(e) => setInvoiceForm((p) => ({ ...p, dataProcessamento: e.target.value }))} /></label>
            <label>CNPJ prestador<input value={invoiceForm.prestadorCnpj} onChange={(e) => setInvoiceForm((p) => ({ ...p, prestadorCnpj: e.target.value.replace(/\D/g, "").slice(0, 14) }))} maxLength={14} /></label>
            <label>Nome prestador<input value={invoiceForm.prestadorNome} onChange={(e) => setInvoiceForm((p) => ({ ...p, prestadorNome: e.target.value }))} /></label>
            <label>Email prestador<input type="email" value={invoiceForm.prestadorEmail} onChange={(e) => setInvoiceForm((p) => ({ ...p, prestadorEmail: e.target.value }))} /></label>
            <label>Base de cálculo<input type="number" step="0.01" min="0" value={invoiceForm.valorBaseCalculo} onChange={(e) => setInvoiceForm((p) => ({ ...p, valorBaseCalculo: e.target.value }))} /></label>
            <label>Valor ISSQN<input type="number" step="0.01" min="0" value={invoiceForm.valorIssqn} onChange={(e) => setInvoiceForm((p) => ({ ...p, valorIssqn: e.target.value }))} /></label>
            <label>Valor total retido<input type="number" step="0.01" min="0" value={invoiceForm.valorTotalRetido} onChange={(e) => setInvoiceForm((p) => ({ ...p, valorTotalRetido: e.target.value }))} /></label>
            <label>Alíquota (%)<input type="number" step="0.01" min="0" value={invoiceForm.aliquota} onChange={(e) => setInvoiceForm((p) => ({ ...p, aliquota: e.target.value }))} /></label>
          </>
        )}

        <div className="flex items-end gap-2"><button className="btn-primary" type="submit" disabled={isSubmittingInvoice}>{isSubmittingInvoice ? "Enviando..." : "Enviar nota"}</button><button className="btn-secondary" type="button" onClick={() => { setInvoiceForm(INITIAL_FORM); setXmlFile(null); }}>Limpar</button></div>
      </form>
    </section>
    {message && <p className="message">{message}</p>}
  </main>;
}
