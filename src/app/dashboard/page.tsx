"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout, EmptyState, ErrorState, LoadingState, PageHeader, PaginationControls } from "@/components/ui-kit";
import { getRatingLabel, QualificaHelpText, QualificationProcedureLink } from "@/components/evaluation-guidance";
import { WorkflowApprovalFields, type ApprovalEvaluation, type ApprovalFieldPolicy } from "@/app/components/workflow-approval-fields";
import type { PaginationMetadata } from "@/lib/pagination";
import { minimumPaymentDate, paymentDateAtSaoPauloNoon } from "@/lib/payment-date";
import { NFSE_WORKFLOW_FIELDS } from "@/lib/workflow/field-catalog";

type Me = { manager: { id: string; nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR" } };
type IntegrationStatus = "AGUARDANDO" | "SUCESSO" | "FALHA";
type RiskLevel = "BAIXO" | "MEDIO" | "ALTO";
type StepApprovalContext = {
  invoice: Record<string, unknown> & { serviceEvaluation?: { rating: number; qualifica: boolean | null; riskLevel: RiskLevel; comment?: string | null } | null };
  execution: { revision: number };
  currentStep: { id: string; name: string; managerId: string; fields: ApprovalFieldPolicy[]; requiresPurchaseOrder: boolean };
  canComplete: boolean;
};
type AuditEvent = { id: string; actionType: string; actionDescription?: string | null; actorName?: string | null; createdAt: string; reason?: string | null; comment?: string | null };

type Invoice = {
  id: string;
  numeroNota: string;
  codigoIdentificador: string;
  status: string;
  statusProcessamento: "PENDENTE" | "PROCESSANDO" | "CONCLUIDO" | "ERRO";
  dataAtualizacao: string;
  dataEmissao?: string | null;
  dataCompetencia?: string | null;
  valorServico?: number | null;
  valorParaAprovacao?: number | null;
  tomadorNome?: string | null;
  tomadorCnpj?: string | null;
  fornecedor: { nome: string; cnpj?: string | null; codigoExterno?: string | null; managerSuppliers?: Array<{ manager?: { nome?: string | null } | null }> };
  empresa?: { cnpj?: string | null; nomeExibicao?: string | null };
  responsavelValidacao?: string | null;
  dataValidacao?: string | null;
  observacaoValidacao?: string | null;
  codigoDelphi?: string | null;
  statusIntegracaoDelphi?: IntegrationStatus | null;
  ordemCompra?: string | null;
  ocContrato?: string | null;
  numeroParcelas: number;
  dataLancamentoDelphi?: string | null;
  dataPagamento?: string | null;
  workflowExecution?: { status: string; tasks: Array<{ managerId: string; managerName: string; assignedAt: string; step: { name: string; fields: Array<{ fieldKey: string; mode: string }> } }> } | null;
};

function workflowFieldVisible(invoice: Invoice, key: string) {
  if (!invoice.workflowExecution || invoice.workflowExecution.status === "COMPLETED") return true;
  return invoice.workflowExecution.tasks[0]?.step.fields.some((field) => field.fieldKey === key && field.mode !== "HIDDEN") ?? false;
}

type SupplierOption = { id: string; nome: string };
type ManagerOption = { id: string; nome: string };
type NotesResponse = {
  items: Invoice[];
  pagination: PaginationMetadata;
  allNotesTotal: number;
  myApprovalsTotal: number;
  supplierOptions: SupplierOption[];
  managerOptions: ManagerOption[];
};

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_APROVACAO: "bg-amber-100 text-amber-800",
  APROVADO: "bg-emerald-100 text-emerald-800",
  RECUSADO: "bg-rose-100 text-rose-800",
  PROCESSADO: "bg-blue-100 text-blue-800",
  DADOS_INCONSISTENTES: "bg-orange-100 text-orange-800"
};


function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function getManagerNames(invoice: Invoice) {
  return invoice.fornecedor.managerSuppliers
    ?.map((link) => link.manager?.nome)
    .filter((name): name is string => Boolean(name))
    .join(", ") || null;
}

function getResponsibleName(invoice: Invoice) {
  return invoice.responsavelValidacao || getManagerNames(invoice) || "-";
}

function formatWaitingTime(value?: string) {
  if (!value) return null;
  const assignedAt = new Date(value);
  if (Number.isNaN(assignedAt.getTime())) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - assignedAt.getTime()) / 60_000));
  if (minutes < 60) return `há ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

function formatCnpj(value?: string | null) {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return value ?? "-";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCompany(invoice: Invoice) {
  const cnpj = invoice.empresa?.cnpj ?? invoice.tomadorCnpj;
  const name = invoice.empresa?.nomeExibicao ?? "Empresa não cadastrada";
  return `${name} - ${formatCnpj(cnpj)}`;
}

function formatRelativeUpdate(value: string) {
  const date = new Date(value);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) return "-";

  const diffMs = timestamp - Date.now();
  const absDiffMs = Math.abs(diffMs);
  const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

  if (absDiffMs < 60_000) return "agora";
  if (absDiffMs < 3_600_000) return formatter.format(Math.round(diffMs / 60_000), "minute");
  if (absDiffMs < 86_400_000) return formatter.format(Math.round(diffMs / 3_600_000), "hour");
  if (absDiffMs < 604_800_000) return formatter.format(Math.round(diffMs / 86_400_000), "day");

  return date.toLocaleDateString("pt-BR");
}

function formatInputDate(value: string) {
  if (!value) return "";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatCompetence(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function isInvalidDateRange(from: string, to: string) {
  return Boolean(from && to && from > to);
}

type DateRangeFilterProps = {
  legend: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

function DateRangeFilter({ legend, from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const invalid = isInvalidDateRange(from, to);
  const normalizedLegend = legend.toLowerCase();

  return (
    <fieldset className={`rounded-md border bg-surface-container-lowest p-3 ${invalid ? "border-rose-300" : "border-border"}`}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-600">
          De
          <input
            type="date"
            lang="pt-BR"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            aria-label={`${legend}: data inicial`}
            aria-invalid={invalid}
            className="mt-1 min-w-0"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Até
          <input
            type="date"
            lang="pt-BR"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            aria-label={`${legend}: data final`}
            aria-invalid={invalid}
            className="mt-1 min-w-0"
          />
        </label>
      </div>
      {invalid && <p className="mt-2 text-xs font-medium text-rose-700">A data inicial de {normalizedLegend} é maior que a final.</p>}
    </fieldset>
  );
}

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [notesLoadError, setNotesLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [myApprovalsOnly, setMyApprovalsOnly] = useState(false);
  const [allNotesTotal, setAllNotesTotal] = useState(0);
  const [myApprovalsTotal, setMyApprovalsTotal] = useState(0);
  const [supplierFilter, setSupplierFilter] = useState("TODOS");
  const [takerFilter, setTakerFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("TODOS");
  const [debouncedTakerFilter, setDebouncedTakerFilter] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [issueFrom, setIssueFrom] = useState("");
  const [issueTo, setIssueTo] = useState("");
  const [competenceFrom, setCompetenceFrom] = useState("");
  const [competenceTo, setCompetenceTo] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [menuState, setMenuState] = useState<{ invoice: Invoice; x: number; y: number } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ invoice: Invoice; events: AuditEvent[] } | null>(null);
  const [approveModal, setApproveModal] = useState<Invoice | null>(null);
  const [stepApproval, setStepApproval] = useState<StepApprovalContext | null>(null);
  const [stepApprovalLoading, setStepApprovalLoading] = useState(false);
  const [stepApprovalValues, setStepApprovalValues] = useState<Record<string, string>>({});
  const [stepOperationKey, setStepOperationKey] = useState("");
  const [rejectModal, setRejectModal] = useState<Invoice | null>(null);
  const [rejectionObservation, setRejectionObservation] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [evaluation, setEvaluation] = useState<ApprovalEvaluation>({ rating: null, qualifica: "", riskLevel: "", comment: "" });
  const [paymentDate, setPaymentDate] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [contractPurchaseOrder, setContractPurchaseOrder] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [isApproving, setIsApproving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const router = useRouter();

  const loadMe = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) return router.push("/login");
    setMe(await meRes.json());
  }, [router]);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });

    if (statusFilter !== "TODOS") params.set("status", statusFilter);
    if (myApprovalsOnly) params.set("myApprovals", "true");
    if (supplierFilter !== "TODOS") params.set("supplierId", supplierFilter);
    if (debouncedTakerFilter) params.set("taker", debouncedTakerFilter);
    if (responsibleFilter !== "TODOS") params.set("responsible", responsibleFilter);
    if (updatedFrom) params.set("updatedFrom", updatedFrom);
    if (updatedTo) params.set("updatedTo", updatedTo);
    if (issueFrom) params.set("issueFrom", issueFrom);
    if (issueTo) params.set("issueTo", issueTo);
    if (competenceFrom) params.set("competenceFrom", competenceFrom);
    if (competenceTo) params.set("competenceTo", competenceTo);

    setIsLoadingNotes(true);
    setNotesLoadError(false);
    try {
      const notesRes = await fetch(`/api/notas/minhas?${params.toString()}`);
      if (notesRes.status === 401) return router.push("/login");
      if (!notesRes.ok) {
        setNotesLoadError(true);
        setMessageType("error");
        setMessage("Não foi possível carregar as notas.");
        return;
      }

      const data = await notesRes.json() as NotesResponse;
      setInvoices(data.items);
      setPagination(data.pagination);
      setAllNotesTotal(data.allNotesTotal ?? data.pagination.total);
      setMyApprovalsTotal(data.myApprovalsTotal ?? 0);
      setSupplierOptions(data.supplierOptions);
      setManagerOptions(data.managerOptions);
    } catch {
      setNotesLoadError(true);
      setMessageType("error");
      setMessage("Não foi possível comunicar com o servidor. Recarregue a página e tente novamente.");
    } finally {
      setIsLoadingNotes(false);
    }
  }, [competenceFrom, competenceTo, debouncedTakerFilter, issueFrom, issueTo, myApprovalsOnly, page, pageSize, responsibleFilter, router, statusFilter, supplierFilter, updatedFrom, updatedTo]);

  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTakerFilter(takerFilter.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [takerFilter]);

  useEffect(() => {
    if (!menuState) return;

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuState(null);
    }

    window.addEventListener("keydown", closeMenuOnEscape);
    return () => window.removeEventListener("keydown", closeMenuOnEscape);
  }, [menuState]);

  async function atualizarNota(id: string, payload: Record<string, unknown>) {
    setMenuState(null);
    setMessage("");

    try {
      const res = await fetch(`/api/notas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setMessageType("error");
        setMessage(error?.error ?? "Não foi possível concluir a ação na nota.");
        return false;
      }

      setMessageType("success");
      setMessage("Ação registrada com sucesso.");
      await loadData();
      return true;
    } catch {
      setMessageType("error");
      setMessage("Não foi possível comunicar com o servidor. Recarregue a página e tente novamente.");
      return false;
    }
  }

  async function abrirModalAprovacao(invoice: Invoice) {
    setMenuState(null);
    setEvaluation({ rating: null, qualifica: "", riskLevel: "", comment: "" });
    setPaymentDate("");
    setPurchaseOrder(invoice.ordemCompra ?? "");
    setContractPurchaseOrder(invoice.ocContrato ?? "");
    setInstallmentCount(String(invoice.numeroParcelas ?? 1));
    setStepApproval(null);
    setStepApprovalValues({});
    setStepOperationKey("");
    const hasActiveStep = invoice.workflowExecution?.status === "ACTIVE";
    setStepApprovalLoading(hasActiveStep);
    setApproveModal(invoice);

    if (hasActiveStep) {
      try {
        const response = await fetch(`/api/notas/${invoice.id}/workflow`);
        const data = await response.json();
        if (!response.ok) throw new Error(String(data.error || "Não foi possível carregar esta aprovação.").replace(/workflow/gi, "aprovação"));
        if (!data.canComplete || !data.currentStep) throw new Error("Esta aprovação está atribuída a outro responsável ou não está mais disponível.");
        const context = data as StepApprovalContext;
        const initialValues: Record<string, string> = {};
        for (const policy of context.currentStep.fields) {
          if (policy.fieldKey === "serviceEvaluation") continue;
          const value = context.invoice[policy.fieldKey];
          initialValues[policy.fieldKey] = policy.fieldKey === "dataPagamento" && value
            ? String(value).slice(0, 10)
            : value === null || value === undefined ? "" : String(value);
        }
        const savedEvaluation = context.invoice.serviceEvaluation;
        if (savedEvaluation) {
          setEvaluation({ rating: savedEvaluation.rating as ApprovalEvaluation["rating"], qualifica: savedEvaluation.qualifica === null ? "" : savedEvaluation.qualifica ? "SIM" : "NAO", riskLevel: savedEvaluation.riskLevel, comment: savedEvaluation.comment ?? "" });
        }
        setStepApproval(context);
        setStepApprovalValues(initialValues);
        setStepOperationKey(window.crypto.randomUUID());
      } catch (error) {
        setApproveModal(null);
        setMessageType("error");
        setMessage((error instanceof Error ? error.message : "Não foi possível abrir esta aprovação.").replace(/workflow/gi, "aprovação"));
      } finally {
        setStepApprovalLoading(false);
      }
      return;
    }

    setStepApprovalLoading(false);
  }

  function fecharModalAprovacao() {
    setApproveModal(null);
    setStepApproval(null);
    setStepApprovalValues({});
    setStepOperationKey("");
    setEvaluation({ rating: null, qualifica: "", riskLevel: "", comment: "" });
  }

  function abrirModalRecusa(invoice: Invoice) {
    setRejectModal(invoice);
    setRejectionObservation("");
    setMenuState(null);
  }

  function handleMenuPointerDown(event: React.PointerEvent<HTMLButtonElement>, action: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  async function recusarNota() {
    if (!rejectModal) return;

    const observation = rejectionObservation.trim();
    if (!observation) {
      setMessageType("error");
      setMessage("Informe a observação para recusar a nota.");
      return;
    }

    setIsRejecting(true);
    const refused = await atualizarNota(rejectModal.id, {
      status: "RECUSADO",
      reason: observation,
      observacaoValidacao: observation
    });
    setIsRejecting(false);

    if (!refused) return;

    setRejectModal(null);
    setRejectionObservation("");
  }

  async function aprovarComAvaliacao() {
    if (stepApproval) {
      await concluirAprovacaoDaEtapa();
      return;
    }
    if (!approveModal || !evaluation.rating || !evaluation.qualifica || !evaluation.riskLevel) {
      setMessageType("error");
      setMessage("Preencha a pontuação, o campo Qualifica, a classificação de risco e a data de pagamento para aprovar a nota.");
      return;
    }

    if (!purchaseOrder.trim() && !contractPurchaseOrder.trim()) {
      setMessageType("error");
      setMessage("Informe a ordem de compra pontual ou a ordem de compra de contrato para aprovar a nota.");
      return;
    }

    if (!paymentDate) {
      setMessageType("error");
      setMessage("Informe a data de pagamento para aprovar a nota.");
      return;
    }

    if (paymentDate < minimumPaymentDate()) {
      setMessageType("error");
      setMessage(`A data de pagamento deve ser a partir de ${minimumPaymentDate().split("-").reverse().join("/")}.`);
      return;
    }

    if (!installmentCount || Number(installmentCount) < 1) {
      setMessageType("error");
      setMessage("Informe um número de parcelas maior ou igual a 1.");
      return;
    }

    setIsApproving(true);
    const approved = await atualizarNota(approveModal.id, {
      status: "APROVADO",
      dataPagamento: paymentDateAtSaoPauloNoon(paymentDate).toISOString(),
      ordemCompra: purchaseOrder.trim() || null,
      ocContrato: contractPurchaseOrder.trim() || null,
      numeroParcelas: Number(installmentCount),
      serviceEvaluation: {
        rating: evaluation.rating,
        comment: `Qualificação registrada`,
        riskLevel: evaluation.riskLevel,
        qualifica: evaluation.qualifica
      }
    });
    setIsApproving(false);

    if (!approved) return;

    setApproveModal(null);
    setEvaluation({ rating: null, qualifica: "", riskLevel: "", comment: "" });
    setPaymentDate("");
    setPurchaseOrder("");
    setContractPurchaseOrder("");
    setInstallmentCount("1");
  }

  async function concluirAprovacaoDaEtapa() {
    if (!approveModal || !stepApproval?.currentStep || !stepOperationKey) return;
    const policies = stepApproval.currentStep.fields.filter((policy) => policy.mode === "EDITABLE");
    const getValue = (key: string) => stepApprovalValues[key] ?? (stepApproval.invoice[key] == null ? "" : String(stepApproval.invoice[key]));
    for (const policy of policies) {
      if (policy.fieldKey === "serviceEvaluation") continue;
      if (policy.required && !getValue(policy.fieldKey).trim()) {
        const label = NFSE_WORKFLOW_FIELDS.find((field) => field.key === policy.fieldKey)?.label ?? policy.fieldKey;
        setMessageType("error");
        setMessage(`Preencha o campo obrigatório: ${label}.`);
        return;
      }
    }

    const evaluationPolicy = policies.find((policy) => policy.fieldKey === "serviceEvaluation");
    const hasEvaluationInput = Boolean(evaluation.rating || evaluation.qualifica || evaluation.riskLevel || evaluation.comment.trim());
    const evaluationComplete = Boolean(evaluation.rating && evaluation.riskLevel && evaluation.comment.trim().length >= 5);
    if (evaluationPolicy?.required && !evaluationComplete || hasEvaluationInput && !evaluationComplete) {
      setMessageType("error");
      setMessage("Complete a avaliação do serviço com pontuação, risco e comentário.");
      return;
    }
    if (stepApproval.currentStep.requiresPurchaseOrder && !getValue("ordemCompra").trim() && !getValue("ocContrato").trim()) {
      setMessageType("error");
      setMessage("Informe a ordem de compra ou o contrato para continuar.");
      return;
    }

    const fields: Record<string, unknown> = {};
    for (const policy of policies) {
      const key = policy.fieldKey;
      if (key === "serviceEvaluation") {
        if (evaluationComplete) fields.serviceEvaluation = { rating: evaluation.rating, comment: evaluation.comment.trim(), riskLevel: evaluation.riskLevel, ...(evaluation.qualifica ? { qualifica: evaluation.qualifica } : {}) };
        continue;
      }
      const value = getValue(key).trim();
      if (key === "dataPagamento") fields[key] = value ? paymentDateAtSaoPauloNoon(value).toISOString() : null;
      else if (key === "numeroParcelas") { if (value) fields[key] = Number(value); }
      else fields[key] = value || null;
    }

    setIsApproving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/notas/${approveModal.id}/workflow/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: stepApproval.execution.revision, idempotencyKey: stepOperationKey, fields }) });
      const result = await response.json();
      if (!response.ok) throw new Error(String(result.error || "Não foi possível concluir esta aprovação.").replace(/workflow/gi, "aprovação"));
      setMessageType("success");
      setMessage(result.completed ? "Aprovação concluída." : "Aprovação registrada. A nota seguirá para a próxima etapa.");
      await loadData();
      fecharModalAprovacao();
    } catch (error) {
      setMessageType("error");
      setMessage((error instanceof Error ? error.message : "Não foi possível comunicar com o servidor para aprovar a nota.").replace(/workflow/gi, "aprovação"));
    } finally {
      setIsApproving(false);
    }
  }

  async function verHistorico(invoice: Invoice) {
    setMenuState(null);
    try {
      const res = await fetch(`/api/notas/${invoice.id}/historico`);
      if (!res.ok) {
        setMessageType("error");
        setMessage("Não foi possível carregar o histórico da nota.");
        return;
      }
      setHistoryModal({ invoice, events: await res.json() });
    } catch {
      setMessageType("error");
      setMessage("Não foi possível comunicar com o servidor para carregar o histórico.");
    }
  }

  async function exportarNotas() {
    setIsExporting(true);
    setMessage("");
    const params = new URLSearchParams();
    if (statusFilter !== "TODOS") params.set("status", statusFilter);
    if (myApprovalsOnly) params.set("myApprovals", "true");
    if (supplierFilter !== "TODOS") params.set("supplierId", supplierFilter);
    if (debouncedTakerFilter) params.set("taker", debouncedTakerFilter);
    if (responsibleFilter !== "TODOS") params.set("responsible", responsibleFilter);
    if (updatedFrom) params.set("updatedFrom", updatedFrom);
    if (updatedTo) params.set("updatedTo", updatedTo);
    if (issueFrom) params.set("issueFrom", issueFrom);
    if (issueTo) params.set("issueTo", issueTo);
    if (competenceFrom) params.set("competenceFrom", competenceFrom);
    if (competenceTo) params.set("competenceTo", competenceTo);

    try {
      const response = await fetch(`/api/notas/minhas/export?${params.toString()}`);
      if (!response.ok) throw new Error("export_failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `notas-fiscais-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessageType("success");
      setMessage("Planilha XLSX gerada com sucesso.");
    } catch {
      setMessageType("error");
      setMessage("Não foi possível gerar a planilha XLSX. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  }

  const activeFilters = [
    statusFilter !== "TODOS" ? { key: "status", label: `Status: ${statusFilter === "LANCADAS" ? "Lançadas" : statusFilter.replaceAll("_", " ")}`, clear: () => setStatusFilter("TODOS") } : null,
    supplierFilter !== "TODOS" ? { key: "supplier", label: `Fornecedor: ${supplierOptions.find((supplier) => supplier.id === supplierFilter)?.nome ?? "Selecionado"}`, clear: () => setSupplierFilter("TODOS") } : null,
    responsibleFilter !== "TODOS" ? { key: "responsible", label: `Responsável: ${responsibleFilter}`, clear: () => setResponsibleFilter("TODOS") } : null,
    takerFilter.trim() ? { key: "taker", label: `Tomador: ${takerFilter.trim()}`, clear: () => setTakerFilter("") } : null,
    issueFrom || issueTo ? { key: "issue", label: `Emissão: ${issueFrom ? formatInputDate(issueFrom) : "início"} até ${issueTo ? formatInputDate(issueTo) : "fim"}`, clear: () => { setIssueFrom(""); setIssueTo(""); } } : null,
    competenceFrom || competenceTo ? { key: "competence", label: `Competência: ${competenceFrom ? formatInputDate(competenceFrom) : "início"} até ${competenceTo ? formatInputDate(competenceTo) : "fim"}`, clear: () => { setCompetenceFrom(""); setCompetenceTo(""); } } : null,
    updatedFrom || updatedTo ? { key: "updated", label: `Atualização: ${updatedFrom ? formatInputDate(updatedFrom) : "início"} até ${updatedTo ? formatInputDate(updatedTo) : "fim"}`, clear: () => { setUpdatedFrom(""); setUpdatedTo(""); } } : null
  ].filter((filter): filter is { key: string; label: string; clear: () => void } => Boolean(filter));

  const hasInvalidDateRange = isInvalidDateRange(issueFrom, issueTo) || isInvalidDateRange(competenceFrom, competenceTo) || isInvalidDateRange(updatedFrom, updatedTo);
  const activeAdvancedFiltersCount = [issueFrom || issueTo, competenceFrom || competenceTo, updatedFrom || updatedTo].filter(Boolean).length;

  function clearFilters() {
    setStatusFilter("TODOS");
    setSupplierFilter("TODOS");
    setResponsibleFilter("TODOS");
    setTakerFilter("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setIssueFrom("");
    setIssueTo("");
    setCompetenceFrom("");
    setCompetenceTo("");
    setMyApprovalsOnly(false);
    setPage(1);
  }

  function canApproveFromRow(invoice: Invoice) {
    if (!me || me.manager.role === "FORNECEDOR") return false;
    const currentTask = invoice.workflowExecution?.tasks[0];
    if (invoice.workflowExecution?.status === "ACTIVE") return currentTask?.managerId === me.manager.id;
    return (!invoice.workflowExecution || invoice.workflowExecution.status === "COMPLETED") && ["AGUARDANDO_APROVACAO", "RECUSADO", "DADOS_INCONSISTENTES"].includes(invoice.status);
  }

  return <AppLayout onClick={() => setMenuState(null)}>
    <MainHeader title="Central operacional de notas fiscais" subtitle={me ? `${me.manager.nome} (${me.manager.email})` : undefined} />

    <PageHeader
      eyebrow="Central operacional"
      title="Notas fiscais"
      description="Acompanhe pendências, consulte o histórico e conclua aprovações em uma única fila de trabalho."
    />

    {message && <p className={`message ${messageType === "error" ? "feedback-error" : ""}`} role={messageType === "error" ? "alert" : "status"}>{message}</p>}

    <section className="card mt-0 space-y-5" aria-label="Lista de notas fiscais" onClick={(e) => e.stopPropagation()}>
      <div className="section-header">
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          {me && me.manager.role !== "FORNECEDOR" && <div className="dashboard-queue-switch flex flex-wrap items-center gap-1" role="group" aria-label="Fila de notas">
            <button type="button" aria-pressed={!myApprovalsOnly} className={!myApprovalsOnly ? "btn-primary" : "btn-secondary"} onClick={() => { setMyApprovalsOnly(false); setPage(1); }}>
              Todas <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${!myApprovalsOnly ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>{allNotesTotal}</span>
            </button>
            <button type="button" aria-pressed={myApprovalsOnly} className={myApprovalsOnly ? "btn-primary" : "btn-secondary"} onClick={() => { setMyApprovalsOnly(true); setPage(1); }}>
              Minhas aprovações <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${myApprovalsOnly ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>{myApprovalsTotal}</span>
            </button>
          </div>}
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => void exportarNotas()} disabled={isExporting || hasInvalidDateRange} title={hasInvalidDateRange ? "Corrija os intervalos de data antes de exportar." : undefined}>{isExporting ? "Gerando XLSX..." : "Baixar XLSX"}</button>
          <span className="badge badge-slate">{isLoadingNotes ? "Carregando..." : `${pagination.total} nota(s)`}</span>
        </div>
        {myApprovalsOnly && <p className="text-xs text-muted">As aprovações mais antigas aparecem primeiro.</p>}
      </div>

      <section className="space-y-3 rounded-md border border-border bg-surface-container-low p-3 sm:p-4" aria-labelledby="invoice-filters-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="invoice-filters-heading" className="text-sm font-semibold text-text">Filtros de busca</h3>
          <p className="text-xs text-muted">Refine a fila sem perder a visão geral.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(8rem,0.8fr)_minmax(12rem,1.2fr)_minmax(12rem,1fr)_minmax(12rem,1.2fr)_auto] md:items-end">
          <label className="text-xs font-medium text-slate-600">
            Status
            <select className="mt-1" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="TODOS">Todos status</option><option value="LANCADAS">Lançadas</option><option value="AGUARDANDO_APROVACAO">Pendente</option><option value="APROVADO">Aprovada</option><option value="RECUSADO">Reprovada</option><option value="PROCESSADO">Processada</option><option value="DADOS_INCONSISTENTES">Dados inconsistentes</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Empresa/Fornecedor
            <select className="mt-1" value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}>
              <option value="TODOS">Todos fornecedores</option>{supplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Responsável
            <select className="mt-1" value={responsibleFilter} onChange={(e) => { setResponsibleFilter(e.target.value); setPage(1); }}>
              <option value="TODOS">Todos responsáveis</option>{managerOptions.map((manager) => <option key={manager.id} value={manager.nome}>{manager.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Tomador
            <input className="mt-1" value={takerFilter} onChange={(e) => { setTakerFilter(e.target.value); setPage(1); }} placeholder="Buscar tomador" />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
            <button
              type="button"
              className="btn-secondary relative whitespace-nowrap"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              aria-expanded={showAdvancedFilters}
              aria-controls="advanced-invoice-filters"
            >
              Mais filtros
              {activeAdvancedFiltersCount > 0 && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{activeAdvancedFiltersCount}</span>}
            </button>
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={clearFilters}>Limpar filtros</button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div id="advanced-invoice-filters" className="rounded-md border border-border bg-surface-container-lowest p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Filtros avançados</h3>
              <span className="text-xs text-slate-500">Períodos de datas da nota e do sistema</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <DateRangeFilter legend="Emissão" from={issueFrom} to={issueTo} onFromChange={(value) => { setIssueFrom(value); setPage(1); }} onToChange={(value) => { setIssueTo(value); setPage(1); }} />
              <DateRangeFilter legend="Competência" from={competenceFrom} to={competenceTo} onFromChange={(value) => { setCompetenceFrom(value); setPage(1); }} onToChange={(value) => { setCompetenceTo(value); setPage(1); }} />
              <DateRangeFilter legend="Atualização" from={updatedFrom} to={updatedTo} onFromChange={(value) => { setUpdatedFrom(value); setPage(1); }} onToChange={(value) => { setUpdatedTo(value); setPage(1); }} />
            </div>
          </div>
        )}

        {(activeFilters.length > 0 || hasInvalidDateRange) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="rounded-full border border-blue-200 !bg-blue-50 px-3 py-1 text-xs font-semibold !text-blue-800 hover:!bg-blue-100"
                onClick={() => { filter.clear(); setPage(1); }}
                aria-label={`Remover filtro ${filter.label}`}
              >
                {filter.label} ×
              </button>
            ))}
            {hasInvalidDateRange && <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Revise os intervalos de data</span>}
          </div>
        )}
      </section>

      <div className="table-shell" aria-busy={isLoadingNotes}>
        {isLoadingNotes && !invoices.length ? <div className="p-4 sm:p-5"><LoadingState rows={6} /></div> : notesLoadError && !invoices.length ? <div className="p-4 sm:p-5"><ErrorState title="Não foi possível carregar as notas" description="Verifique sua conexão e tente atualizar a lista." onRetry={() => void loadData()} /></div> : !invoices.length ? <div className="p-4 sm:p-5"><EmptyState title="Nenhuma nota encontrada" description={activeFilters.length ? "Ajuste ou limpe os filtros para consultar outras notas." : "As notas que exigirem acompanhamento aparecerão aqui."} action={activeFilters.length ? <button type="button" className="btn-secondary" onClick={clearFilters}>Limpar filtros</button> : undefined} /></div> : <>
        {notesLoadError && <div className="border-b border-border p-4"><ErrorState title="Exibindo resultados anteriores" description="Não foi possível atualizar a lista para os filtros atuais. Tente novamente antes de realizar uma nova análise." onRetry={() => void loadData()} /></div>}
        <p id="invoice-table-instructions" className="sr-only">A tabela pode ser rolada horizontalmente em telas estreitas. Selecione uma linha para expandir o resumo da nota.</p>
        <table className="min-w-[56rem] text-sm" aria-describedby="invoice-table-instructions">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-2 text-left">Fornecedor / NF</th>
              <th scope="col" className="px-2 py-2 text-left">Empresa</th>
              <th scope="col" className="px-2 py-2 text-right" style={{ minWidth: "7.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Valor para aprovação</th>
              <th scope="col" className="px-1.5 py-2 text-center" style={{ minWidth: "5.75rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Emissão</th>
              <th scope="col" className="px-1.5 py-2 text-center" style={{ minWidth: "5.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Competência</th>
              <th scope="col" className="px-1.5 py-2 text-center" style={{ minWidth: "8.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Status</th>
              <th scope="col" className="px-2 py-2 text-left">Responsável</th>
              <th scope="col" className="px-1.5 py-2 text-center" style={{ minWidth: "5.75rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Atualização</th>
              <th scope="col" className="px-1.5 py-2 text-center" style={{ minWidth: "5.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((invoice) => {
              const currentTask = invoice.workflowExecution?.status === "ACTIVE" ? invoice.workflowExecution.tasks[0] : undefined;
              const waitingTime = formatWaitingTime(currentTask?.assignedAt);
              const canApprove = canApproveFromRow(invoice);
              return <Fragment key={invoice.id}>
              <tr className="cursor-pointer focus-within:bg-surface-container-low" onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}>
                <td className="px-2 py-2 text-left"><div className="font-semibold text-slate-900">{invoice.fornecedor.nome}</div><div className="flex flex-wrap items-center gap-x-2"><span className="text-xs text-slate-500">NF {invoice.numeroNota}</span><button type="button" className="text-xs font-semibold text-brand underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" aria-expanded={expandedId === invoice.id} aria-controls={`invoice-summary-${invoice.id}`} onClick={(event) => { event.stopPropagation(); setExpandedId(expandedId === invoice.id ? null : invoice.id); }}>{expandedId === invoice.id ? "Ocultar resumo" : "Ver resumo"}</button></div>{waitingTime && <p className="mt-1 text-xs font-semibold text-amber-800" title={`Atribuída em ${new Date(currentTask!.assignedAt).toLocaleString("pt-BR")}`}>Aguardando há {waitingTime.replace(/^há /, "")}</p>}</td>
                <td className="px-2 py-2 text-left text-slate-700"><div className="font-medium text-slate-800">{workflowFieldVisible(invoice, "tomadorNome") ? invoice.empresa?.nomeExibicao ?? "Empresa não cadastrada" : "—"}</div><div className="whitespace-nowrap text-xs text-slate-500">{workflowFieldVisible(invoice, "tomadorCnpj") ? formatCnpj(invoice.empresa?.cnpj ?? invoice.tomadorCnpj) : "—"}</div></td>
                <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-800" style={{ minWidth: "7.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{workflowFieldVisible(invoice, "valorParaAprovacao") ? Number(invoice.valorParaAprovacao ?? invoice.valorServico ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</span></td>
                <td className="px-1.5 py-2 text-center text-slate-700" style={{ minWidth: "5.75rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{workflowFieldVisible(invoice, "dataEmissao") && invoice.dataEmissao ? new Date(invoice.dataEmissao).toLocaleDateString("pt-BR") : "-"}</span></td>
                <td className="px-1.5 py-2 text-center text-slate-700" style={{ minWidth: "5.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{workflowFieldVisible(invoice, "dataCompetencia") ? formatCompetence(invoice.dataCompetencia) : "-"}</span></td>
                <td className="px-1.5 py-2 text-center" style={{ minWidth: "8.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><div className="flex flex-col items-center gap-1"><span className={`badge ${STATUS_COLORS[invoice.status] ?? "badge-slate"}`}>{invoice.status.replaceAll("_", " ")}</span>{invoice.statusProcessamento === "ERRO" && <span className="badge bg-rose-700 text-white ring-2 ring-rose-200">⚠ Erro no processamento</span>}</div></td>
                <td className="px-2 py-2 text-left text-slate-700">{invoice.workflowExecution && invoice.workflowExecution.status !== "COMPLETED" ? invoice.workflowExecution.tasks[0]?.managerName ?? "Aguardando responsável" : getResponsibleName(invoice)}</td>
                <td className="px-1.5 py-2 text-center text-slate-600" style={{ minWidth: "5.75rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><span title={new Date(invoice.dataAtualizacao).toLocaleString("pt-BR")} style={{ whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}>{formatRelativeUpdate(invoice.dataAtualizacao)}</span></td>
                <td className="px-1.5 py-2 text-center" style={{ minWidth: canApprove ? "9.5rem" : "5.5rem", whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal" }}><div className="dashboard-row-actions flex items-center justify-center gap-1">{canApprove && <button type="button" className="btn-primary min-h-0 whitespace-nowrap px-2 py-1 text-sm" onClick={(event) => { event.stopPropagation(); void abrirModalAprovacao(invoice); }}>Aprovar</button>}<button type="button" aria-label={`Mais ações para nota ${invoice.numeroNota}`} className="btn-secondary min-h-0 whitespace-nowrap px-2 py-1 text-sm" onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuState({ invoice, x: Math.max(8, Math.min(r.right - 208, window.innerWidth - 248)), y: Math.min(r.bottom + 6, window.innerHeight - 260) }); }}>{canApprove ? "Mais" : "Ações"} ▾</button></div></td>
              </tr>
              {expandedId === invoice.id && (!invoice.workflowExecution || invoice.workflowExecution.status === "COMPLETED") && <tr><td colSpan={9} className="bg-slate-50 p-0"><div id={`invoice-summary-${invoice.id}`} className="grid gap-3 px-4 py-4 text-xs text-slate-700 sm:grid-cols-3">{invoice.statusProcessamento === "ERRO" && <div className="sm:col-span-3 rounded-md border-2 border-rose-300 bg-rose-50 p-3 text-rose-900" role="alert"><p className="font-bold">⚠ Erro no processamento — revise antes de reaprovar</p><p className="mt-1">{invoice.observacaoValidacao || "Consulte o histórico da nota para identificar a causa do erro antes de tentar uma nova aprovação."}</p></div>}<p><strong>Identificador XML:</strong> {invoice.codigoIdentificador}</p><p><strong>Empresa:</strong> <span className="whitespace-nowrap">{formatCompany(invoice)}</span></p><p><strong>CNPJ fornecedor:</strong> <span className="whitespace-nowrap">{invoice.fornecedor.cnpj ?? "-"}</span></p><p><strong>Código externo fornecedor:</strong> {invoice.fornecedor.codigoExterno ?? "-"}</p><p><strong>Ordem de Compra – Pontual:</strong> {invoice.ordemCompra ?? "-"}</p><p><strong>Ordem de Compra – Contrato:</strong> {invoice.ocContrato ?? "-"}</p><p><strong>Número de parcelas:</strong> {invoice.numeroParcelas ?? 1}</p><p><strong>Dt. Lanc. Delphi:</strong> {invoice.dataLancamentoDelphi ? new Date(invoice.dataLancamentoDelphi).toLocaleString("pt-BR") : "-"}</p><p><strong>Código Delphi:</strong> {invoice.codigoDelphi ?? "Pendente integração"}</p><p><strong>Integração:</strong> {invoice.statusIntegracaoDelphi ?? "AGUARDANDO"}</p><p className="sm:col-span-3"><strong>Observação da validação:</strong> {invoice.observacaoValidacao ?? "-"}</p></div></td></tr>}
            </Fragment>;
            })}
          </tbody>
        </table>
        <PaginationControls
          pagination={pagination}
          itemLabel="nota(s)"
          loading={isLoadingNotes}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
        />
        </>}
      </div>
    </section>

    {menuState && <button type="button" aria-label="Fechar menu de ações" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={() => setMenuState(null)} />}
    {menuState && <div className="fixed z-50 w-[calc(100vw-1rem)] max-w-60 rounded-md border border-border bg-surface-container-lowest p-2 shadow-elevated" style={{ left: menuState.x, top: menuState.y }} onClick={(e) => e.stopPropagation()}>
      {(!menuState.invoice.workflowExecution || menuState.invoice.workflowExecution.status === 'COMPLETED') && ['AGUARDANDO_APROVACAO', 'DADOS_INCONSISTENTES'].includes(menuState.invoice.status) && me?.manager.role !== 'FORNECEDOR' && <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-rose-700 hover:!bg-rose-50" onPointerDown={(event) => handleMenuPointerDown(event, () => abrirModalRecusa(menuState.invoice))}>⛔ Reprovar</button>}
      {menuState.invoice.status === 'APROVADO' && me?.manager.role !== 'FORNECEDOR' && <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-amber-700 hover:!bg-amber-50" onPointerDown={(event) => handleMenuPointerDown(event, () => { router.push(`/notas/${menuState.invoice.id}#revogar-aprovacao`); setMenuState(null); })}>↩️ Revogar aprovação</button>}
      <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-slate-700 hover:!bg-slate-50" onPointerDown={(event) => handleMenuPointerDown(event, () => { router.push(`/notas/${menuState.invoice.id}`); setMenuState(null); })}>🔎 Ver detalhes</button>
      <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-slate-700 hover:!bg-slate-50" onPointerDown={(event) => handleMenuPointerDown(event, () => { setExpandedId(menuState.invoice.id); setMenuState(null); })}>▾ Expandir resumo</button>
      <button type="button" className="w-full rounded !bg-white px-3 py-2 text-left text-sm font-semibold !text-slate-700 hover:!bg-slate-50" onPointerDown={(event) => handleMenuPointerDown(event, () => void verHistorico(menuState.invoice))}>🕒 Ver histórico</button>
    </div>}


    {rejectModal && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={() => setRejectModal(null)} />}
    {rejectModal && <section role="dialog" aria-modal="true" aria-labelledby="reject-modal-title" className="fixed inset-x-2 top-4 z-50 mx-auto w-auto max-w-lg rounded-md bg-surface-container-lowest p-4 shadow-elevated sm:inset-x-0 sm:top-24 sm:w-[92vw] sm:p-6" onClick={(e) => e.stopPropagation()}>
      <div className="section-header"><div><h3 id="reject-modal-title" className="section-title">Reprovar nota</h3><p className="section-description">Informe a observação obrigatória para recusar a nota {rejectModal.numeroNota}.</p></div><span className="badge bg-rose-100 text-rose-800">Recusa</span></div>
      <label className="approval-field mt-4"><span className="approval-field-label">Observação obrigatória</span><textarea className="approval-field-control" value={rejectionObservation} onChange={(event) => setRejectionObservation(event.target.value)} rows={5} maxLength={500} placeholder="Descreva o motivo da recusa" required /></label>
      <div className="form-actions mt-5"><button type="button" className="btn-secondary" onClick={() => setRejectModal(null)}>Cancelar</button><button type="button" className="btn-primary !bg-rose-700 hover:!bg-rose-800" onClick={recusarNota} disabled={isRejecting || !rejectionObservation.trim()}>{isRejecting ? "Registrando..." : "Confirmar reprovação"}</button></div>
    </section>}

    {approveModal && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={fecharModalAprovacao} />}
    {approveModal && <section role="dialog" aria-modal="true" aria-labelledby="approval-modal-title" className="fixed inset-x-2 top-4 z-50 mx-auto max-h-[calc(100svh-2rem)] w-auto max-w-2xl overflow-y-auto rounded-md bg-surface-container-lowest p-4 shadow-elevated sm:inset-x-0 sm:top-8 sm:w-[92vw] sm:p-6" onClick={(e) => e.stopPropagation()}>
      <div className="section-header"><div><h3 id="approval-modal-title" className="section-title">{approveModal.workflowExecution?.status === "ACTIVE" ? "Aprovar nota" : "Avaliação obrigatória do serviço"}</h3><p className="section-description">Nota {approveModal.numeroNota} • fornecedor {approveModal.fornecedor.nome}</p><p className="section-description">Código externo: {approveModal.fornecedor.codigoExterno ?? "Não informado"}</p>{stepApproval && <p className="section-description">Etapa: {stepApproval.currentStep.name}</p>}</div><span className="badge badge-blue">Aprovação</span></div>
      {approveModal.statusProcessamento === "ERRO" && <div className="mb-4 rounded-md border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm" role="alert"><p className="font-bold">⚠ Esta nota apresentou erro no processamento</p><p className="mt-1">Revise a causa antes de reaprovar: {approveModal.observacaoValidacao || "consulte o histórico da nota para identificar o erro."}</p></div>}
      {stepApprovalLoading ? <p role="status" className="mt-4 rounded border border-slate-200 bg-slate-50 p-4 text-sm">Carregando os campos desta aprovação…</p> : stepApproval ? <div className="mt-4 space-y-3"><p className="text-sm text-slate-600">Preencha os campos editáveis desta aprovação.</p><WorkflowApprovalFields policies={stepApproval.currentStep.fields} values={stepApprovalValues} onValueChange={(key, value) => setStepApprovalValues((current) => ({ ...current, [key]: value }))} evaluation={evaluation} onEvaluationChange={(update) => setEvaluation((current) => ({ ...current, ...update }))} />{stepApproval.currentStep.requiresPurchaseOrder && <p className="text-xs text-slate-600">Informe uma ordem de compra ou de contrato.</p>}</div> : <div className="space-y-4">
        <div role="group" aria-labelledby="dashboard-rating-label"><p id="dashboard-rating-label" className="mb-2 text-sm font-semibold text-slate-800">Pontuação do serviço</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-5">{[1, 2, 3, 4, 5].map((rate) => { const description = getRatingLabel(rate); return <button key={rate} type="button" aria-label={`${rate} - ${description}`} title={`${rate} - ${description}`} className={`rounded-md border p-3 text-left text-xs transition ${evaluation.rating === rate ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm" : "border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"}`} onClick={() => setEvaluation((prev) => ({ ...prev, rating: rate as 1 | 2 | 3 | 4 | 5 }))}><strong className="text-base">{rate}</strong><br />{description}</button>; })}</div></div>
        <div className="grid items-start gap-3 sm:grid-cols-3"><label className="approval-field"><span className="approval-field-label">Qualifica?</span><select className="approval-field-control" aria-describedby="dashboard-qualifica-help" value={evaluation.qualifica} onChange={(event) => setEvaluation((prev) => ({ ...prev, qualifica: event.target.value as "SIM" | "NAO" }))}><option value="">Selecione</option><option value="SIM">Sim</option><option value="NAO">Não</option></select><QualificaHelpText id="dashboard-qualifica-help" /></label><label className="approval-field"><span className="approval-field-label">Classificação de risco</span><select className="approval-field-control" value={evaluation.riskLevel} onChange={(event) => setEvaluation((prev) => ({ ...prev, riskLevel: event.target.value as RiskLevel }))}><option value="">Selecione</option><option value="BAIXO">Baixo</option><option value="MEDIO">Médio</option><option value="ALTO">Alto</option></select></label><label className="approval-field"><span className="approval-field-label">Data de pagamento</span><input className="approval-field-control" type="date" min={minimumPaymentDate()} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /><span className="text-xs text-muted">A partir de {minimumPaymentDate().split("-").reverse().join("/")}.</span></label></div>
        <div className="approval-field-row grid gap-3 sm:grid-cols-3">
          <label className="approval-field"><span className="approval-field-label">Ordem de Compra – Pontual <span className="text-xs font-normal text-slate-500">(obrigatória se não houver contrato)</span></span><input className="approval-field-control" type="text" inputMode="numeric" pattern="[0-9]*" value={purchaseOrder} onChange={(event) => setPurchaseOrder(onlyDigits(event.target.value))} maxLength={120} placeholder="Informe OC pontual ou contrato" required={!contractPurchaseOrder.trim()} /></label>
          <label className="approval-field"><span className="approval-field-label">Ordem de Compra – Contrato <span className="text-xs font-normal text-slate-500">(obrigatória se não houver pontual)</span></span><input className="approval-field-control" type="text" inputMode="numeric" pattern="[0-9]*" value={contractPurchaseOrder} onChange={(event) => setContractPurchaseOrder(onlyDigits(event.target.value))} maxLength={120} placeholder="Informe OC contrato ou pontual" required={!purchaseOrder.trim()} /></label>
          <label className="approval-field"><span className="approval-field-label">Número de parcelas</span><input className="approval-field-control" type="text" inputMode="numeric" pattern="[0-9]*" value={installmentCount} onChange={(event) => setInstallmentCount(onlyDigits(event.target.value))} onBlur={() => { if (!installmentCount || Number(installmentCount) < 1) setInstallmentCount("1"); }} required /></label>
        </div>
        <QualificationProcedureLink />
      </div>}
      <div className="form-actions mt-5"><button type="button" className="btn-secondary" onClick={fecharModalAprovacao} disabled={isApproving}>Cancelar</button><button type="button" className="btn-primary" onClick={aprovarComAvaliacao} disabled={isApproving || stepApprovalLoading}>{stepApprovalLoading ? "Carregando…" : isApproving ? "Aprovando..." : "Confirmar aprovação"}</button></div>
    </section>}

    {historyModal && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={() => setHistoryModal(null)} />}
    {historyModal && <section role="dialog" aria-modal="true" aria-labelledby="history-modal-title" className="fixed inset-x-2 top-4 z-50 mx-auto max-h-[calc(100svh-2rem)] w-auto max-w-3xl overflow-y-auto rounded-md bg-surface-container-lowest p-4 shadow-elevated sm:inset-x-0 sm:top-8 sm:w-[92vw] sm:p-6" onClick={(e) => e.stopPropagation()}>
      <div className="section-header"><div><h3 id="history-modal-title" className="section-title">Histórico da nota {historyModal.invoice.numeroNota}</h3><p className="section-description">Linha do tempo de interações e auditoria.</p></div><button type="button" className="btn-secondary" onClick={() => setHistoryModal(null)}>Fechar</button></div>
      <div className="space-y-3 border-l-2 border-border pl-4">{historyModal.events.map((event) => <article key={event.id} className="rounded-md border border-border bg-surface-container-low p-4"><p className="text-xs font-bold uppercase text-slate-500">{event.actionType}</p><p className="mt-1 text-sm font-semibold text-slate-900">{event.actionDescription || "Interação registrada"}</p><p className="text-xs text-slate-500">{event.actorName || "Sistema"} • {new Date(event.createdAt).toLocaleString("pt-BR")}</p>{event.reason && <p className="mt-2 text-xs font-semibold text-rose-700">Motivo: {event.reason}</p>}{event.comment && (workflowFieldVisible(historyModal.invoice, "serviceEvaluation") || (event.actionType !== "SERVICE_EVALUATION_RECORDED" && !event.comment.startsWith("Avaliação "))) && <p className="mt-1 text-xs text-slate-700">{event.comment}</p>}</article>)}</div>
    </section>}
  </AppLayout>;
}
