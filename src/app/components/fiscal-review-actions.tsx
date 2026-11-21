"use client";

import { useState, type FormEvent } from "react";
import { reviewReasonLabel } from "@/app/components/fiscal-document-labels";

export type FiscalVersion = { id: string; state: "CURRENT" | "CANDIDATE" | "ARCHIVED" | "REJECTED"; createdAt: string };
type Association = { id: string; name: string; cnpj: string | null };
type FiscalAction = { action: "ASSOCIATE"; companyId?: string; supplierId?: string }
  | { action: "ACCEPT_VERSION" | "REJECT_VERSION"; versionId: string }
  | { action: "REOPEN" };

type Props = {
  invoiceId: string;
  versions: FiscalVersion[];
  reasons: string[];
  companyCnpj?: string | null;
  supplierCnpj?: string | null;
  canReopen: boolean;
  processingLocked?: boolean;
  onChanged: () => Promise<void>;
};

export function saveFiscalXml(xml: string, name: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  const download = document.createElement("a");
  download.href = url;
  download.download = `${name}.xml`;
  document.body.appendChild(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function digits(value: string | null | undefined) { return value?.replace(/\D/g, "") ?? ""; }

function AssociationPicker({ kind, expectedCnpj, value, onChange }: {
  kind: "company" | "supplier";
  expectedCnpj?: string | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const expected = digits(expectedCnpj);
  const [search, setSearch] = useState(expected);
  const [items, setItems] = useState<Association[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const label = kind === "company" ? "Empresa" : "Fornecedor";

  async function find() {
    setBusy(true);
    setMessage("");
    setError(false);
    onChange("");
    const params = new URLSearchParams({ search: expected || search.trim(), pageSize: "25" });
    if (kind === "company") params.set("status", "ATIVAS");
    try {
      const response = await fetch(`/api/${kind === "company" ? "empresas" : "fornecedores"}?${params}`);
      if (!response.ok) throw new Error("Não foi possível consultar o cadastro.");
      const data = await response.json() as { items: { id: string; cnpj: string | null; displayName?: string; nome?: string }[] };
      const options = data.items.filter((item) => !expected || digits(item.cnpj) === expected)
        .map((item) => ({ id: item.id, cnpj: item.cnpj, name: item.displayName ?? item.nome ?? "Nome não informado" }));
      setItems(options);
      setMessage(options.length === 0 ? "Nenhum cadastro compatível. Confira o CNPJ ou regularize o cadastro." : options.length === 25 ? "Refine a busca para encontrar o cadastro exato." : "");
    } catch (error) {
      setError(true);
      setItems([]);
      setMessage(error instanceof Error ? error.message : "Falha ao consultar o cadastro.");
    } finally { setBusy(false); }
  }

  return <fieldset className="space-y-2 rounded border border-border p-3" aria-busy={busy}>
    <legend className="px-1 text-sm font-semibold">{label}</legend>
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1">{expected ? "CNPJ do XML" : "Buscar por nome ou CNPJ"}
        <input value={search} readOnly={Boolean(expected)} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <button type="button" className="btn-secondary" disabled={busy || (!expected && search.trim().length < 2)} onClick={() => void find()}>{busy ? "Buscando…" : "Buscar"}</button>
    </div>
    {message && <p className="text-xs text-muted" role={error ? "alert" : "status"}>{message}</p>}
    {items.length > 0 && <label>Vincular {label.toLowerCase()}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecione</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.cnpj ? ` · ${item.cnpj}` : ""}</option>)}
      </select>
    </label>}
  </fieldset>;
}

export function FiscalReviewActions({ invoiceId, versions, reasons, companyCnpj, supplierCnpj, canReopen, processingLocked = false, onChanged }: Props) {
  const [reason, setReason] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const canLinkCompany = reasons.includes("EMPRESA_PENDENTE");
  const canLinkSupplier = reasons.includes("FORNECEDOR_PENDENTE");
  const candidates = versions.filter((version) => version.state === "CANDIDATE");
  const selected = candidates.some((version) => version.id === versionId) ? versionId : "";
  const hasActions = canLinkCompany || canLinkSupplier || Boolean(candidates.length) || canReopen;
  const expectedVersionId = versions.find((version) => version.state === "CURRENT")?.id ?? null;
  const endpoint = `/api/notas/${encodeURIComponent(invoiceId)}/fiscal-review`;

  async function submit(action: FiscalAction) {
    if (busy || processingLocked || !reason.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...action, reason: reason.trim(), expectedVersionId }) });
      const data = await response.json().catch(() => null) as { error?: string; released?: boolean } | null;
      if (!response.ok) throw new Error(data?.error ?? "Não foi possível registrar a decisão.");
      setFeedback({ text: data?.released ? "Decisão registrada." : "Decisão registrada. Ainda há pendências neste documento.", error: false });
      setReason("");
      setVersionId("");
      if (action.action === "ASSOCIATE") { setCompanyId(""); setSupplierId(""); }
      await onChanged();
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : "Falha ao registrar a decisão.", error: true });
    } finally { setBusy(false); }
  }

  async function downloadVersion(id: string) {
    setDownloading(true);
    setFeedback(null);
    try {
      const response = await fetch(`${endpoint}?${new URLSearchParams({ versionId: id })}`);
      if (!response.ok) throw new Error("Não foi possível baixar o XML desta versão.");
      const data = await response.json() as { xml?: string };
      if (!data.xml) throw new Error("XML indisponível para esta versão.");
      saveFiscalXml(data.xml, `documento-${id}`);
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : "Falha ao baixar o XML.", error: true });
    } finally { setDownloading(false); }
  }

  if (!reasons.length && !hasActions && !feedback) return null;
  return <section id="revisao-fiscal" className="card space-y-4" aria-labelledby="fiscal-review-actions-title" aria-busy={busy}>
    <h3 id="fiscal-review-actions-title" className="section-title">Revisão fiscal</h3>
    {reasons.length > 0 && <ul className="flex flex-wrap gap-1" aria-label="Motivos da revisão">{reasons.map((item) => <li className="badge badge-warning" key={item}>{reviewReasonLabel(item)}</li>)}</ul>}
    {reasons.some((item) => item === "SITUACAO_FISCAL_PENDENTE" || item === "DADOS_FISCAIS_INCOMPLETOS" || item === "CTE_SUBSTITUIDO") && <p className="text-sm text-muted">O documento fica retido enquanto a situação fiscal ou a substituição impedir a aprovação. Confira o XML e os vínculos.</p>}
    {processingLocked && <p className="text-sm text-muted" role="status">O estado do processamento externo impede alterações neste documento.</p>}
    {hasActions && <form className="space-y-3" onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}>
      {canLinkCompany && <AssociationPicker kind="company" expectedCnpj={companyCnpj} value={companyId} onChange={setCompanyId} />}
      {canLinkSupplier && <AssociationPicker kind="supplier" expectedCnpj={supplierCnpj} value={supplierId} onChange={setSupplierId} />}
      {candidates.length > 0 && <>
        <label>XML candidato
          <select value={selected} onChange={(event) => setVersionId(event.target.value)}>
            <option value="">Selecione a versão</option>
            {candidates.map((version) => <option key={version.id} value={version.id}>Recebido em {new Date(version.createdAt).toLocaleString("pt-BR")} · {version.id.slice(-8)}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          {expectedVersionId && <button type="button" className="btn-secondary" disabled={downloading} onClick={() => void downloadVersion(expectedVersionId)}>Baixar XML vigente</button>}
          <button type="button" className="btn-secondary" disabled={!selected || downloading} onClick={() => void downloadVersion(selected)}>Baixar XML candidato</button>
        </div>
        {downloading && <p className="text-sm text-muted" role="status">Baixando XML…</p>}
        <p className="text-sm text-muted">Compare os arquivos antes de decidir. Aceitar o XML candidato inicia um novo ciclo quando o documento estiver elegível.</p>
      </>}
      {!processingLocked && <label>Justificativa da decisão<textarea required value={reason} rows={3} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label>}
      <div className="flex flex-wrap gap-2">
        {(canLinkCompany || canLinkSupplier) && <button type="button" className="btn-secondary" disabled={processingLocked || busy || !reason.trim() || !(canLinkCompany && companyId || canLinkSupplier && supplierId)} onClick={() => void submit({ action: "ASSOCIATE", ...(canLinkCompany && companyId ? { companyId } : {}), ...(canLinkSupplier && supplierId ? { supplierId } : {}) })}>Registrar vínculo</button>}
        {candidates.length > 0 && <>
          <button type="button" className="btn-primary" disabled={processingLocked || busy || !selected || !reason.trim()} onClick={() => void submit({ action: "ACCEPT_VERSION", versionId: selected })}>Aceitar XML candidato</button>
          <button type="button" className="btn-secondary" disabled={processingLocked || busy || !selected || !reason.trim()} onClick={() => void submit({ action: "REJECT_VERSION", versionId: selected })}>Rejeitar XML candidato</button>
        </>}
        {canReopen && <button type="button" className="btn-secondary" disabled={busy || !reason.trim()} onClick={() => void submit({ action: "REOPEN" })}>Reabrir aprovação</button>}
      </div>
    </form>}
    {busy && <p className="text-sm text-muted" role="status">Registrando decisão…</p>}
    {feedback && <p className={`text-sm ${feedback.error ? "text-danger" : "text-emerald-800"}`} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
  </section>;
}
