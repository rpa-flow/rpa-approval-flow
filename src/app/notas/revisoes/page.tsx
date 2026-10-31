"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/ui-kit";
import { MainHeader } from "@/app/components/main-header";

type Review = {
  id: string;
  invoiceId: string;
  status: "PENDENTE" | "LIBERADA";
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
  emailEnviadoEm: string | null;
  tentativasEmail: number;
  invoice: {
    numeroNota: string;
    dataEmissao: string | null;
    valorServico: string | null;
    valorLiquido: string | null;
    xmlOriginal?: string | null;
    fornecedor: { nome: string; cnpj: string | null };
    descricaoServico: string | null;
  };
};

function currency(value: string | null | undefined) {
  if (value === null || value === undefined) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function issueDate(value: string | null) {
  if (!value) return "Não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data inválida" : date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function ReviewCard({ review, onUpdated }: { review: Review; onUpdated: () => void }) {
  const [value, setValue] = useState(review.valorConfirmado ?? review.valorSugerido ?? "");
  const [confirmOldIssue, setConfirmOldIssue] = useState(review.emissaoConfirmada);
  const [justification, setJustification] = useState(review.justificativa ?? "");
  const [observation, setObservation] = useState(review.observacao ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const hasZeroReason = review.motivos.includes("VALOR_ZERADO");
  const hasOldIssueReason = review.motivos.includes("EMISSAO_ANTERIOR");

  async function submitDecision(event: React.FormEvent) {
    event.preventDefault();
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
      setMessage(result.status === "LIBERADA" ? "Revisão concluída. A nota foi liberada para o gestor." : "Decisão registrada; ainda há motivos pendentes.");
      onUpdated();
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

  return (
    <article className="card">
      <div className="section-header">
        <div>
          <h2>Nota {review.invoice.numeroNota} · {review.invoice.fornecedor.nome}</h2>
          <p className="muted small">CNPJ: {review.invoice.fornecedor.cnpj ?? "Não informado"} · Emitida em {issueDate(review.invoice.dataEmissao)} · Mês de referência {review.mesReferencia}</p>
        </div>
        <span className="badge badge-warning">Aguardando revisão</span>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Motivos da revisão">
        {review.motivos.map((reason) => <span className="badge badge-blue" key={reason}>{reason === "VALOR_ZERADO" ? "Valor zerado" : "Emissão anterior ao mês corrente"}</span>)}
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div><dt className="muted small">Valor do serviço no XML</dt><dd>{currency(review.invoice.valorServico)}</dd></div>
        <div><dt className="muted small">Valor líquido no XML</dt><dd>{currency(review.invoice.valorLiquido)}</dd></div>
        <div><dt className="muted small">Sugestão da descrição</dt><dd>{currency(review.valorSugerido)}</dd></div>
        <div><dt className="muted small">Aviso administrativo</dt><dd>{review.erroEmail ? <span className="feedback-error">{review.erroEmail}</span> : review.emailEnviadoEm ? `Enviado em ${new Date(review.emailEnviadoEm).toLocaleString("pt-BR")}` : "Ainda não enviado"}</dd></div>
      </dl>

      {review.evidenciaValor && <p className="mt-3"><strong>Trecho identificado:</strong> {review.evidenciaValor}</p>}
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold">Ver descrição da nota</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded border p-3 text-sm">{review.invoice.descricaoServico ?? "Descrição indisponível."}</pre>
      </details>

      <form className="form-grid mt-4" onSubmit={submitDecision}>
        {hasZeroReason && <label>Valor para aprovação (R$)<input required inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0,00" aria-describedby={`review-value-help-${review.id}`} /><span id={`review-value-help-${review.id}`} className="muted small">Informe ou ajuste o valor operacional para o gestor. O XML e os valores fiscais originais serão preservados.</span></label>}
        {hasOldIssueReason && <label className="checkbox"><input type="checkbox" checked={confirmOldIssue} onChange={(event) => setConfirmOldIssue(event.target.checked)} />Confirmo que a emissão é anterior ao mês corrente e autorizo o prosseguimento para aprovação.</label>}
        <label>Justificativa{(hasOldIssueReason || (hasZeroReason && value !== review.valorSugerido)) && " (obrigatória para esta decisão)"}<textarea maxLength={1000} value={justification} onChange={(event) => setJustification(event.target.value)} rows={2} /></label>
        <label>Observação interna<textarea maxLength={1000} value={observation} onChange={(event) => setObservation(event.target.value)} rows={2} /></label>
        <div className="form-actions">
          <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Registrar validação"}</button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={resendEmail}>Reenviar aviso</button>
        </div>
      </form>
      {message && <p className="message" role="status">{message}</p>}
      <p className="muted small">A liberação administrativa não aprova a nota. Depois da liberação, o gestor ainda precisa aprová-la.</p>
    </article>
  );
}

export default function InvoiceReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notas/revisoes");
      if (response.status === 401) { router.push("/login"); return; }
      if (response.status === 403) { router.push("/dashboard"); return; }
      if (!response.ok) throw new Error("Não foi possível carregar a fila de revisão.");
      setReviews(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar a fila.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

  return (
    <AppLayout>
      <MainHeader title="Revisões administrativas" subtitle="Valide notas retidas antes de disponibilizá-las para aprovação dos gestores." />
      {loading && <section className="card"><p className="state-loading">Carregando revisões...</p></section>}
      {error && <section className="card"><p className="state-error" role="alert">{error}</p><button type="button" onClick={() => void loadReviews()}>Tentar novamente</button></section>}
      {!loading && !error && reviews.length === 0 && <section className="card"><h2>Nenhuma nota aguardando revisão</h2><p className="muted small">Notas com valor zerado ou emissão anterior ao mês corrente aparecerão aqui.</p></section>}
      {!error && reviews.length > 0 && <div className="grid gap-4">{reviews.map((review) => <ReviewCard key={review.id} review={review} onUpdated={() => void loadReviews()} />)}</div>}
    </AppLayout>
  );
}
