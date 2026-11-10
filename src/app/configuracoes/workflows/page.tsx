"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/ui-kit";
import { MainHeader } from "@/app/components/main-header";
import { createNfseWorkflowExample } from "@/lib/workflow/settings-presets";

type Field = { key: string; label: string; editable: boolean };
type Policy = { key: string; mode: "HIDDEN" | "READ_ONLY" | "EDITABLE"; required: boolean };
type Step = { name: string; managerId: string; consultationScope: "ASSIGNED" | "ALL"; requiresPurchaseOrder: boolean; fields: Policy[] };
type Manager = { id: string; nome: string; ativo: boolean; role: string };
type Version = { id: string; number: number; status: string; revision: number; steps: Array<{ name: string; managerId: string; consultationScope: "ASSIGNED" | "ALL"; requiresPurchaseOrder: boolean; fields: Array<{ fieldKey: string; mode: Policy["mode"]; required: boolean }> }> };
type Workflow = { id: string; activeVersionId: string | null; versions: Version[] };
type PendingInvoice = { id: string; numeroNota: string; fornecedor: { nome: string }; workflowExecution?: unknown };
type Notification = { id: string; recipient: string; status: string; task: { step: { name: string }; execution: { invoice: { numeroNota: string } } }; attempts: Array<{ error: string | null }> };
type AuditEvent = { id: string; action: string; actorName: string; createdAt: string; versionId: string | null };
type Attempt = { id: string; status: string; error: string | null; createdAt: string };

export default function WorkflowSettingsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; tone: "success" | "error" | "info" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePages, setInvoicePages] = useState(1);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [attempts, setAttempts] = useState<{ notificationId: string; items: Attempt[]; page: number; totalPages: number } | null>(null);
  const [section, setSection] = useState<"configurar" | "notas" | "avisos">("configurar");
  const [versionsExpanded, setVersionsExpanded] = useState(false);
  const workflowChecks = [
    { label: "Etapas com nome e responsável", done: steps.length > 0 && steps.every((step) => Boolean(step.name.trim() && step.managerId)) },
    { label: "Avaliação obrigatória em uma etapa", done: steps.some((step) => step.fields.some((field) => field.key === "serviceEvaluation" && field.mode === "EDITABLE" && field.required)) },
    { label: "Data obrigatória e OC ou contrato editável no fluxo", done: steps.some((step) => step.fields.some((field) => field.key === "dataPagamento" && field.mode === "EDITABLE" && field.required)) && steps.some((step) => step.requiresPurchaseOrder && step.fields.some((field) => ["ordemCompra", "ocContrato"].includes(field.key) && field.mode === "EDITABLE")) },
    { label: "Data de pagamento editável na última etapa", done: Boolean(steps.at(-1)?.fields.some((field) => field.key === "dataPagamento" && field.mode === "EDITABLE")) }
  ];

  const refresh = useCallback(async (page: number) => {
    const [catalogResponse, managersResponse, workflowResponse, invoicesResponse, notificationsResponse] = await Promise.all([
      fetch("/api/workflows/field-catalog?documentType=NFSE"), fetch("/api/gestores"), fetch("/api/workflows?documentType=NFSE"), fetch(`/api/notas/minhas?status=AGUARDANDO_APROVACAO&pageSize=100&page=${page}`), fetch("/api/workflows/notifications")
    ]);
    if (!catalogResponse.ok || !managersResponse.ok || !workflowResponse.ok || !invoicesResponse.ok || !notificationsResponse.ok) throw new Error("Não foi possível carregar a configuração. Verifique seu acesso de administrador.");
    const catalog = await catalogResponse.json();
    const users: Manager[] = await managersResponse.json();
    const data = await workflowResponse.json();
    const invoices = await invoicesResponse.json();
    const notificationData = await notificationsResponse.json();
    setFields(catalog.fields);
    setManagers(users.filter((user) => user.ativo && (user.role === "ADMIN" || user.role === "GESTOR")));
    setWorkflow(data.workflow);
    setNotifications(notificationData.items);
    setPendingInvoices((invoices.items as PendingInvoice[]).filter((invoice) => !invoice.workflowExecution));
    setInvoicePage(invoices.pagination.page);
    setInvoicePages(invoices.pagination.totalPages);
  }, []);

  const showFeedback = useCallback((text: string, tone: "success" | "error" | "info" = "success") => {
    setFeedback({ text, tone });
  }, []);
  function clearFeedback() { setFeedback(null); }

  useEffect(() => { refresh(1).catch((error) => showFeedback(error.message, "error")).finally(() => setLoading(false)); }, [refresh, showFeedback]);

  function updateStep(index: number, update: Partial<Step>) {
    setSteps((current) => current.map((step, i) => i === index ? { ...step, ...update } : step));
  }
  function addStep() {
    setSteps((current) => [...current, { name: "", managerId: "", consultationScope: "ASSIGNED", requiresPurchaseOrder: false, fields: fields.map((field) => ({ key: field.key, mode: "READ_ONLY", required: false })) }]);
  }
  function createExample() {
    setSteps(createNfseWorkflowExample(fields));
    showFeedback("Exemplo criado. Escolha os responsáveis e ajuste os campos de cada etapa.", "info");
  }
  function copyVersion(version: Version) {
    setSteps(version.steps.map((step) => ({ name: step.name, managerId: step.managerId, consultationScope: step.consultationScope, requiresPurchaseOrder: step.requiresPurchaseOrder, fields: fields.map((field) => {
      const existing = step.fields.find((policy) => policy.fieldKey === field.key);
      return { key: field.key, mode: existing?.mode ?? "HIDDEN", required: existing?.required ?? false };
    }) })));
    setSection("configurar");
    showFeedback(`Versão ${version.number} copiada. Revise as etapas e salve para criar um novo rascunho.`, "info");
  }
  function updatePolicy(index: number, key: string, changes: Partial<Policy>) {
    const next = steps[index].fields.map((field) => field.key === key ? { ...field, ...changes } : field);
    updateStep(index, { fields: next });
  }
  function moveStep(index: number, offset: number) {
    setSteps((current) => { const next = [...current]; const target = index + offset; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  async function createDraft() {
    const invalidStep = steps.findIndex((step) => !step.name.trim() || !step.managerId);
    if (invalidStep >= 0) { showFeedback(`Na etapa ${invalidStep + 1}, preencha o nome e escolha o responsável.`, "error"); return; }
    setSaving(true); clearFeedback();
    try {
      const response = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: "NFSE", steps }) });
      const data = await response.json();
      if (!response.ok) throw new Error([data.error, ...(data.details?.formErrors ?? []), ...Object.values(data.details?.fieldErrors ?? {}).flat()].filter(Boolean).join(" ") || "Não foi possível salvar o rascunho.");
      await refresh(invoicePage); setVersionsExpanded(true); showFeedback(`Rascunho ${data.version.number} criado. Revise a versão e publique quando estiver pronto.`);
    } catch (error) { showFeedback(error instanceof Error ? error.message : "Erro ao salvar.", "error"); } finally { setSaving(false); }
  }
  async function publish(version: Version) {
    if (!workflow) return;
    setSaving(true); clearFeedback();
    try {
      const response = await fetch(`/api/workflows/${workflow.id}/versions/${version.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: version.revision }) });
      const data = await response.json();
      if (!response.ok) throw new Error([...(data.details?.formErrors ?? []), ...Object.values(data.details?.fieldErrors ?? {}).flat()].filter(Boolean).join(" ") || data.error || "Não foi possível publicar.");
      await refresh(invoicePage); showFeedback(`Versão ${version.number} publicada.`);
    } catch (error) { showFeedback(error instanceof Error ? error.message : "Erro ao publicar.", "error"); } finally { setSaving(false); }
  }
  async function enrollSelected() {
    setSaving(true); clearFeedback();
    try {
      const response = await fetch("/api/workflows/enroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceIds: selectedInvoices }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível encaminhar as notas.");
      const failed = data.results.filter((result: { success: boolean }) => !result.success);
      showFeedback(`${data.results.length - failed.length} nota(s) encaminhada(s). ${failed.map((item: { invoiceId: string; error: string }) => `${item.invoiceId}: ${item.error}`).join(" ")}`, failed.length ? "info" : "success");
      setSelectedInvoices(failed.map((item: { invoiceId: string }) => item.invoiceId));
      await refresh(invoicePage);
    } catch (error) { showFeedback(error instanceof Error ? error.message : "Erro ao encaminhar.", "error"); } finally { setSaving(false); }
  }
  async function processNotifications() {
    setSaving(true); clearFeedback();
    try {
      const response = await fetch("/api/workflows/notifications/process", { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível processar os avisos.");
      await refresh(invoicePage); showFeedback("Fila de avisos processada. Confira o resultado de cada envio.");
    } catch (error) { showFeedback(error instanceof Error ? error.message : "Erro ao processar avisos.", "error"); } finally { setSaving(false); }
  }
  async function retryNotification(item: Notification) {
    if (item.status === "UNCERTAIN" && !window.confirm("O aviso anterior pode ter sido entregue. Confirma que deseja tentar novamente?")) return;
    const reason = window.prompt("Informe o motivo do reenvio:")?.trim();
    if (!reason) return;
    setSaving(true); clearFeedback();
    try {
      const response = await fetch(`/api/workflows/notifications/${item.id}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, confirmPossibleDuplicate: item.status === "UNCERTAIN" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível solicitar o reenvio.");
      await refresh(invoicePage); showFeedback("Reenvio solicitado. Confira o resultado na lista.");
    } catch (error) { showFeedback(error instanceof Error ? error.message : "Erro ao reenviar.", "error"); } finally { setSaving(false); }
  }
  async function loadAudit() {
    if (!workflow) return;
    try {
      const response = await fetch(`/api/workflows/${workflow.id}/audit`);
      if (!response.ok) throw new Error("Não foi possível carregar a auditoria.");
      const data = await response.json(); setAudit(data.events);
    } catch (error) { showFeedback(error instanceof Error ? error.message : "Erro ao carregar auditoria.", "error"); }
  }
  async function loadAttempts(notificationId: string, page = 1) {
    try {
      const response = await fetch(`/api/workflows/notifications/${notificationId}/attempts?page=${page}`);
      if (!response.ok) throw new Error("Não foi possível carregar as tentativas.");
      const data = await response.json();
      setAttempts({ notificationId, items: data.items, page: data.pagination.page, totalPages: data.pagination.totalPages });
    } catch (error) { showFeedback(error instanceof Error ? error.message : "Erro ao carregar tentativas.", "error"); }
  }

  return <AppLayout>
    <MainHeader title="Workflow de aprovação" subtitle="Configure as etapas para notas de serviço." />
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {feedback && <div role={feedback.tone === "error" ? "alert" : "status"} aria-live={feedback.tone === "error" ? "assertive" : "polite"} className={`sticky top-24 z-30 rounded border p-3 text-sm shadow-card sm:top-2 ${feedback.tone === "error" ? "border-rose-300 bg-rose-50 font-medium text-rose-950" : feedback.tone === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-slate-300 bg-white text-slate-800"}`}><div className="flex items-start justify-between gap-3"><p>{feedback.text}</p><button type="button" className="shrink-0 rounded px-2 py-1 text-xs font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={clearFeedback} aria-label="Fechar mensagem">Fechar</button></div></div>}
      {loading ? <p>Carregando configuração...</p> : !fields.length ? <div className="space-y-3"><p>Não foi possível carregar os dados necessários para configurar o fluxo.</p><button type="button" className="btn-secondary" onClick={() => { setLoading(true); refresh(1).catch((error) => showFeedback(error.message, "error")).finally(() => setLoading(false)); }}>Tentar novamente</button></div> : <>
        <nav aria-label="Áreas do workflow" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {([ ["configurar", "Configurar fluxo"], ["notas", "Encaminhar notas"], ["avisos", "Acompanhar e-mails"] ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={section === key} className={section === key ? "btn-primary" : "btn-secondary"} onClick={() => setSection(key)}>{label}</button>)}
        </nav>
        {section === "avisos" && <section className="space-y-3"><h2 className="text-xl font-semibold">Avisos de atribuição</h2><p className="text-sm text-slate-600">Envios incertos precisam ser conferidos antes de uma nova tentativa. São exibidos os 100 avisos mais recentes.</p>
          {notifications.length ? <ul className="max-h-60 space-y-2 overflow-y-auto rounded border border-slate-200 bg-white p-3">{notifications.map((item) => <li key={item.id} className="border-b border-slate-100 pb-2 text-sm">Nota {item.task.execution.invoice.numeroNota} · {item.task.step.name} · {item.recipient} · {({ PENDING: "Pendente", PROCESSING: "Em envio", ACCEPTED: "Aceito pelo provedor", SIMULATED: "Simulado", FAILED: "Falhou", UNCERTAIN: "Resultado incerto" } as Record<string, string>)[item.status] ?? item.status}{item.attempts[0]?.error && <span> · {item.attempts[0].error}</span>}{["FAILED", "UNCERTAIN", "SIMULATED"].includes(item.status) && <button type="button" className="btn-secondary ml-2" disabled={saving} onClick={() => retryNotification(item)}>Reenviar</button>}</li>)}</ul> : <p className="text-sm text-slate-600">Nenhum aviso registrado.</p>}
          <button type="button" className="btn-secondary" disabled={saving} onClick={processNotifications}>Processar avisos pendentes</button>
          {notifications.length > 0 && <label className="approval-field"><span className="approval-field-label">Consultar tentativas de um aviso</span><select className="approval-field-control" value={attempts?.notificationId ?? ""} onChange={(event) => { if (event.target.value) void loadAttempts(event.target.value); else setAttempts(null); }}><option value="">Selecione um aviso</option>{notifications.map((item) => <option key={item.id} value={item.id}>Nota {item.task.execution.invoice.numeroNota} · {item.task.step.name} · {item.recipient}</option>)}</select></label>}
          {attempts && <div className="space-y-2"><ul className="space-y-1 text-sm">{attempts.items.map((attempt) => <li key={attempt.id}>{new Date(attempt.createdAt).toLocaleString("pt-BR")} · {attempt.status}{attempt.error ? ` · ${attempt.error}` : ""}</li>)}</ul><div className="flex items-center gap-2"><button type="button" className="btn-secondary" disabled={attempts.page <= 1} onClick={() => loadAttempts(attempts.notificationId, attempts.page - 1)}>Anterior</button><span className="text-sm">Página {attempts.page} de {attempts.totalPages}</span><button type="button" className="btn-secondary" disabled={attempts.page >= attempts.totalPages} onClick={() => loadAttempts(attempts.notificationId, attempts.page + 1)}>Próxima</button></div></div>}
        </section>}
        {section === "notas" && <section className="space-y-3"><h2 className="text-xl font-semibold">Encaminhar notas existentes</h2><p className="text-sm text-slate-600">Selecione notas pendentes para iniciar o fluxo publicado. São exibidas até 100 notas por página.</p>
          {pendingInvoices.length ? <ul className="max-h-60 space-y-2 overflow-y-auto rounded border border-slate-200 bg-white p-3">{pendingInvoices.map((invoice) => <li key={invoice.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedInvoices.includes(invoice.id)} onChange={(event) => setSelectedInvoices((current) => event.target.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id))} /> Nota {invoice.numeroNota} · {invoice.fornecedor.nome}</label></li>)}</ul> : <p className="text-sm text-slate-600">Nenhuma nota pendente disponível nesta página.</p>}
          <button type="button" className="btn-secondary" disabled={saving || !selectedInvoices.length || !workflow?.activeVersionId} onClick={enrollSelected}>Encaminhar selecionadas</button>
          <div className="flex items-center gap-2"><button type="button" className="btn-secondary" disabled={saving || invoicePage <= 1} onClick={() => refresh(invoicePage - 1).catch((error) => showFeedback(error.message, "error"))}>Anterior</button><span className="text-sm">Página {invoicePage} de {invoicePages}</span><button type="button" className="btn-secondary" disabled={saving || invoicePage >= invoicePages} onClick={() => refresh(invoicePage + 1).catch((error) => showFeedback(error.message, "error"))}>Próxima</button></div>
        </section>}
        {section === "configurar" && <><section className="space-y-3 rounded border border-slate-200 bg-white p-4"><div><h2 className="text-xl font-semibold">Workflow de NFS-e</h2><p className="text-sm text-slate-600">Monte as etapas na ordem de aprovação, escolha quem atua em cada uma e configure os campos que cada responsável pode preencher.</p></div>
          {workflow?.versions.length ? <details open={versionsExpanded} onToggle={(event) => setVersionsExpanded(event.currentTarget.open)} className="rounded border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer font-semibold">Versões e publicação <span className="text-sm font-normal text-slate-600">· {workflow.versions.length} versão(ões){workflow.activeVersionId ? " · há uma versão vigente" : ""}</span></summary><ul className="mt-3 space-y-2">{workflow.versions.map((version) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-3"><span>Versão {version.number} · {workflow.activeVersionId === version.id ? "Vigente" : version.status === "DRAFT" ? "Rascunho" : "Publicada"}</span><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={saving} onClick={() => copyVersion(version)}>Copiar para editar</button>{version.status === "DRAFT" && <button type="button" className="btn-secondary" disabled={saving} onClick={() => publish(version)}>Publicar</button>}</div></li>)}</ul>
            {workflow && <button type="button" className="btn-secondary mt-3" onClick={loadAudit}>Consultar auditoria</button>}{audit && <ul className="mt-3 space-y-1 text-sm">{audit.map((event) => <li key={event.id}>{new Date(event.createdAt).toLocaleString("pt-BR")} · {event.actorName} · {event.action === "DRAFT_CREATED" ? "Criou rascunho" : event.action === "VERSION_PUBLISHED" ? "Publicou versão" : event.action}</li>)}</ul>}
          </details> : <p className="text-sm text-slate-600">Ainda não há versões. Configure as etapas abaixo e salve o primeiro rascunho.</p>}
        </section>
        <section className="space-y-4"><div><h2 className="text-xl font-semibold">Configure as etapas</h2><p className="text-sm text-slate-600">Cada etapa tem uma pessoa responsável. Use “Subir” e “Descer” para definir a ordem em que a nota será encaminhada.</p></div>
          {!steps.length && <div className="rounded border border-slate-200 bg-slate-50 p-4"><p className="text-sm text-slate-700">Comece com um exemplo: o gestor avalia o serviço e, em seguida, outro responsável informa a compra e a data de pagamento.</p><button type="button" className="btn-secondary mt-3" onClick={createExample}>Usar exemplo de duas etapas</button></div>}
          {steps.length > 0 && <div className="rounded border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Pronto para publicar?</p><span className="text-xs text-slate-600">{steps.length} etapa(s)</span></div><ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{workflowChecks.map((check) => <li key={check.label} className={check.done ? "text-emerald-800" : "text-slate-700"}><span aria-hidden="true">{check.done ? "✓" : "○"}</span> <span className="sr-only">{check.done ? "Concluído: " : "Pendente: "}</span>{check.label}</li>)}</ul><p className="mt-2 text-xs text-slate-600">A data de pagamento também deve ficar editável na etapa final para permitir correção se o prazo passar.</p></div>}
          {steps.map((step, index) => <fieldset key={index} className="space-y-4 rounded border border-slate-300 bg-white p-4"><legend className="max-w-full px-2 font-semibold">Etapa {index + 1}{step.name.trim() ? ` · ${step.name.trim()}` : " · Nova etapa"}</legend>
            <div className="grid gap-3 sm:grid-cols-2"><label className="approval-field"><span className="approval-field-label">Nome da etapa</span><input className="approval-field-control" value={step.name} onChange={(event) => updateStep(index, { name: event.target.value })} /></label>
              <label className="approval-field"><span className="approval-field-label">Responsável</span><select className="approval-field-control" value={step.managerId} onChange={(event) => updateStep(index, { managerId: event.target.value })}><option value="">Selecione</option>{managers.map((manager) => <option value={manager.id} key={manager.id}>{manager.nome}</option>)}</select></label>
              <label className="approval-field"><span className="approval-field-label">Notas que pode consultar</span><select className="approval-field-control" value={step.consultationScope} onChange={(event) => updateStep(index, { consultationScope: event.target.value as Step["consultationScope"] })}><option value="ASSIGNED">Somente atribuídas</option><option value="ALL">Todas</option></select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={step.requiresPurchaseOrder} onChange={(event) => updateStep(index, { requiresPurchaseOrder: event.target.checked })} /> Exigir OC ou contrato nesta etapa</label></div>
            <details className="rounded border border-slate-200 p-3"><summary className="cursor-pointer font-semibold">Configurar campos desta etapa <span className="text-sm font-normal text-slate-600">· {step.fields.filter((field) => field.mode === "EDITABLE").length} editável(is), {step.fields.filter((field) => field.mode === "HIDDEN").length} oculto(s)</span></summary><p className="mt-2 text-sm text-slate-600">Escolha o que o responsável pode ver ou preencher. Marque “Obrigatório” apenas para campos editáveis.</p><div className="mt-3 space-y-2">{fields.map((field) => { const policy = step.fields.find((item) => item.key === field.key)!; return <div key={field.key} className="grid items-center gap-2 border-t border-slate-100 py-2 sm:grid-cols-[1fr_12rem_9rem]"><span className="text-sm">{field.label}</span><label className="text-sm"><span className="sr-only">Visibilidade de {field.label}</span><select className="approval-field-control" value={policy.mode} onChange={(event) => { const mode = event.target.value as Policy["mode"]; updatePolicy(index, field.key, { mode, required: mode === "EDITABLE" && policy.required }); }}><option value="HIDDEN">Oculto</option><option value="READ_ONLY">Somente leitura</option>{field.editable && <option value="EDITABLE">Editável</option>}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={policy.mode !== "EDITABLE"} checked={policy.required} onChange={(event) => updatePolicy(index, field.key, { required: event.target.checked })} /> Obrigatório</label></div>; })}</div></details>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3"><button type="button" className="btn-secondary" disabled={index === 0} onClick={() => moveStep(index, -1)}>Subir etapa</button><button type="button" className="btn-secondary" disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)}>Descer etapa</button><button type="button" className="btn-secondary" onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}>Remover etapa</button></div>
          </fieldset>)}
          <div className="sticky bottom-2 z-20 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white/95 p-3 shadow-card backdrop-blur"><button type="button" className="btn-secondary" onClick={addStep}>Adicionar etapa</button><button type="button" className="btn-primary" disabled={saving || !steps.length} onClick={createDraft}>{saving ? "Salvando…" : "Salvar rascunho"}</button><p className="text-xs text-slate-600">Depois de salvar, publique a versão no painel acima.</p></div>
        </section></>}
      </>}
    </main>
  </AppLayout>;
}
