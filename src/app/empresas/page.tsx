"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AppLayout, DataTable, FormField, PaginationControls, SectionCard, StatusBadge } from "@/components/ui-kit";
import { NfseProcessingSection } from "./components/nfse-processing-section";
import { NfseProcessingStatusBadge } from "./components/nfse-processing-status-badge";
import type { PaginationMetadata } from "@/lib/pagination";

type Me = { manager: { role: "ADMIN" | "GESTOR" | "FORNECEDOR" } };
type Company = {
  id: string;
  cnpj: string;
  displayName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nfseNsuSummary?: { processingStatus: string; pendingGapCount: number; retryErrorCount: number; lastScanAt: string | null; lastDocumentDownloadedAt: string | null } | null;
};
type CompaniesResponse = { items: Company[]; pagination: PaginationMetadata };

type CompanyForm = { cnpj: string; displayName: string; active: boolean };

const EMPTY_FORM: CompanyForm = { cnpj: "", displayName: "", active: true };
type CompanyViewMode = "list" | "form" | "details";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return value || "—";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function toCompanyForm(company: Company): CompanyForm {
  return { cnpj: company.cnpj, displayName: company.displayName, active: company.active };
}

export default function EmpresasPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({ page: 1, pageSize: 10, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [viewMode, setViewMode] = useState<CompanyViewMode>("list");
  const [openActionsCompanyId, setOpenActionsCompanyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODAS" | "ATIVAS" | "INATIVAS">("TODAS");
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const loadMe = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    const meData = await meRes.json() as Me;
    setMe(meData);
  }, [router]);

  const loadCompanies = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      includeNfseSummary: "true"
    });

    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "TODAS") params.set("status", statusFilter);

    setIsLoadingCompanies(true);
    try {
      const companiesRes = await fetch(`/api/empresas?${params.toString()}`);
      if (companiesRes.status === 401) return router.push("/login");
      if (companiesRes.status === 403) return router.push("/dashboard");
      if (!companiesRes.ok) {
        setMessage("Erro ao carregar empresas.");
        return;
      }

      const payload = await companiesRes.json() as CompaniesResponse;
      setCompanies(payload.items);
      setPagination(payload.pagination);
    } finally {
      setIsLoadingCompanies(false);
    }
  }, [debouncedSearch, page, pageSize, router, statusFilter]);

  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => { if (me?.manager.role === "ADMIN") loadCompanies(); }, [loadCompanies, me?.manager.role]);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  if (!me) return null;

  async function submitCompany(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    const payload = { ...form, cnpj: onlyDigits(form.cnpj), displayName: form.displayName.trim() };
    const response = await fetch(editingCompanyId ? `/api/empresas/${editingCompanyId}` : "/api/empresas", {
      method: editingCompanyId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const error = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(error?.error ?? "Erro ao salvar empresa. Verifique os dados informados.");
      return;
    }

    setForm(EMPTY_FORM);
    setEditingCompanyId(null);
    setSelectedCompany(null);
    setViewMode("list");
    setPage(1);
    setMessage(editingCompanyId ? "Empresa atualizada com sucesso." : "Empresa cadastrada com sucesso.");
    await loadCompanies();
  }

  function startCreating() {
    setEditingCompanyId(null);
    setSelectedCompany(null);
    setForm(EMPTY_FORM);
    setViewMode("form");
    setOpenActionsCompanyId(null);
    setMessage("");
  }

  function startEditing(company: Company) {
    setEditingCompanyId(company.id);
    setSelectedCompany(company);
    setForm(toCompanyForm(company));
    setViewMode("form");
    setOpenActionsCompanyId(null);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startDetails(company: Company) {
    setSelectedCompany(company);
    setEditingCompanyId(null);
    setViewMode("details");
    setOpenActionsCompanyId(null);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToList() {
    setEditingCompanyId(null);
    setSelectedCompany(null);
    setForm(EMPTY_FORM);
    setViewMode("list");
    setOpenActionsCompanyId(null);
    setMessage("");
  }

  function cancelEditing() {
    backToList();
  }

  async function toggleCompany(company: Company) {
    setMessage("");
    const response = await fetch(`/api/empresas/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !company.active })
    });

    if (!response.ok) {
      setMessage("Erro ao atualizar o status da empresa.");
      return;
    }

    setMessage(`Empresa ${company.active ? "inativada" : "ativada"} com sucesso.`);
    await loadCompanies();
  }

  if (me.manager.role !== "ADMIN") {
    return (
      <AppLayout>
        <MainHeader title="Empresas" subtitle="Cadastro de empresas por CNPJ completo" />
        <section className="card mt-4">
          <p>Acesso restrito ao perfil ADMIN.</p>
        </section>
      </AppLayout>
    );
  }

  const headerTitle = viewMode === "details" ? "Detalhes da empresa" : viewMode === "form" ? (editingCompanyId ? "Editar empresa" : "Nova empresa") : "Empresas";
  const headerSubtitle = viewMode === "details" && selectedCompany
    ? `${selectedCompany.displayName} · ${formatCnpj(selectedCompany.cnpj)}`
    : "Gerencie nomes amigáveis por CNPJ completo da nota fiscal.";

  return (
    <AppLayout>
      <MainHeader title={headerTitle} subtitle={headerSubtitle} />

      {viewMode !== "list" && (
        <div className="mb-4">
          <Button type="button" variant="outline" onClick={backToList}>Voltar para empresas</Button>
        </div>
      )}

      {viewMode === "form" && (
        <SectionCard
          title={editingCompanyId ? "Editar empresa" : "Nova empresa"}
          description="Cadastre cada matriz ou filial pelo CNPJ completo de 14 dígitos para evitar conflitos entre unidades com a mesma raiz."
        >
          <form onSubmit={submitCompany} className="grid gap-4 md:grid-cols-4">
            <FormField label="CNPJ completo">
              <Input
                value={form.cnpj}
                onChange={(event) => setForm((prev) => ({ ...prev, cnpj: onlyDigits(event.target.value).slice(0, 14) }))}
                placeholder="31096483000101"
                inputMode="numeric"
                pattern="\d{14}"
                required
              />
            </FormField>
            <FormField label="Nome de exibição" className="md:col-span-2">
              <Input
                value={form.displayName}
                onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                placeholder="Ex.: Matriz"
                required
                minLength={2}
                maxLength={120}
              />
            </FormField>
            <FormField label="Status">
              <Select value={form.active ? "ATIVA" : "INATIVA"} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.value === "ATIVA" }))}>
                <option value="ATIVA">Ativa</option>
                <option value="INATIVA">Inativa</option>
              </Select>
            </FormField>
            <div className="md:col-span-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelEditing}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : editingCompanyId ? "Salvar alterações" : "Cadastrar empresa"}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      {viewMode === "list" && (
        <SectionCard
          title="Empresas cadastradas"
          description="Pesquise por nome ou CNPJ e acesse as ações de cada empresa pelo menu da coluna Ações."
          actions={<div className="flex items-center gap-3"><span className="text-sm font-semibold text-slate-500">{isLoadingCompanies ? "Carregando..." : `${pagination.total} empresa(s)`}</span><Button type="button" onClick={startCreating}>Nova empresa</Button></div>}
        >
          <div className="mb-4 grid gap-3 rounded-md border border-border bg-surface-container-low p-3 md:grid-cols-3">
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Buscar por nome ou CNPJ"
            />
            <Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1); }}>
              <option value="TODAS">Todos os status</option>
              <option value="ATIVAS">Somente ativas</option>
              <option value="INATIVAS">Somente inativas</option>
            </Select>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("TODAS");
                setPage(1);
              }}
            >
              Limpar filtros
            </Button>
          </div>

          <DataTable
            data={companies}
            getRowKey={(company) => company.id}
            loading={isLoadingCompanies}
            emptyTitle="Nenhuma empresa encontrada"
            emptyDescription="Ajuste os filtros ou cadastre uma empresa para exibir nomes amigáveis nas notas."
            columns={[
              { key: "displayName", header: "Empresa", cell: (company) => <span className="font-semibold text-slate-900">{company.displayName}</span> },
              { key: "cnpj", header: "CNPJ", cell: (company) => <span className="whitespace-nowrap font-mono text-slate-700">{formatCnpj(company.cnpj)}</span> },
              { key: "status", header: "Status", cell: (company) => <StatusBadge status={company.active ? "ATIVO" : "INATIVO"} label={company.active ? "Ativa" : "Inativa"} /> },
              { key: "nfse", header: "NFS-e", cell: (company) => <div className="space-y-1"><NfseProcessingStatusBadge status={company.nfseNsuSummary?.processingStatus} /><div className="text-xs text-slate-500">Gaps: {company.nfseNsuSummary?.pendingGapCount ?? 0} · Erros: {company.nfseNsuSummary?.retryErrorCount ?? 0}</div></div> },
              { key: "updatedAt", header: "Atualização", cell: (company) => <span className="text-slate-600">{new Date(company.updatedAt).toLocaleString("pt-BR")}</span> }
            ]}
            actions={(company) => (
              <div className="relative flex justify-end">
                <Button type="button" variant="outline" size="sm" aria-haspopup="menu" aria-expanded={openActionsCompanyId === company.id} onClick={() => setOpenActionsCompanyId((current) => current === company.id ? null : company.id)}>
                  Ações
                </Button>
                {openActionsCompanyId === company.id && (
                  <div className="absolute right-0 top-10 z-20">
                    <DropdownMenuContent>
                      <DropdownMenuItem type="button" onClick={() => startEditing(company)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem type="button" onClick={() => startDetails(company)}>Ver detalhes</DropdownMenuItem>
                      <DropdownMenuItem type="button" className={company.active ? "text-danger" : undefined} onClick={() => { setOpenActionsCompanyId(null); toggleCompany(company); }}>
                        {company.active ? "Desativar" : "Ativar"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </div>
                )}
              </div>
            )}
          />
          <PaginationControls
            pagination={pagination}
            itemLabel="empresa(s)"
            loading={isLoadingCompanies}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
          />
        </SectionCard>
      )}

      {viewMode === "details" && selectedCompany && (
        <>
          <SectionCard title="Dados da empresa" description="Resumo cadastral da empresa selecionada.">
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <p><strong>Empresa:</strong> {selectedCompany.displayName}</p>
              <p><strong>CNPJ:</strong> <span className="font-mono">{formatCnpj(selectedCompany.cnpj)}</span></p>
              <p><strong>Status:</strong> <StatusBadge status={selectedCompany.active ? "ATIVO" : "INATIVO"} label={selectedCompany.active ? "Ativa" : "Inativa"} /></p>
            </div>
          </SectionCard>
          <NfseProcessingSection companyId={selectedCompany.id} />
        </>
      )}

      {message && <Alert variant={message.startsWith("Erro") ? "destructive" : "success"}>{message}</Alert>}
    </AppLayout>
  );
}
