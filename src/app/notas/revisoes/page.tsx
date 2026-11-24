"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/ui-kit";
import { MainHeader } from "@/app/components/main-header";
import { DOCUMENT_TYPE_LABEL, FISCAL_STATUS_LABEL, formatFiscalDecimal, reviewReasonLabel } from "@/app/components/fiscal-document-labels";
import type { ProtocolStatus } from "@/lib/fiscal-document-parser";
import type { DocumentType } from "@/lib/workflow/field-catalog";

type Review = {
  id: string;
  invoiceId: string;
  status: "PENDENTE" | "LIBERADA" | "IGNORADA";
  motivos: string[];
  mesReferencia: string;
  valorSugerido: string | null;
  valorConfirmado: string | null;
  evidenciaValor: string | null;
  emissaoConfirmada: boolean;
  versao: number;
  erroEmail: string | null;
  justificativa: string | null;
  observacao: string | null;
  responsavelNome: string | null;
  responsavelEmail: string | null;
  revisadoEm: string | null;
  emailEnviadoEm: string | null;
  tentativasEmail: number;
  invoice: {
    numeroNota: string;
    documentType: DocumentType | null;
    referenceValue: string | null;
    fiscalStatus: ProtocolStatus | null;
    dataEmissao: string | null;
    tomadorNome: string | null;
    tomadorCnpj: string | null;
    valorServico: string | null;
    valorLiquido: string | null;
    xmlOriginal?: string | null;
    fornecedor: { nome: string; cnpj: string | null } | null;
    descricaoServico: string | null;
  };
};

function currency(value: string | null | undefined) {
  return formatFiscalDecimal(value, true) ?? "Não informado";
}

function issueDate(value: string | null) {
  if (!value) return "Não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data inválida" : date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatCnpj(value: string | null) {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function ReviewCard({ review, onUpdated, onReviewed }: {
  review: Review;
  onUpdated: () => void;
  onReviewed: (review: Review, status: "PENDENTE" | "LIBERADA" | "IGNORADA") => void;
}) {
  const [value, setValue] = useState(review.valorConfirmado ?? review.valorSugerido ?? "");
  const [confirmOldIssue, setConfirmOldIssue] = useState(review.emissaoConfirmada);
  const [justification, setJustification] = useState(review.justificativa ?? "");
  const [observation, setObservation] = useState(review.observacao ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmIgnore, setConfirmIgnore] = useState(false);
  const ignoreConfirmationRef = useRef<HTMLDivElement>(null);
  const hasZeroReason = review.motivos.includes("VALOR_ZERADO");
  const hasOldIssueReason = review.motivos.includes("EMISSAO_ANTERIOR");
  const isFiscal = review.invoice.documentType === "NFE" || review.invoice.documentType === "CTE";
  const documentLabel = review.invoice.documentType ? DOCUMENT_TYPE_LABEL[review.invoice.documentType] : "NF";
  const hasFiscalBlock = review.motivos.some((reason) => reason !== "VALOR_ZERADO" && reason !== "EMISSAO_ANTERIOR");
  const canValidate = !hasFiscalBlock && (hasZeroReason || hasOldIssueReason);
  const fiscalReviewUrl = `/notas/${encodeURIComponent(review.invoiceId)}#revisao-fiscal`;

  useEffect(() => {
    if (confirmIgnore) {
      ignoreConfirmationRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      ignoreConfirmationRef.current?.focus({ preventScroll: true });
    }
  }, [confirmIgnore]);

  async function submitDecision(event: React.FormEvent) {
    event.preventDefault();
    if (!canValidate) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/notas/${review.invoiceId}/revisao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versao: review.versao,
          ...(hasZeroReason ? { valorConfirmado: value } : {}),
          ...(hasOldIssueReason ? { confirmarEmissaoAnterior: confirmOldIssue } : {}),
          justificativa: justification,
          observacao: observation
        })
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Não foi possível salvar a revisão.");
        return;
      }
      if (result.status === "LIBERADA") {
        onReviewed(review, "LIBERADA");
      } else {
        setMessage("Validação registrada, mas ainda há motivos pendentes. A nota continua retida nesta fila.");
        onReviewed(review, "PENDENTE");
      }
    } catch {
      setMessage("Falha de comunicação ao salvar a revisão.");
    } finally {
      setBusy(false);
    }
  }

  async function resendEmail() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/notas/${review.invoiceId}/revisao/notificar`, { method: "POST" });
      const result = await response.json();
      setMessage(response.ok ? "Aviso enviado para o e-mail configurado." : result.error ?? "Falha ao enviar aviso.");
      onUpdated();
    } catch {
      setMessage("Falha de comunicação ao enviar o aviso.");
    } finally {
      setBusy(false);
    }
  }

  async function ignoreReview() {
    if (!justification.trim()) {
      setMessage("Informe uma justificativa antes de ignorar a nota.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/notas/${review.invoiceId}/revisao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versao: review.versao, ignorar: true, justificativa: justification, observacao: observation })
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Não foi possível ignorar a nota.");
        return;
      }
      onReviewed(review, "IGNORADA");
    } catch {
      setMessage("Falha de comunicação ao ignorar a nota.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="group border-b border-border last:border-b-0">
      <summary className="cursor-pointer list-none px-4 py-2 transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand sm:px-5">
        <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-text">{documentLabel} {review.invoice.numeroNota} · {review.invoice.fornecedor?.nome ?? "Fornecedor pendente"}</h2>
              <span className={`badge ${review.status === "IGNORADA" ? "badge-danger" : "badge-warning"}`}>{review.status === "IGNORADA" ? "Ignorada do dashboard" : "Pendente de validação"}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{review.invoice.documentType === "NFE" ? "Destinatário" : "Tomador"}: {review.invoice.tomadorNome ?? "Não informado"} · CNPJ {formatCnpj(review.invoice.tomadorCnpj)} · Emissão {issueDate(review.invoice.dataEmissao)}</p>
            <div className="mt-1 flex flex-wrap gap-1" aria-label="Motivos da revisão">
              {review.motivos.map((reason) => <span className="badge badge-blue" key={reason}>{reviewReasonLabel(reason)}</span>)}
            </div>
          </div>
          <span className="text-sm font-semibold text-brand">{review.status === "IGNORADA" ? "Ver decisão" : hasFiscalBlock ? "Ver pendências" : "Ver detalhes e validar"} <span className="inline-block transition-transform group-open:rotate-180" aria-hidden="true">⌄</span></span>
        </div>
      </summary>

      <div className="space-y-4 border-t border-border bg-surface-container-lowest px-4 py-4 sm:px-5">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="muted small">CNPJ do fornecedor</dt><dd className="font-mono">{formatCnpj(review.invoice.fornecedor?.cnpj ?? null)}</dd></div>
          <div><dt className="muted small">Mês de referência</dt><dd>{review.mesReferencia}</dd></div>
          {isFiscal ? <>
            <div><dt className="muted small">Valor de referência do XML</dt><dd>{currency(review.invoice.referenceValue)}</dd></div>
            <div><dt className="muted small">Situação fiscal</dt><dd>{review.invoice.fiscalStatus ? FISCAL_STATUS_LABEL[review.invoice.fiscalStatus] : "Não informada"}</dd></div>
          </> : <>
            <div><dt className="muted small">Valor do serviço no XML</dt><dd>{currency(review.invoice.valorServico)}</dd></div>
            <div><dt className="muted small">Valor líquido no XML</dt><dd>{currency(review.invoice.valorLiquido)}</dd></div>
            <div><dt className="muted small">Sugestão identificada na descrição</dt><dd>{currency(review.valorSugerido)}</dd></div>
          </>}
          <div><dt className="muted small">Aviso administrativo</dt><dd>{review.erroEmail ? <span className="feedback-error">{review.erroEmail}</span> : review.emailEnviadoEm ? `Enviado em ${new Date(review.emailEnviadoEm).toLocaleString("pt-BR")}` : "Ainda não enviado"}</dd></div>
        </dl>

        {!isFiscal && review.evidenciaValor && <p className="text-sm"><strong>Trecho identificado:</strong> {review.evidenciaValor}</p>}
        {!isFiscal && <details>
          <summary className="cursor-pointer text-sm font-semibold text-brand">Ver descrição completa da nota</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-surface-container-low p-3 text-sm">{review.invoice.descricaoServico ?? "Descrição indisponível."}</pre>
        </details>}

        {review.status === "IGNORADA" && <section className="rounded border border-rose-200 bg-rose-50 p-3" aria-label="Decisão de ignorar nota">
          <h3 className="font-semibold text-danger">Nota ignorada e oculta do dashboard</h3>
          <p className="mt-1 text-sm">{review.justificativa || "Nenhuma justificativa registrada."}</p>
          <p className="muted small mt-2">Decisão registrada por {review.responsavelNome ?? "ADMIN"}{review.revisadoEm ? ` em ${new Date(review.revisadoEm).toLocaleString("pt-BR")}` : ""}.</p>
        </section>}

        {review.status === "PENDENTE" && <form className="form-grid border-t border-border pt-4" onSubmit={submitDecision}>
          <div className="sm:col-span-2"><h3 className="text-sm font-semibold text-text">Resolver pendências da nota</h3><p className="muted small mt-1">{hasFiscalBlock ? "Consulte os vínculos, o XML e a situação do documento para resolver as pendências fiscais." : "A nota só será liberada quando todos os motivos de revisão estiverem resolvidos."}</p>
            {hasFiscalBlock && <Link href={fiscalReviewUrl} className="mt-2 inline-block text-sm font-semibold text-brand underline">Abrir revisão fiscal do documento</Link>}
          </div>
          {canValidate && <>
            {hasZeroReason && <label>Valor para aprovação (R$)<input required inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0,00" aria-describedby={`review-value-help-${review.id}`} /><span id={`review-value-help-${review.id}`} className="muted small">Informe ou ajuste o valor operacional. XML e valores fiscais originais serão preservados.</span></label>}
            {hasOldIssueReason && <label className="checkbox"><input type="checkbox" checked={confirmOldIssue} onChange={(event) => setConfirmOldIssue(event.target.checked)} />Confirmo que a emissão é anterior ao mês corrente e autorizo o prosseguimento para aprovação.</label>}
            <label>Justificativa{(hasOldIssueReason || (hasZeroReason && value !== review.valorSugerido)) && " (obrigatória para esta decisão)"}<textarea maxLength={1000} value={justification} onChange={(event) => setJustification(event.target.value)} rows={2} aria-describedby={`review-justification-help-${review.id}`} /><span id={`review-justification-help-${review.id}`} className="muted small">Obrigatória se você escolher ignorar a nota.</span></label>
            <label>Observação interna<textarea maxLength={1000} value={observation} onChange={(event) => setObservation(event.target.value)} rows={2} /></label>
          </>}
          <div className="form-actions sm:col-span-2">
            {canValidate && <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Registrar validação"}</button>}
            <button type="button" className="btn-secondary" disabled={busy} onClick={resendEmail}>{busy ? "Enviando..." : "Reenviar aviso"}</button>
            <button type="button" className="btn-danger" disabled={busy} onClick={() => { setConfirmIgnore(true); setMessage(""); }}>Ignorar e ocultar do dashboard</button>
          </div>
          {confirmIgnore && <div ref={ignoreConfirmationRef} tabIndex={-1} className="rounded border border-rose-200 bg-rose-50 p-3 sm:col-span-2" role="group" aria-label="Confirmar que deseja ignorar a nota">
            <p className="text-sm font-semibold text-danger">A nota será removida da fila pendente e não aparecerá no dashboard nem seguirá para aprovação do gestor.</p>
            <label className="mt-2 block">Justificativa para ignorar (obrigatória)
              <textarea maxLength={1000} value={justification} onChange={(event) => setJustification(event.target.value)} rows={2} />
            </label>
            {message && <p className="message mt-2" role="status">{message}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-danger" disabled={busy} onClick={() => void ignoreReview()}>{busy ? "Ignorando..." : "Confirmar e ignorar nota"}</button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirmIgnore(false)}>Cancelar</button>
            </div>
          </div>}
        </form>}
        {message && !confirmIgnore && <p className="message" role="status">{message}</p>}
        <p className="muted small">A liberação administrativa remove a nota desta fila e a exibe no dashboard para o fluxo de aprovação do gestor. Ela não aprova a nota.</p>
      </div>
    </details>
  );
}

export default function InvoiceReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [queueStatus, setQueueStatus] = useState<"PENDENTE" | "IGNORADA">("PENDENTE");
  const [supplierInput, setSupplierInput] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const router = useRouter();

  const loadReviews = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const params = new URLSearchParams({ status: queueStatus, fornecedor: supplierFilter });
      const response = await fetch(`/api/notas/revisoes?${params}`);
      if (id !== requestId.current) return;
      if (response.status === 401) { router.push("/login"); return; }
      if (response.status === 403) { setReviews([]); setForbidden(true); return; }
      if (!response.ok) throw new Error("Não foi possível carregar a fila de revisão.");
      const data = await response.json() as Review[];
      if (id === requestId.current) setReviews(data);
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Falha ao carregar a fila.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [queueStatus, supplierFilter, router]);

  const handleReviewed = useCallback((review: Review, status: "PENDENTE" | "LIBERADA" | "IGNORADA") => {
    const label = review.invoice.documentType ? DOCUMENT_TYPE_LABEL[review.invoice.documentType] : "NF";
    if (status === "LIBERADA") {
      setReviews((current) => current.filter((item) => item.id !== review.id));
      setNotice(`${label} ${review.invoice.numeroNota} liberado da revisão. O encaminhamento segue as regras de aprovação do tipo.`);
      return;
    }
    if (status === "IGNORADA") {
      setReviews((current) => current.filter((item) => item.id !== review.id));
      setNotice(`${label} ${review.invoice.numeroNota} movido para Ignoradas e retirado da fila de aprovação.`);
      return;
    }
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

  return (
    <AppLayout>
      <MainHeader title="Revisões administrativas" subtitle="Valide notas retidas antes de disponibilizá-las para aprovação dos gestores." />
      <section className="card border-l-4 border-brand" aria-labelledby="review-queue-guidance">
        <h2 id="review-queue-guidance" className="section-title">Como funciona esta fila</h2>
        <p className="section-description mt-2">Notas pendentes ficam fora do dashboard e da aprovação do gestor. Ao resolver todos os motivos e liberar, elas aparecem no dashboard para aprovação normal. Se uma nota não deve seguir no fluxo, use “Ignorar e ocultar do dashboard”; ela ficará registrada na aba Ignoradas.</p>
      </section>
      {notice && <p className="message" role="status">{notice}</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Estado das revisões administrativas">
        <button type="button" aria-pressed={queueStatus === "PENDENTE"} className={queueStatus === "PENDENTE" ? "btn-primary" : "btn-secondary"} onClick={() => { setQueueStatus("PENDENTE"); setNotice(""); setReviews([]); }}>Pendentes</button>
        <button type="button" aria-pressed={queueStatus === "IGNORADA"} className={queueStatus === "IGNORADA" ? "btn-primary" : "btn-secondary"} onClick={() => { setQueueStatus("IGNORADA"); setNotice(""); setReviews([]); }}>Ignoradas</button>
      </div>
      <form className="card flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setSupplierFilter(supplierInput.trim()); }}>
        <label className="min-w-0 flex-1">Fornecedor
          <input value={supplierInput} onChange={(event) => setSupplierInput(event.target.value)} placeholder="Nome ou CNPJ" maxLength={100} />
        </label>
        <button type="submit">Filtrar</button>
        <button type="button" className="btn-secondary" onClick={() => { setSupplierInput(""); setSupplierFilter(""); }}>Limpar</button>
      </form>
      {loading && <section className="card"><p role="status" className="state-loading">Carregando revisões…</p></section>}
      {forbidden && <section className="card"><h2 className="section-title">Acesso restrito</h2><p role="alert" className="state-error">A fila de revisão está disponível apenas para administradores.</p><Link href="/dashboard" className="font-semibold text-brand underline">Voltar ao dashboard</Link></section>}
      {error && <section className="card"><p className="state-error" role="alert">{error}</p><button type="button" onClick={() => void loadReviews()}>Tentar novamente</button></section>}
      {!loading && !error && !forbidden && reviews.length === 0 && <section className="card"><h2>{supplierFilter ? "Nenhuma nota encontrada para este fornecedor" : queueStatus === "PENDENTE" ? "Nenhuma nota pendente de revisão" : "Nenhuma nota ignorada"}</h2><p className="muted small">{supplierFilter ? "Ajuste ou limpe o filtro para consultar outros fornecedores." : queueStatus === "PENDENTE" ? "Notas liberadas saem desta fila e seguem as regras de aprovação do tipo." : "Notas ignoradas ficam registradas aqui e permanecem fora do dashboard."}</p></section>}
      {!loading && !error && !forbidden && reviews.length > 0 && <section className="card overflow-hidden !p-0" aria-label={queueStatus === "PENDENTE" ? "Notas pendentes de validação" : "Notas ignoradas"}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2 className="font-semibold text-text">{queueStatus === "PENDENTE" ? "Pendências para validar" : "Notas ignoradas"}</h2>
          <span className="badge badge-slate">{reviews.length === 100 ? "100 notas (limite da listagem)" : `${reviews.length} nota(s)`}</span>
        </div>
        {reviews.map((review) => <ReviewCard key={`${review.id}-${review.versao}`} review={review} onUpdated={() => void loadReviews()} onReviewed={handleReviewed} />)}
      </section>}
    </AppLayout>
  );
}
