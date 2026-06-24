"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout, PaginationControls } from "@/components/ui-kit";
import type { PaginationMetadata } from "@/lib/pagination";

type UserRole = "ADMIN" | "GESTOR" | "FORNECEDOR";
type Me = { manager: { role: UserRole } };
type SupplierOption = { id: string; nome: string; cnpj: string | null; codigoExterno: string | null };
type ManagerListItem = {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  suppliers: SupplierOption[];
};
type ManagersResponse = { items: ManagerListItem[]; pagination: PaginationMetadata };

type ManagerForm = {
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  ativo: boolean;
  supplierIds: string[];
};

const EMPTY_FORM: ManagerForm = {
  nome: "",
  email: "",
  senha: "",
  role: "GESTOR",
  ativo: true,
  supplierIds: []
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor aprovador",
  FORNECEDOR: "Portal fornecedor"
};

function formatSuppliers(suppliers: SupplierOption[]) {
  if (!suppliers.length) return "Nenhum fornecedor vinculado";
  if (suppliers.length <= 2) return suppliers.map((supplier) => supplier.nome).join(", ");
  return `${suppliers.slice(0, 2).map((supplier) => supplier.nome).join(", ")} +${suppliers.length - 2}`;
}

export default function GestoresPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [managers, setManagers] = useState<ManagerListItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({ page: 1, pageSize: 10, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ManagerForm>(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activatingManagerId, setActivatingManagerId] = useState<string | null>(null);
  const [isSendingBulkActivation, setIsSendingBulkActivation] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    const meData = (await meRes.json()) as Me;
    setMe(meData);
    if (meData.manager.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    const suppliersRes = await fetch("/api/fornecedores");
    if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
  }, [router]);

  const loadManagers = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });

    if (debouncedSearch) params.set("search", debouncedSearch);

    setIsLoadingManagers(true);
    try {
      const managersRes = await fetch(`/api/gestores?${params.toString()}`);
      if (managersRes.status === 401) return router.push("/login");
      if (managersRes.status === 403) return router.push("/dashboard");
      if (!managersRes.ok) {
        setMessage("Não foi possível carregar os gestores.");
        return;
      }

      const payload = await managersRes.json() as ManagersResponse;
      setManagers(payload.items);
      setPagination(payload.pagination);
    } finally {
      setIsLoadingManagers(false);
    }
  }, [debouncedSearch, page, pageSize, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (me?.manager.role === "ADMIN") loadManagers();
  }, [loadManagers, me?.manager.role]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  function startCreate() {
    setEditingManagerId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setMessage("");
  }

  function startEdit(manager: ManagerListItem) {
    setEditingManagerId(manager.id);
    setForm({
      nome: manager.nome,
      email: manager.email,
      senha: "",
      role: manager.role,
      ativo: manager.ativo,
      supplierIds: manager.suppliers.map((supplier) => supplier.id)
    });
    setShowForm(true);
    setMessage("");
  }

  function toggleSupplier(supplierId: string) {
    setForm((current) => ({
      ...current,
      supplierIds: current.supplierIds.includes(supplierId)
        ? current.supplierIds.filter((id) => id !== supplierId)
        : [...current.supplierIds, supplierId]
    }));
  }

  async function sendBulkActivation() {
    setIsSendingBulkActivation(true);
    setMessage("");

    const res = await fetch("/api/gestores/ativacao", { method: "POST" });
    setIsSendingBulkActivation(false);

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      setMessage(error?.error ?? "Não foi possível enviar as ativações.");
      return;
    }

    const payload = await res.json();
    setMessage(`${payload.sent ?? 0} e-mail(s) de ativação enviados para usuários inativos.`);
  }

  async function sendActivation(manager: ManagerListItem) {
    setActivatingManagerId(manager.id);
    setMessage("");

    const res = await fetch(`/api/gestores/${manager.id}/ativacao`, { method: "POST" });
    setActivatingManagerId(null);

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      setMessage(error?.error ?? "Não foi possível enviar o e-mail de ativação.");
      return;
    }

    setMessage(`E-mail de ativação enviado para ${manager.email}.`);
  }

  async function toggleManagerStatus(manager: ManagerListItem) {
    setMessage("");
    const res = await fetch(`/api/gestores/${manager.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: manager.nome,
        email: manager.email,
        role: manager.role,
        ativo: !manager.ativo,
        supplierIds: manager.suppliers.map((supplier) => supplier.id)
      })
    });

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      setMessage(error?.error ?? "Não foi possível alterar o status do usuário.");
      return;
    }

    setMessage(manager.ativo ? "Usuário desativado com sucesso." : "Usuário ativado com sucesso.");
    await loadManagers();
  }

  async function saveManager(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage("");

    const payload = {
      nome: form.nome,
      email: form.email,
      role: form.role,
      ativo: form.ativo,
      supplierIds: form.supplierIds,
      ...(form.senha ? { senha: form.senha } : {})
    };

    const res = await fetch(editingManagerId ? `/api/gestores/${editingManagerId}` : "/api/gestores", {
      method: editingManagerId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setIsSaving(false);

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      setMessage(error?.error ?? "Erro ao salvar gestor. Verifique os dados informados.");
      return;
    }

    setShowForm(false);
    setEditingManagerId(null);
    setForm(EMPTY_FORM);
    if (!editingManagerId) setPage(1);
    setMessage(editingManagerId ? "Gestor atualizado com sucesso." : "Gestor cadastrado com sucesso.");
    await loadData();
    await loadManagers();
  }

  if (!me || me.manager.role !== "ADMIN") return null;

  return (
    <AppLayout>
      <MainHeader
        title="Gestores"
        subtitle="Administre acessos e vincule fornecedores diretamente pelo responsável, com visão clara de todos os vínculos."
      />

      <section className="card mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Base de gestores</h2>
            <p className="muted small">Use esta tela para manter usuários e seus fornecedores em um único lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-slate">{isLoadingManagers ? "Carregando..." : `${pagination.total} gestor(es)`}</span>
            <button type="button" className="btn-secondary" disabled={isSendingBulkActivation} onClick={sendBulkActivation}>
              {isSendingBulkActivation ? "Enviando..." : "Enviar ativações"}
            </button>
            <button type="button" className="btn-primary" onClick={startCreate}>
              Adicionar gestor
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por gestor, e-mail, perfil ou fornecedor"
          />
          <button type="button" className="btn-secondary" onClick={() => { setSearch(""); setPage(1); }}>
            Limpar busca
          </button>
        </div>

        <div className="table-shell">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left">Gestor</th>
                <th className="px-4 py-3 text-left">Perfil</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Fornecedores vinculados</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {managers.map((manager) => (
                <tr key={manager.id}>
                  <td className="px-4 py-3">
                    <strong className="block text-slate-800">{manager.nome}</strong>
                    <span className="text-slate-500">{manager.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge badge-blue">{roleLabels[manager.role]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${manager.ativo ? "badge-success" : "badge-slate"}`}>
                      {manager.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatSuppliers(manager.suppliers)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {!manager.ativo && (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={activatingManagerId === manager.id}
                          onClick={() => sendActivation(manager)}
                        >
                          {activatingManagerId === manager.id ? "Enviando..." : "Enviar ativação"}
                        </button>
                      )}
                      <button type="button" className="btn-secondary" onClick={() => toggleManagerStatus(manager)}>
                        {manager.ativo ? "Desativar" : "Ativar"}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => startEdit(manager)}>
                        Editar vínculos
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!managers.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    {isLoadingManagers ? "Carregando gestores..." : "Nenhum gestor encontrado para a busca informada."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <PaginationControls
            pagination={pagination}
            itemLabel="gestor(es)"
            loading={isLoadingManagers}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
          />
        </div>
      </section>

      {showForm && (
        <section className="card mt-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">{editingManagerId ? "Editar gestor" : "Novo gestor"}</h3>
              <p className="muted small">
                Selecione todos os fornecedores sob responsabilidade deste gestor. Essa é a forma recomendada de manter os vínculos.
              </p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Fechar
            </button>
          </div>

          <form onSubmit={saveManager} className="ds-stack">
            <div className="grid-2">
              <label>
                Nome
                <input
                  required
                  minLength={2}
                  value={form.nome}
                  onChange={(e) => setForm((current) => ({ ...current, nome: e.target.value }))}
                />
              </label>
              <label>
                E-mail
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                />
              </label>
              <label>
                Perfil de acesso
                <select
                  value={form.role}
                  onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as UserRole }))}
                >
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {editingManagerId ? "Nova senha (opcional)" : "Senha inicial"}
                <input
                  required={!editingManagerId}
                  minLength={6}
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm((current) => ({ ...current, senha: e.target.value }))}
                />
              </label>
              <label className="checkbox md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((current) => ({ ...current, ativo: e.target.checked }))}
                />
                Usuário ativo
              </label>
            </div>

            <div className="form-section">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="form-section-title">Fornecedores vinculados</p>
                <span className="badge badge-slate">{form.supplierIds.length} selecionado(s)</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {suppliers.map((supplier) => (
                  <label key={supplier.id} className="checkbox rounded-md border border-border bg-surface-container-low p-3">
                    <input
                      type="checkbox"
                      checked={form.supplierIds.includes(supplier.id)}
                      onChange={() => toggleSupplier(supplier.id)}
                    />
                    <span>
                      <strong className="block text-slate-800">{supplier.nome}</strong>
                      <span className="text-xs text-slate-500">
                        {supplier.cnpj ?? "Sem CNPJ"}{supplier.codigoExterno ? ` · ${supplier.codigoExterno}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
                {!suppliers.length && <p className="muted small">Cadastre fornecedores antes de vinculá-los a gestores.</p>}
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar gestor"}
              </button>
            </div>
          </form>
        </section>
      )}

      {message && <p className="message" role="status">{message}</p>}
    </AppLayout>
  );
}
