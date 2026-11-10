"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RetentionHint } from "@/components/retention-hint";
import type { RetentionDetails } from "@/lib/retention-details";
import { useParams, useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout } from "@/components/ui-kit";
import { getRatingLabel, QualificaHelpText, QualificationProcedureLink, RatingScaleHint } from "@/components/evaluation-guidance";
import { minimumPaymentDate, paymentDateAtSaoPauloNoon } from "@/lib/payment-date";
import { WorkflowApprovalFields, type ApprovalEvaluation, type ApprovalFieldPolicy } from "@/app/components/workflow-approval-fields";
import { NFSE_WORKFLOW_FIELDS } from "@/lib/workflow/field-catalog";

type Me = { manager: { nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR" } };
type EmailManager = { id: string; nome: string; email: string };
type RiskLevel = "BAIXO" | "MEDIO" | "ALTO";
type InvoiceStatus = "AGUARDANDO_APROVACAO" | "APROVADO" | "RECUSADO" | "PROCESSADO" | "EXPIRADA" | "DADOS_INCONSISTENTES";
type AuditEvent = { id: string; actionType: string; actionDescription?: string | null; actorName?: string | null; createdAt: string; reason?: string | null; comment?: string | null };

type Invoice = {
  id: string;
  numeroNota: string;
  codigoIdentificador: string;
  status: InvoiceStatus;
  statusProcessamento: "PENDENTE" | "PROCESSANDO" | "CONCLUIDO" | "ERRO";
  dataEmissao?: string | null;
  dataCompetencia?: string | null;
  valorServico?: number | null;
  valorParaAprovacao?: number | null;
  origemValorParaAprovacao?: string;
  valorLiquido?: number | null;
  valorBaseCalculo?: number | null;
  valorIssqn?: number | null;
  valorTotalRetido?: number | null;
  retentionDetails?: RetentionDetails;
  aliquota?: number | null;
  tomadorNome?: string | null;
  tomadorCnpj?: string | null;
  tomadorEmail?: string | null;
  prestadorCnpj?: string | null;
  localEmissao?: string | null;
  localPrestacao?: string | null;
  municipioIncidencia?: string | null;
  itemTributacaoNac?: string | null;
  itemTributacaoMun?: string | null;
  nbsDescricao?: string | null;
  descricaoServico?: string | null;
  responsavelValidacao?: string | null;
  dataValidacao?: string | null;
  observacaoValidacao?: string | null;
  codigoDelphi?: string | null;
  ordemCompra?: string | null;
  ocContrato?: string | null;
  numeroParcelas: number;
  dataLancamentoDelphi?: string | null;
  dataPagamento?: string | null;
  fornecedor: { nome: string; cnpj?: string | null; codigoExterno?: string | null; managerSuppliers?: Array<{ manager?: { nome?: string | null } | null }> };
};
type ApprovalInfo = {
  execution: { id: string; status: string; revision: number };
  currentStep: { id: string; name: string; managerId: string; requiresPurchaseOrder: boolean; fields: ApprovalFieldPolicy[] } | null;
  canComplete: boolean;
  canResume: boolean;
  tasks: Array<{ managerName: string; completedAt: string | null }>;
  invoice?: Record<string, unknown> & { serviceEvaluation?: { rating: number; qualifica: boolean | null; riskLevel: RiskLevel; comment?: string | null } | null };
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  AGUARDANDO_APROVACAO: "bg-amber-100 text-amber-800",
  APROVADO: "bg-emerald-100 text-emerald-800",
  RECUSADO: "bg-rose-100 text-rose-800",
  PROCESSADO: "bg-blue-100 text-blue-800",
  EXPIRADA: "bg-slate-100 text-slate-800",
  DADOS_INCONSISTENTES: "bg-orange-100 text-orange-800"
};

const APPROVED_STATUS_CHANGE_OPTIONS: Array<{ value: Exclude<InvoiceStatus, "APROVADO">; label: string; description: string }> = [
  { value: "AGUARDANDO_APROVACAO", label: "Cancelar aprovação", description: "Volta a nota para a fila de aprovação." },
  { value: "RECUSADO", label: "Recusar nota", description: "Marca a nota como recusada por erro identificado após aprovação." },
  { value: "DADOS_INCONSISTENTES", label: "Dados inconsistentes", description: "Sinaliza que a nota precisa de correção de dados." },
  { value: "PROCESSADO", label: "Marcar processada", description: "Confirma manualmente que a nota já foi processada." },
  { value: "EXPIRADA", label: "Expirada", description: "Indica que a aprovação não deve mais seguir o fluxo atual." }
];

const STATUS_OPTIONS: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "AGUARDANDO_APROVACAO", label: "Aguardando aprovação" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "RECUSADO", label: "Recusado" },
  { value: "PROCESSADO", label: "Processado" },
  { value: "EXPIRADA", label: "Expirada" },
  { value: "DADOS_INCONSISTENTES", label: "Dados inconsistentes" }
];

function getManagerNames(invoice: Invoice) {
  return invoice.fornecedor.managerSuppliers
    ?.map((link) => link.manager?.nome)
    .filter((name): name is string => Boolean(name))
    .join(", ") || null;
}

function getResponsibleName(invoice: Invoice) {
  return invoice.responsavelValidacao || getManagerNames(invoice) || "-";
}

function formatCurrency(value?: number | null) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value)) : "-";
}

function formatCompetence(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value))
    : "-";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "-";
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function DetailItem({ label, value, hint }: { label: string; value?: string | number | null; hint?: ReactNode }) {
  return <div className="rounded-md border border-border bg-surface-container-lowest p-4">
    <p className="text-xs font-bold uppercase text-muted">{label}</p>
    <p className="mt-1 text-sm font-semibold text-text">{value ?? "-"}</p>
    {hint}
  </div>;
}

function DetailTextItem({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-md border border-border bg-surface-container-lowest p-4">
    <p className="text-xs font-bold uppercase text-muted">{label}</p>
    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text">{value || "-"}</p>
  </div>;
}

export default function NotaDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [approvalInfo, setApprovalInfo] = useState<ApprovalInfo | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [evaluation, setEvaluation] = useState<ApprovalEvaluation>({ rating: null, qualifica: "", riskLevel: "", comment: "" });
  const [paymentDate, setPaymentDate] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [contractPurchaseOrder, setContractPurchaseOrder] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [isApproving, setIsApproving] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [stepApprovalValues, setStepApprovalValues] = useState<Record<string, string>>({});
  const [stepOperationKey, setStepOperationKey] = useState("");
  const [isLoadingStepApproval, setIsLoadingStepApproval] = useState(false);
  const [rejectionObservation, setRejectionObservation] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isResumingApproval, setIsResumingApproval] = useState(false);
  const [statusChange, setStatusChange] = useState<{ status: Exclude<InvoiceStatus, "APROVADO">; reason: string }>({ status: "AGUARDANDO_APROVACAO", reason: "" });
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [communication, setCommunication] = useState({ status: "AGUARDANDO_APROVACAO" as InvoiceStatus, recipients: "", reason: "", message: "" });
  const [emailManagers, setEmailManagers] = useState<EmailManager[]>([]);
  const [selectedManagerEmails, setSelectedManagerEmails] = useState<string[]>([]);
  const [communicationImage, setCommunicationImage] = useState<File | null>(null);
  const [isSendingCommunication, setIsSendingCommunication] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push(`/login?redirect=${encodeURIComponent(`/notas/${params.id}`)}`);
      return;
    }
    const meData = await meRes.json() as Me;
    setMe(meData);
    if (meData.manager.role === "ADMIN") {
      const managersRes = await fetch("/api/gestores?forStatusEmail=1");
      if (managersRes.ok) setEmailManagers(await managersRes.json() as EmailManager[]);
    }

    setApprovalInfo(null);
    let completedWorkflow = false;
    const workflowRes = await fetch(`/api/notas/${params.id}/workflow`);
    if (workflowRes.ok) {
      const workflowData = await workflowRes.json() as ApprovalInfo;
      completedWorkflow = workflowData.execution.status === "COMPLETED";
      setApprovalInfo(workflowData);
    } else if (workflowRes.status !== 404 && workflowRes.status !== 403) {
      setMessageType("error");
      setMessage("Não foi possível carregar os dados da aprovação.");
      setLoading(false);
      return;
    }

    const [invoiceRes, historyRes] = await Promise.all([
      fetch(`/api/notas/${params.id}`),
      fetch(`/api/notas/${params.id}/historico`)
    ]);

    if (invoiceRes.status === 401 || historyRes.status === 401) {
      router.push(`/login?redirect=${encodeURIComponent(`/notas/${params.id}`)}`);
      return;
    }

    if (invoiceRes.status === 403 || historyRes.status === 403) {
      setMessageType("error");
      setMessage("Você não tem acesso a esta nota fiscal.");
      setLoading(false);
      return;
    }

    if (!invoiceRes.ok) {
      setMessageType("error");
      setMessage("Nota fiscal não encontrada.");
      setLoading(false);
      return;
    }

    const loadedInvoice = await invoiceRes.json();
    setInvoice(loadedInvoice);
    if (historyRes.ok) setEvents(await historyRes.json());
    setPaymentDate("");
    setPurchaseOrder(loadedInvoice.ordemCompra ?? "");
    setContractPurchaseOrder(loadedInvoice.ocContrato ?? "");
    setInstallmentCount(String(loadedInvoice.numeroParcelas ?? 1));
    setCommunication((current) => ({
      ...current,
      status: completedWorkflow ? "PROCESSADO" : STATUS_OPTIONS.find((option) => option.value !== loadedInvoice.status)?.value ?? "AGUARDANDO_APROVACAO"
    }));
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!loading && invoice && window.location.hash === "#revogar-aprovacao") {
      document.getElementById("revogar-aprovacao")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [invoice, loading]);

  async function recusarNota() {
    if (!invoice) return;

    const observation = rejectionObservation.trim();
    if (!observation) {
      setMessageType("error");
      setMessage("Informe a observação para recusar a nota.");
      return;
    }

    setIsRejecting(true);
    setMessage("");

    try {
      const res = await fetch(`/api/notas/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RECUSADO",
          reason: observation,
          observacaoValidacao: observation
        })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setMessageType("error");
        setMessage(error?.error ?? "Não foi possível reprovar a nota.");
        return;
      }

      setMessageType("success");
      setMessage("Nota reprovada com sucesso.");
      setRejectionObservation("");
      await loadData();
    } catch {
      setMessageType("error");
      setMessage("Não foi possível comunicar com o servidor para reprovar a nota. Recarregue a página e tente novamente.");
    } finally {
      setIsRejecting(false);
    }
  }

  async function abrirModalAprovacao() {
    setApprovalError("");
    setEvaluation({ rating: null, qualifica: "", riskLevel: "", comment: "" });
    setStepApprovalValues({});
    setStepOperationKey("");
    setIsApprovalModalOpen(true);

    if (!hasOpenApproval) {
      setPaymentDate("");
      return;
    }

    setIsLoadingStepApproval(true);
    try {
      const response = await fetch(`/api/notas/${params.id}/workflow`);
      const context = await response.json() as ApprovalInfo;
      if (!response.ok || !context.canComplete || !context.currentStep || !context.invoice) {
        throw new Error("Esta aprovação não está mais atribuída a você. Atualize a página.");
      }
      const values: Record<string, string> = {};
      for (const policy of context.currentStep.fields) {
        if (policy.fieldKey === "serviceEvaluation") continue;
        const value = context.invoice[policy.fieldKey];
        values[policy.fieldKey] = policy.fieldKey === "dataPagamento" && value
          ? String(value).slice(0, 10)
          : value === null || value === undefined ? "" : String(value);
      }
      const savedEvaluation = context.invoice.serviceEvaluation;
      if (savedEvaluation) {
        setEvaluation({ rating: savedEvaluation.rating as ApprovalEvaluation["rating"], qualifica: savedEvaluation.qualifica === null ? "" : savedEvaluation.qualifica ? "SIM" : "NAO", riskLevel: savedEvaluation.riskLevel, comment: savedEvaluation.comment ?? "" });
      }
      setApprovalInfo(context);
      setStepApprovalValues(values);
      setStepOperationKey(window.crypto.randomUUID());
    } catch (error) {
      setIsApprovalModalOpen(false);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir esta aprovação.");
    } finally {
      setIsLoadingStepApproval(false);
    }
  }

  async function aprovarComAvaliacao() {
    if (hasOpenApproval) {
      await concluirAprovacaoDaEtapa();
      return;
    }
    if (!invoice || !evaluation.rating || !evaluation.qualifica || !evaluation.riskLevel) {
      setApprovalError("Preencha a pontuação, o campo Qualifica, a classificação de risco e a data de pagamento para aprovar a nota.");
      return;
    }

    if (!paymentDate) {
      setApprovalError("Informe a data de pagamento para aprovar a nota.");
      return;
    }

    if (paymentDate < minimumPaymentDate()) {
      setApprovalError(`A data de pagamento deve ser a partir de ${minimumPaymentDate().split("-").reverse().join("/")}.`);
      return;
    }

    if (!installmentCount || Number(installmentCount) < 1) {
      setApprovalError("Informe um número de parcelas maior ou igual a 1.");
      return;
    }

    setIsApproving(true);
    setApprovalError("");

    try {
      const res = await fetch(`/api/notas/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "APROVADO",
          dataPagamento: paymentDateAtSaoPauloNoon(paymentDate).toISOString(),
          ordemCompra: purchaseOrder.trim() || null,
          ocContrato: contractPurchaseOrder.trim() || null,
          numeroParcelas: Number(installmentCount),
          serviceEvaluation: {
            rating: evaluation.rating,
            comment: "Qualificação registrada",
            riskLevel: evaluation.riskLevel,
            qualifica: evaluation.qualifica
          }
        })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setApprovalError(error?.error ?? "Não foi possível aprovar a nota. Confira os campos obrigatórios e tente novamente.");
        return;
      }

      setMessageType("success");
      setMessage("Nota aprovada com sucesso.");
      setIsApprovalModalOpen(false);
      setApprovalError("");
      setEvaluation({ rating: null, qualifica: "", riskLevel: "", comment: "" });
      setPurchaseOrder("");
      setContractPurchaseOrder("");
      setInstallmentCount("1");
      await loadData();
    } catch {
      setApprovalError("Não foi possível comunicar com o servidor para aprovar a nota. Recarregue a página e tente novamente.");
    } finally {
      setIsApproving(false);
    }
  }

  async function concluirAprovacaoDaEtapa() {
    if (!approvalInfo?.canComplete || !approvalInfo.currentStep || !stepOperationKey) return;
    const policies = approvalInfo.currentStep.fields.filter((policy) => policy.mode === "EDITABLE");
    const getValue = (key: string) => stepApprovalValues[key] ?? "";
    for (const policy of policies) {
      if (policy.fieldKey === "serviceEvaluation") continue;
      if (policy.required && !getValue(policy.fieldKey).trim()) {
        const label = NFSE_WORKFLOW_FIELDS.find((field) => field.key === policy.fieldKey)?.label ?? policy.fieldKey;
        setApprovalError(`Preencha o campo obrigatório: ${label}.`);
        return;
      }
    }
    const evaluationPolicy = policies.find((policy) => policy.fieldKey === "serviceEvaluation");
    const evaluationComplete = Boolean(evaluation.rating && evaluation.riskLevel && evaluation.comment.trim().length >= 5);
    if (evaluationPolicy?.required && !evaluationComplete) {
      setApprovalError("Complete a avaliação do serviço com pontuação, risco e comentário de pelo menos 5 caracteres.");
      return;
    }
    if (approvalInfo.currentStep.requiresPurchaseOrder && !getValue("ordemCompra").trim() && !getValue("ocContrato").trim()) {
      setApprovalError("Informe a ordem de compra ou o contrato para continuar.");
      return;
    }
    const fields: Record<string, unknown> = {};
    for (const policy of policies) {
      if (policy.fieldKey === "serviceEvaluation") {
        if (evaluationComplete) fields.serviceEvaluation = { rating: evaluation.rating, comment: evaluation.comment.trim() || "Qualificação registrada", riskLevel: evaluation.riskLevel, ...(evaluation.qualifica ? { qualifica: evaluation.qualifica } : {}) };
        continue;
      }
      const value = getValue(policy.fieldKey).trim();
      if (policy.fieldKey === "dataPagamento") fields[policy.fieldKey] = value ? paymentDateAtSaoPauloNoon(value).toISOString() : null;
      else if (policy.fieldKey === "numeroParcelas") { if (value) fields[policy.fieldKey] = Number(value); }
      else fields[policy.fieldKey] = value || null;
    }
    setIsApproving(true);
    setApprovalError("");
    try {
      const response = await fetch(`/api/notas/${invoice?.id}/workflow/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: approvalInfo.execution.revision, idempotencyKey: stepOperationKey, fields }) });
      const result = await response.json();
      if (!response.ok) throw new Error(String(result.error || "Não foi possível concluir esta aprovação.").replace(/workflow/gi, "aprovação"));
      setMessageType("success");
      setMessage(result.completed ? "Aprovação concluída." : "Aprovação registrada. A nota seguirá para a próxima etapa.");
      setIsApprovalModalOpen(false);
      await loadData();
    } catch (error) {
      setApprovalError((error instanceof Error ? error.message : "Não foi possível comunicar com o servidor.").replace(/workflow/gi, "aprovação"));
    } finally {
      setIsApproving(false);
    }
  }

  async function alterarStatusAprovado() {
    if (!invoice) return;

    const reason = statusChange.reason.trim();
    if (!reason) {
      setMessageType("error");
      setMessage("Informe o motivo para alterar ou cancelar uma aprovação.");
      return;
    }

    setIsChangingStatus(true);
    setMessage("");

    try {
      const res = await fetch(`/api/notas/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusChange.status,
          reason
        })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setMessageType("error");
        setMessage(error?.error ?? "Não foi possível alterar o status da nota aprovada.");
        return;
      }

      setMessageType("success");
      setMessage(statusChange.status === "AGUARDANDO_APROVACAO" ? "Aprovação cancelada com sucesso." : "Status da nota aprovada alterado com sucesso.");
      setStatusChange({ status: "AGUARDANDO_APROVACAO", reason: "" });
      await loadData();
    } catch {
      setMessageType("error");
      setMessage("Não foi possível comunicar com o servidor para alterar o status da nota. Recarregue a página e tente novamente.");
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function sendStatusCommunication() {
    if (!invoice) return;
    setIsSendingCommunication(true);
    setMessage("");

    const formData = new FormData();
    formData.set("status", communication.status);
    formData.set("recipients", [...selectedManagerEmails, communication.recipients].filter(Boolean).join(";"));
    formData.set("reason", communication.reason);
    formData.set("message", communication.message);
    if (communicationImage) formData.set("image", communicationImage);

    try {
      const res = await fetch(`/api/notas/${invoice.id}/comunicacao`, { method: "POST", body: formData });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        setMessageType("error");
        setMessage(result?.error ?? "Não foi possível alterar o status e enviar o e-mail.");
        if (result?.statusChanged) await loadData();
        return;
      }

      setMessageType("success");
      setMessage(result?.email?.simulated ? "Status alterado. O e-mail foi simulado porque o Microsoft Graph não está configurado." : "Status alterado e e-mail enviado com sucesso.");
      setCommunication((current) => ({ ...current, recipients: "", reason: "", message: "" }));
      setSelectedManagerEmails([]);
      setCommunicationImage(null);
      await loadData();
    } catch {
      setMessageType("error");
      setMessage("Não foi possível comunicar com o servidor. Recarregue a página e tente novamente.");
    } finally {
      setIsSendingCommunication(false);
    }
  }

  async function resumeApproval() {
    if (!invoice || !approvalInfo?.canResume) return;
    setIsResumingApproval(true);
    setMessage("");
    try {
      const response = await fetch(`/api/notas/${invoice.id}/workflow/resume`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(String(result.error || "Não foi possível retomar a aprovação.").replace(/workflow/gi, "aprovação"));
      setMessageType("success");
      setMessage("A aprovação foi retomada.");
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage((error instanceof Error ? error.message : "Não foi possível retomar a aprovação.").replace(/workflow/gi, "aprovação"));
    } finally {
      setIsResumingApproval(false);
    }
  }

  const hasOpenApproval = approvalInfo?.execution.status === "ACTIVE" || approvalInfo?.execution.status === "BLOCKED";
  function isApprovalFieldVisible(fieldKey: string) {
    if (!hasOpenApproval) return true;
    return approvalInfo?.currentStep?.fields.some((field) => field.fieldKey === fieldKey && field.mode !== "HIDDEN") ?? false;
  }
  const canApprove = Boolean(!hasOpenApproval && invoice && me?.manager.role !== "FORNECEDOR" && ["AGUARDANDO_APROVACAO", "RECUSADO", "DADOS_INCONSISTENTES"].includes(invoice.status));
  const canApproveWorkflow = Boolean(approvalInfo?.execution.status === "ACTIVE" && approvalInfo.canComplete && me?.manager.role !== "FORNECEDOR");
  const canReject = Boolean(!hasOpenApproval && invoice && me?.manager.role !== "FORNECEDOR" && ["AGUARDANDO_APROVACAO", "DADOS_INCONSISTENTES"].includes(invoice.status));
  const canChangeApprovedStatus = Boolean(invoice && me?.manager.role !== "FORNECEDOR" && invoice.status === "APROVADO");
  const isCompletedWorkflow = approvalInfo?.execution.status === "COMPLETED";

  return <AppLayout>
    <MainHeader title="Detalhes da nota" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} />

    {message && <p className={`message ${messageType === "error" ? "feedback-error" : ""}`} role="status">{message}</p>}

    {loading && <section className="card mt-4"><p className="section-description">Carregando nota fiscal...</p></section>}

    {!loading && invoice && <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="card space-y-5">
        <div className="section-header">
          <div>
            <p className="text-sm font-semibold uppercase text-brand">Nota fiscal</p>
            <h2 className="section-title">NF {invoice.numeroNota}</h2>
            <p className="section-description">{invoice.fornecedor.nome} • código identificador {invoice.codigoIdentificador}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => router.push("/dashboard")}>Voltar ao dashboard</button>
            <span className={`badge ${STATUS_COLORS[invoice.status] ?? "badge-slate"}`}>{invoice.status.replaceAll("_", " ")}</span>
          </div>
        </div>

        {invoice.statusProcessamento === "ERRO" && <div className="rounded-md border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm" role="alert"><p className="font-bold">⚠ Erro no processamento — revise antes de reaprovar</p><p className="mt-1">{invoice.observacaoValidacao || "Consulte o histórico da nota para identificar a causa do erro antes de tentar uma nova aprovação."}</p></div>}

        <div className="grid gap-3 md:grid-cols-3">
          {isApprovalFieldVisible("valorParaAprovacao") && <DetailItem label={invoice.origemValorParaAprovacao === "VALIDACAO_ADMINISTRATIVA" ? "Valor para aprovação (validado pelo admin)" : "Valor de serviço"} value={formatCurrency(invoice.valorParaAprovacao ?? invoice.valorServico ?? invoice.valorLiquido ?? invoice.valorBaseCalculo)} />}
          {isApprovalFieldVisible("dataEmissao") && <DetailItem label="Emissão" value={formatDate(invoice.dataEmissao)} />}
          {isApprovalFieldVisible("dataCompetencia") && <DetailItem label="Competência" value={formatCompetence(invoice.dataCompetencia)} />}
          {isApprovalFieldVisible("prestadorNome") && <DetailItem label="Fornecedor" value={invoice.fornecedor.nome} />}
          {isApprovalFieldVisible("prestadorCnpj") && <DetailItem label="CNPJ fornecedor" value={invoice.fornecedor.cnpj ?? invoice.prestadorCnpj} />}
          <DetailItem label="Código externo" value={invoice.fornecedor.codigoExterno} />
          {isApprovalFieldVisible("tomadorNome") && <DetailItem label="Tomador" value={invoice.tomadorNome} />}
          {isApprovalFieldVisible("tomadorCnpj") && <DetailItem label="CNPJ tomador" value={invoice.tomadorCnpj} />}
          {isApprovalFieldVisible("tomadorEmail") && <DetailItem label="E-mail tomador" value={invoice.tomadorEmail} />}
        </div>

        {isApprovalFieldVisible("descricaoServico") && <DetailTextItem label="Descrição do serviço" value={invoice.descricaoServico} />}

        <div className="grid gap-3 md:grid-cols-2">
          {isApprovalFieldVisible("localEmissao") && <DetailItem label="Local de emissão" value={invoice.localEmissao} />}
          {isApprovalFieldVisible("localPrestacao") && <DetailItem label="Local de prestação" value={invoice.localPrestacao} />}
          {isApprovalFieldVisible("municipioIncidencia") && <DetailItem label="Município de incidência" value={invoice.municipioIncidencia} />}
          {isApprovalFieldVisible("nbsDescricao") && <DetailItem label="NBS / serviço" value={invoice.nbsDescricao} />}
          {isApprovalFieldVisible("itemTributacaoNac") && <DetailItem label="Item tributação nacional" value={invoice.itemTributacaoNac} />}
          {isApprovalFieldVisible("itemTributacaoMun") && <DetailItem label="Item tributação municipal" value={invoice.itemTributacaoMun} />}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {isApprovalFieldVisible("valorServico") && <DetailItem label="Valor do serviço" value={invoice.valorServico == null ? "-" : formatCurrency(invoice.valorServico)} />}
          <DetailItem label="Valor retido" value={formatCurrency(invoice.valorTotalRetido)} hint={<RetentionHint details={invoice.retentionDetails} />} />
          {isApprovalFieldVisible("valorLiquido") && <DetailItem label="Valor líquido" value={formatCurrency(invoice.valorLiquido)} />}
          {isApprovalFieldVisible("valorBaseCalculo") && <DetailItem label="Base cálculo" value={formatCurrency(invoice.valorBaseCalculo)} />}
          {isApprovalFieldVisible("valorIssqn") && <DetailItem label="ISSQN" value={formatCurrency(invoice.valorIssqn)} />}
          {isApprovalFieldVisible("aliquota") && <DetailItem label="Alíquota" value={invoice.aliquota === null || invoice.aliquota === undefined ? "-" : `${invoice.aliquota}%`} />}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <DetailItem label="Responsável validação" value={getResponsibleName(invoice)} />
          <DetailItem label="Data validação" value={formatDateTime(invoice.dataValidacao)} />
          {isApprovalFieldVisible("dataPagamento") && <DetailItem label="Data de vencimento" value={formatDate(invoice.dataPagamento)} />}
          {isApprovalFieldVisible("ordemCompra") && <DetailItem label="Ordem de Compra – Pontual" value={invoice.ordemCompra} />}
          <DetailItem label="Código Delphi" value={invoice.codigoDelphi} />
          {isApprovalFieldVisible("ocContrato") && <DetailItem label="Ordem de Compra – Contrato" value={invoice.ocContrato} />}
          {isApprovalFieldVisible("numeroParcelas") && <DetailItem label="Número de parcelas" value={invoice.numeroParcelas ?? 1} />}
          <DetailItem label="Lançamento Delphi" value={formatDateTime(invoice.dataLancamentoDelphi)} />
        </div>

        {isApprovalFieldVisible("observacaoValidacao") && invoice.observacaoValidacao && invoice.statusProcessamento !== "ERRO" && <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><strong>Observação de validação:</strong> {invoice.observacaoValidacao}</div>}
      </section>

      <aside className="space-y-4">

        {approvalInfo?.execution.status === "ACTIVE" && <section className="card space-y-3"><div><h3 className="section-title">Etapa de aprovação</h3><p className="section-description">{approvalInfo.currentStep?.name ?? "Aprovação em andamento"}</p></div><p className="text-sm text-slate-600">Responsável: {approvalInfo.tasks.find((task) => !task.completedAt)?.managerName ?? "Aguardando responsável"}</p>{canApproveWorkflow ? <button type="button" className="btn-primary w-full" onClick={abrirModalAprovacao}>Aprovar nota</button> : <p className="text-sm text-slate-600">Esta aprovação está atribuída a outro responsável.</p>}</section>}
        {approvalInfo?.execution.status === "BLOCKED" && <section className="card space-y-3 border-amber-200 bg-amber-50/50"><div><h3 className="section-title">Aprovação aguardando responsável</h3><p className="section-description">{approvalInfo.currentStep?.name ?? "Etapa pendente"}</p></div><p className="text-sm text-slate-700">A etapa será encaminhada quando houver um responsável ativo.</p>{approvalInfo.canResume && <button type="button" className="btn-secondary w-full" disabled={isResumingApproval} onClick={resumeApproval}>{isResumingApproval ? "Retomando…" : "Retomar aprovação"}</button>}</section>}

        {me?.manager.role === "ADMIN" && (!approvalInfo || isCompletedWorkflow) && <section className="card space-y-4 border-blue-200 bg-blue-50/40 ring-1 ring-blue-100">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Somente administradores</p>
            <h3 className="section-title">{isCompletedWorkflow ? "Finalizar e comunicar" : "Alterar status e comunicar"}</h3>
            <p className="section-description">{isCompletedWorkflow ? "A aprovação foi concluída. Marque a nota como processada e comunique os responsáveis por e-mail." : "Atualize o status e envie os dados da nota aos responsáveis. Os destinatários podem ser gestores ou outros contatos."}</p>
          </div>
          <label className="approval-field"><span className="approval-field-label">Novo status</span><select className="approval-field-control" value={communication.status} onChange={(event) => setCommunication((current) => ({ ...current, status: event.target.value as InvoiceStatus }))}>{STATUS_OPTIONS.filter((option) => option.value !== invoice.status && (!isCompletedWorkflow || option.value === "PROCESSADO")).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <div className="approval-field space-y-2">
            <label className="approval-field-label" htmlFor="status-email-managers">Selecionar gestores</label>
            <select id="status-email-managers" className="approval-field-control min-h-28" multiple value={selectedManagerEmails} onChange={(event) => setSelectedManagerEmails(Array.from(event.currentTarget.selectedOptions, (option) => option.value))} aria-describedby="status-email-managers-help">
              {emailManagers.map((manager) => <option key={manager.id} value={manager.email}>{manager.nome} — {manager.email}</option>)}
            </select>
            <span id="status-email-managers-help" className="text-xs text-slate-500">Use Ctrl (Windows) ou Command (Mac) para selecionar mais de um gestor.</span>
            <label className="approval-field-label" htmlFor="status-email-manual">Adicionar outros e-mails</label>
            <textarea id="status-email-manual" className="approval-field-control" value={communication.recipients} onChange={(event) => setCommunication((current) => ({ ...current, recipients: event.target.value }))} rows={3} placeholder="nome@empresa.com; outro@empresa.com" /><span className="text-xs text-slate-500">Separe vários e-mails por vírgula, ponto e vírgula ou linha.</span>
          </div>
          <label className="approval-field"><span className="approval-field-label">Motivo da alteração</span><textarea className="approval-field-control" value={communication.reason} onChange={(event) => setCommunication((current) => ({ ...current, reason: event.target.value }))} rows={3} maxLength={500} placeholder="Explique por que o status está sendo alterado" required /></label>
          <label className="approval-field"><span className="approval-field-label">Mensagem adicional <span className="text-xs font-normal text-slate-500">(opcional)</span></span><textarea className="approval-field-control" value={communication.message} onChange={(event) => setCommunication((current) => ({ ...current, message: event.target.value }))} rows={3} maxLength={2000} placeholder="Inclua orientações para os destinatários" /></label>
          <label className="approval-field"><span className="approval-field-label">Imagem no corpo do e-mail <span className="text-xs font-normal text-slate-500">(opcional, até 5 MB)</span></span><input className="approval-field-control" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => setCommunicationImage(event.target.files?.[0] ?? null)} />{communicationImage && <span className="text-xs font-semibold text-blue-700">Selecionada: {communicationImage.name}</span>}</label>
          <button type="button" className="btn-primary w-full" onClick={sendStatusCommunication} disabled={isSendingCommunication || (!communication.recipients.trim() && !selectedManagerEmails.length) || !communication.reason.trim()}>{isSendingCommunication ? "Alterando e enviando..." : isCompletedWorkflow ? "Marcar processada e enviar e-mail" : "Alterar status e enviar e-mail"}</button>
          <p className="text-xs text-slate-500">O e-mail incluirá número, código, fornecedor, valor, emissão, status anterior, novo status e motivo.</p>
        </section>}


        {canReject && <section className="card space-y-4 border-rose-200 bg-rose-50/50 ring-1 ring-rose-100">
          <div>
            <h3 className="section-title">Reprovar nota</h3>
            <p className="section-description">Recuse a nota diretamente, sem precisar aprová-la antes. A observação é obrigatória e será registrada no histórico.</p>
          </div>
          <label className="approval-field"><span className="approval-field-label">Observação obrigatória</span><textarea className="approval-field-control" value={rejectionObservation} onChange={(event) => setRejectionObservation(event.target.value)} rows={4} maxLength={500} placeholder="Descreva o motivo da recusa" required /></label>
          <button type="button" className="btn-primary w-full !bg-rose-700 hover:!bg-rose-800" onClick={recusarNota} disabled={isRejecting || !rejectionObservation.trim()}>{isRejecting ? "Registrando..." : "Reprovar nota"}</button>
        </section>}

        {canChangeApprovedStatus && <section id="revogar-aprovacao" className="card space-y-4 border-amber-200 bg-amber-50/50 scroll-mt-6 ring-1 ring-amber-100">
          <div>
            <h3 className="section-title">Revogar ou alterar aprovação</h3>
            <p className="section-description">Escolha “Cancelar aprovação” para voltar a nota para a fila, ou selecione outro status quando a aprovação anterior foi feita com erro. A alteração será registrada no histórico.</p>
          </div>
          <label>Novo status<select value={statusChange.status} onChange={(event) => setStatusChange((prev) => ({ ...prev, status: event.target.value as Exclude<InvoiceStatus, "APROVADO"> }))}>{APPROVED_STATUS_CHANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <p className="rounded-md border border-amber-200 bg-surface-container-lowest p-3 text-xs font-semibold text-amber-900">{APPROVED_STATUS_CHANGE_OPTIONS.find((option) => option.value === statusChange.status)?.description}</p>
          <label>Motivo da alteração<textarea value={statusChange.reason} onChange={(event) => setStatusChange((prev) => ({ ...prev, reason: event.target.value }))} rows={4} maxLength={500} placeholder="Descreva o erro ou motivo para cancelar/alterar a aprovação" /></label>
          <button type="button" className="btn-secondary w-full" onClick={alterarStatusAprovado} disabled={isChangingStatus || !statusChange.reason.trim()}>{isChangingStatus ? "Registrando..." : statusChange.status === "AGUARDANDO_APROVACAO" ? "Cancelar aprovação" : "Alterar status"}</button>
        </section>}

        {canApprove && <section className="card space-y-4">
          <div>
            <h3 className="section-title">Aprovar nota</h3>
            <p className="section-description">Abra a confirmação para registrar a avaliação e a data de pagamento obrigatórias.</p>
          </div>
          <button type="button" className="btn-primary w-full" onClick={abrirModalAprovacao}>Aprovar nota</button>
        </section>}

        <section className="card">
          <div className="section-header">
            <div><h3 className="section-title">Histórico</h3><p className="section-description">Linha do tempo da nota.</p></div>
            <span className="badge badge-slate">{events.length}</span>
          </div>
          <div className="space-y-3 border-l-2 border-border pl-4">{events.length ? events.map((event) => <article key={event.id} className="rounded-md border border-border bg-surface-container-low p-4"><p className="text-xs font-bold uppercase text-slate-500">{event.actionType}</p><p className="mt-1 text-sm font-semibold text-slate-900">{event.actionDescription || "Interação registrada"}</p><p className="text-xs text-slate-500">{event.actorName || "Sistema"} • {formatDateTime(event.createdAt)}</p>{event.reason && <p className="mt-2 text-xs font-semibold text-rose-700">Motivo: {event.reason}</p>}{event.comment && <p className="mt-1 text-xs text-slate-700">{event.comment}</p>}</article>) : <p className="section-description">Nenhum histórico registrado.</p>}</div>
        </section>
      </aside>
    </div>}

    {!loading && invoice && isApprovalModalOpen && <>
      <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={() => !isApproving && setIsApprovalModalOpen(false)} />
      <section role="dialog" aria-modal="true" aria-labelledby="detail-approval-modal-title" className="fixed inset-x-2 top-4 z-50 mx-auto max-h-[calc(100svh-2rem)] w-auto max-w-2xl overflow-y-auto rounded-md bg-surface-container-lowest p-4 shadow-elevated sm:inset-x-0 sm:top-8 sm:w-[92vw] sm:p-6">
        <div className="section-header"><div><h3 id="detail-approval-modal-title" className="section-title">Confirmar aprovação</h3><p className="section-description">Nota {invoice.numeroNota} • fornecedor {invoice.fornecedor.nome}</p></div><span className="badge badge-blue">Aprovação</span></div>
        {invoice.statusProcessamento === "ERRO" && <div className="mt-4 rounded-md border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm" role="alert"><p className="font-bold">⚠ Esta nota apresentou erro no processamento</p><p className="mt-1">Revise a causa antes de reaprovar: {invoice.observacaoValidacao || "consulte o histórico da nota para identificar o erro."}</p></div>}
        {approvalError && <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm font-medium text-rose-950" role="alert">{approvalError}</div>}
        {isLoadingStepApproval ? <p role="status" className="mt-4 rounded border border-slate-200 bg-slate-50 p-4 text-sm">Carregando os campos desta aprovação…</p> : hasOpenApproval && approvalInfo?.currentStep ? <div className="mt-5 space-y-3"><p className="text-sm text-slate-600">Preencha os campos editáveis desta aprovação.</p><WorkflowApprovalFields policies={approvalInfo.currentStep.fields} values={stepApprovalValues} onValueChange={(key, value) => setStepApprovalValues((current) => ({ ...current, [key]: value }))} evaluation={evaluation} onEvaluationChange={(update) => setEvaluation((current) => ({ ...current, ...update }))} />{approvalInfo.currentStep.requiresPurchaseOrder && <p className="text-xs text-slate-600">Informe uma ordem de compra ou de contrato.</p>}</div> : <div className="mt-5 space-y-4">
          <div role="group" aria-labelledby="detail-rating-label" aria-describedby="detail-rating-scale"><p id="detail-rating-label" className="mb-2 text-sm font-semibold text-slate-800">Pontuação do serviço</p><div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((rate) => { const description = getRatingLabel(rate); return <button key={rate} type="button" aria-label={`${rate} - ${description}`} title={`${rate} - ${description}`} className={`rounded-md border p-3 text-center text-sm font-bold transition ${evaluation.rating === rate ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm" : "border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"}`} onClick={() => setEvaluation((prev) => ({ ...prev, rating: rate as 1 | 2 | 3 | 4 | 5 }))}>{rate}</button>; })}</div><div className="mt-2"><RatingScaleHint id="detail-rating-scale" /></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="approval-field"><span className="approval-field-label">Qualifica?</span><select className="approval-field-control" aria-describedby="detail-qualifica-help" value={evaluation.qualifica} onChange={(event) => setEvaluation((prev) => ({ ...prev, qualifica: event.target.value as "SIM" | "NAO" }))}><option value="">Selecione</option><option value="SIM">Sim</option><option value="NAO">Não</option></select><QualificaHelpText id="detail-qualifica-help" /></label><label className="approval-field"><span className="approval-field-label">Classificação de risco</span><select className="approval-field-control" value={evaluation.riskLevel} onChange={(event) => setEvaluation((prev) => ({ ...prev, riskLevel: event.target.value as RiskLevel }))}><option value="">Selecione</option><option value="BAIXO">Baixo</option><option value="MEDIO">Médio</option><option value="ALTO">Alto</option></select></label></div>
          <label className="approval-field"><span className="approval-field-label">Data de vencimento</span><input className="approval-field-control" type="date" min={minimumPaymentDate()} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /><span className="text-xs text-muted">A partir de {minimumPaymentDate().split("-").reverse().join("/")}.</span></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="approval-field"><span className="approval-field-label">Ordem de Compra – Pontual <span className="text-xs font-normal text-slate-500">(opcional)</span></span><input className="approval-field-control" type="text" inputMode="numeric" pattern="[0-9]*" value={purchaseOrder} onChange={(event) => setPurchaseOrder(onlyDigits(event.target.value))} maxLength={120} placeholder="Somente números" /></label><label className="approval-field"><span className="approval-field-label">Ordem de Compra – Contrato <span className="text-xs font-normal text-slate-500">(opcional)</span></span><input className="approval-field-control" type="text" inputMode="numeric" pattern="[0-9]*" value={contractPurchaseOrder} onChange={(event) => setContractPurchaseOrder(onlyDigits(event.target.value))} maxLength={120} placeholder="Somente números" /></label></div>
          <label className="approval-field"><span className="approval-field-label">Número de parcelas</span><input className="approval-field-control" type="text" inputMode="numeric" pattern="[0-9]*" value={installmentCount} onChange={(event) => setInstallmentCount(onlyDigits(event.target.value))} onBlur={() => { if (!installmentCount || Number(installmentCount) < 1) setInstallmentCount("1"); }} required /></label>
          <QualificationProcedureLink />
        </div>}
        <div className="form-actions mt-5"><button type="button" className="btn-secondary" onClick={() => setIsApprovalModalOpen(false)} disabled={isApproving}>Cancelar</button><button type="button" className="btn-primary" onClick={aprovarComAvaliacao} disabled={isApproving || isLoadingStepApproval}>{isLoadingStepApproval ? "Carregando…" : isApproving ? "Aprovando..." : "Confirmar aprovação"}</button></div>
      </section>
    </>}

  </AppLayout>;
}
