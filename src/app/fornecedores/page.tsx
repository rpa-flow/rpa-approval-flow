"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout, PaginationControls } from "@/components/ui-kit";
import type { PaginationMetadata } from "@/lib/pagination";

type Me = { manager: { role: "ADMIN" | "GESTOR" | "FORNECEDOR"; suppliers: Array<{ supplierId: string; supplierName: string }> } };
type CategoryItem = { id: string; nome: string; ativo: boolean };
type SupplierListItem = { id: string; nome: string; cnpj: string | null; codigoExterno: string | null; categories?: CategoryItem[]; managers: Array<{ id: string; nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR"; ativo: boolean }> };
type ManagerItem = { id: string; nome: string; email: string; role: "ADMIN" | "GESTOR" | "FORNECEDOR"; ativo: boolean };
type SuppliersResponse = { items: SupplierListItem[]; pagination: PaginationMetadata };

const EMPTY_CREATE_FORM = { nome: "", cnpj: "", codigoExterno: "", managerNome: "", managerEmail: "", managerSenha: "", categoryIds: [] as string[] };

export default function FornecedoresPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({ page: 1, pageSize: 10, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cnpj: "", codigoExterno: "", selectedManagerId: "", createNewManager: false, addManagerNome: "", addManagerEmail: "", addManagerSenha: "", categoryIds: [] as string[], managerIds: [] as string[] });
  const [managerSearch, setManagerSearch] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const loadData = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) return router.push("/login");
    const meData = (await meRes.json()) as Me;
    setMe(meData);
    if (meData.manager.role !== "ADMIN") return;
    const [categoriesRes, managersRes] = await Promise.all([fetch("/api/categorias-fornecedores"), fetch("/api/gestores")]);
    if (categoriesRes.ok) setCategories((await categoriesRes.json()).filter((c: CategoryItem) => c.ativo));
    if (managersRes.ok) setManagers(await managersRes.json());
  }, [router]);

  const loadSuppliers = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });

    if (debouncedSearch) params.set("search", debouncedSearch);
    if (categoryFilter !== "TODAS") params.set("categoryId", categoryFilter);

    setIsLoadingSuppliers(true);
    try {
      const suppliersRes = await fetch(`/api/fornecedores?${params.toString()}`);
      if (suppliersRes.status === 401) return router.push("/login");
      if (suppliersRes.status === 403) return router.push("/dashboard");
      if (!suppliersRes.ok) {
        setMessage("Não foi possível carregar os fornecedores.");
        return;
      }

      const payload = await suppliersRes.json() as SuppliersResponse;
      setSuppliers(payload.items);
      setPagination(payload.pagination);
    } finally {
      setIsLoadingSuppliers(false);
    }
  }, [categoryFilter, debouncedSearch, page, pageSize, router]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (me?.manager.role === "ADMIN") loadSuppliers();
  }, [loadSuppliers, me?.manager.role]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const filteredManagers = useMemo(() => {
    const term = managerSearch.trim().toLowerCase();
    if (!term) return managers;
    return managers.filter((m) => m.nome.toLowerCase().includes(term) || m.email.toLowerCase().includes(term));
  }, [managers, managerSearch]);

  if (!me) return null;

  async function cadastrarFornecedor(e: React.FormEvent) { e.preventDefault();
    const hasInitialManager = createForm.managerNome.trim() && createForm.managerEmail.trim() && createForm.managerSenha;
    const res = await fetch("/api/fornecedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: createForm.nome, cnpj: createForm.cnpj.replace(/\D/g, "") || undefined, codigoExterno: createForm.codigoExterno.trim() || undefined, managers: hasInitialManager ? [{ nome: createForm.managerNome, email: createForm.managerEmail, senha: createForm.managerSenha }] : [], categoryIds: createForm.categoryIds }) });
    if (!res.ok) return setMessage("Erro ao cadastrar fornecedor. Verifique os dados.");
    setCreateForm(EMPTY_CREATE_FORM); setShowCreateForm(false); setPage(1); setMessage("Fornecedor cadastrado com sucesso. Use a tela de gestores para revisar os vínculos."); await loadData(); await loadSuppliers(); }

  function iniciarEdicao(supplier: SupplierListItem) {
    setEditingSupplierId(supplier.id);
    setManagerSearch("");
    setEditForm({
      nome: supplier.nome,
      cnpj: supplier.cnpj ?? "",
      codigoExterno: supplier.codigoExterno ?? "",
      selectedManagerId: "",
      createNewManager: false,
      addManagerNome: "",
      addManagerEmail: "",
      addManagerSenha: "",
      categoryIds: supplier.categories?.map((c) => c.id) ?? [],
      managerIds: supplier.managers.map((manager) => manager.id)
    });
  }

  function toggleManager(managerId: string) {
    setEditForm((previous) => ({
      ...previous,
      managerIds: previous.managerIds.includes(managerId)
        ? previous.managerIds.filter((id) => id !== managerId)
        : [...previous.managerIds, managerId]
    }));
  }

  async function salvarEdicao(e: React.FormEvent) { e.preventDefault(); if (!editingSupplierId) return;
    const res = await fetch(`/api/fornecedores/${editingSupplierId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: editForm.nome, cnpj: editForm.cnpj.replace(/\D/g, "") || null, codigoExterno: editForm.codigoExterno.trim() || null, managerIds: editForm.managerIds, addManager: editForm.createNewManager ? { nome: editForm.addManagerNome || undefined, email: editForm.addManagerEmail, senha: editForm.addManagerSenha || undefined } : editForm.selectedManagerId ? { id: editForm.selectedManagerId } : undefined, categoryIds: editForm.categoryIds }) });
    if (!res.ok) return setMessage("Erro ao salvar edição do fornecedor.");
    setEditingSupplierId(null); setMessage("Fornecedor atualizado com sucesso."); await loadData(); await loadSuppliers(); }

  return <AppLayout>
    <MainHeader title="Fornecedores" subtitle="Gestão central de fornecedores, categorias e responsáveis." />

    {me.manager.role === "ADMIN" ? <>
      <section className="card mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Base de fornecedores</h2><p className="muted small">O vínculo em massa de responsáveis agora fica na tela de gestores.</p></div><div className="flex flex-wrap items-center gap-2"><span className="badge badge-slate">{isLoadingSuppliers ? "Carregando..." : `${pagination.total} fornecedor(es)`}</span><Link href="/gestores" className="btn-secondary">Gerenciar gestores</Link><button type="button" className="btn-primary" onClick={() => setShowCreateForm((v) => !v)}>{showCreateForm ? "Cancelar" : "Adicionar fornecedor"}</button></div></div>
        <div className="grid gap-2 md:grid-cols-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por fornecedor, CNPJ, código externo ou gestor" />
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}><option value="TODAS">Todas as categorias</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          <button className="btn-secondary" type="button" onClick={() => { setSearch(""); setCategoryFilter("TODAS"); setPage(1); }}>Limpar filtros</button>
        </div>
        <div className="table-shell">
          <table className="min-w-full text-sm"><thead><tr><th className="px-4 py-3 text-left">Fornecedor</th><th className="px-4 py-3 text-left">CNPJ</th><th className="px-4 py-3 text-left">Código externo</th><th className="px-4 py-3 text-left">Categorias</th><th className="px-4 py-3 text-left">Gestores</th><th className="w-28 px-4 py-3 text-right whitespace-nowrap">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{suppliers.map((supplier) => <tr key={supplier.id} ><td className="px-4 py-3 font-medium text-slate-800">{supplier.nome}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{supplier.cnpj ?? "—"}</td><td className="px-4 py-3 text-slate-600">{supplier.codigoExterno ?? "—"}</td><td className="px-4 py-3">{supplier.categories?.length ? <div className="flex flex-wrap gap-1">{supplier.categories.map((c) => <span key={c.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{c.nome}</span>)}</div> : <span className="text-slate-400">—</span>}</td><td className="px-4 py-3 text-slate-600">{supplier.managers.map((m) => m.nome).join(", ") || "—"}</td><td className="px-4 py-3 text-right whitespace-nowrap"><button type="button" className="btn-secondary whitespace-nowrap" onClick={() => iniciarEdicao(supplier)}>Editar</button></td></tr>)}{!suppliers.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">{isLoadingSuppliers ? "Carregando fornecedores..." : "Nenhum fornecedor encontrado para os filtros aplicados."}</td></tr>}</tbody></table>
          <PaginationControls
            pagination={pagination}
            itemLabel="fornecedor(es)"
            loading={isLoadingSuppliers}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
          />
        </div>
      </section>
      {showCreateForm && <section className="card mt-4">
        <h3 className="mb-1 text-base font-semibold">Novo fornecedor</h3><p className="muted small mb-3">Cadastre o fornecedor e, se quiser, informe um responsável inicial. A manutenção completa dos vínculos fica em Gestores.</p>
        <form onSubmit={cadastrarFornecedor} className="grid-2">
          <label>Nome do fornecedor<input required value={createForm.nome} onChange={(e) => setCreateForm((p) => ({ ...p, nome: e.target.value }))} /></label>
          <label>CNPJ<input value={createForm.cnpj} onChange={(e) => setCreateForm((p) => ({ ...p, cnpj: e.target.value }))} /></label>
                    <label className="md:col-span-2">Categorias<select multiple value={createForm.categoryIds} onChange={(e) => setCreateForm((p) => ({ ...p, categoryIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))}>{categories.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label>Nome do responsável inicial<input value={createForm.managerNome} onChange={(e) => setCreateForm((p) => ({ ...p, managerNome: e.target.value }))} /></label>
          <label>E-mail do responsável inicial<input type="email" value={createForm.managerEmail} onChange={(e) => setCreateForm((p) => ({ ...p, managerEmail: e.target.value }))} /></label>
          <label>Senha inicial do responsável<input type="password" minLength={6} value={createForm.managerSenha} onChange={(e) => setCreateForm((p) => ({ ...p, managerSenha: e.target.value }))} /></label>
          <div className="flex items-end"><button className="btn-primary" type="submit">Cadastrar fornecedor</button></div>
        </form>
      </section>}
      {editingSupplierId && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-3 sm:p-6" onClick={() => setEditingSupplierId(null)}>
        <section className="card flex max-h-[calc(100svh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden p-0 sm:max-h-[calc(100svh-3rem)]" onClick={(e) => e.stopPropagation()}>
          <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h3 className="text-lg font-semibold">Editar fornecedor</h3>
              <p className="text-sm text-slate-500">Atualize dados cadastrais e gerencie todos os gestores vinculados ao fornecedor.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setEditingSupplierId(null)}>Fechar</button>
          </div>
          <form onSubmit={salvarEdicao} className="flex min-h-0 flex-1 flex-col">
            <div className="grid-2 min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <label>Nome<input required value={editForm.nome} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))} /></label>
            <label>CNPJ<input value={editForm.cnpj} onChange={(e) => setEditForm((p) => ({ ...p, cnpj: e.target.value }))} /></label>
            <label>Código externo no RPA<input value={editForm.codigoExterno} onChange={(e) => setEditForm((p) => ({ ...p, codigoExterno: e.target.value }))} /></label>
                      <label className="md:col-span-2">Categorias<select multiple value={editForm.categoryIds} onChange={(e) => setEditForm((p) => ({ ...p, categoryIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))}>{categories.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <label className="md:col-span-2">Buscar gestor<input placeholder="Filtrar por nome ou e-mail" value={managerSearch} onChange={(e) => setManagerSearch(e.target.value)} /></label>
            <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">Gestores vinculados</p>
                  <p className="text-xs text-slate-500">Marque os gestores que devem permanecer vinculados após salvar.</p>
                </div>
                <span className="badge badge-slate">{editForm.managerIds.length} selecionado(s)</span>
              </div>
              {editForm.managerIds.length ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {managers.filter((manager) => editForm.managerIds.includes(manager.id)).map((manager) => (
                    <span key={manager.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
                      {manager.nome}
                      <button type="button" className="!bg-transparent !p-0 !text-rose-600 hover:!text-rose-700" onClick={() => toggleManager(manager.id)} aria-label={`Remover ${manager.nome}`}>×</button>
                    </span>
                  ))}
                </div>
              ) : <p className="mb-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-500">Nenhum gestor vinculado</p>}
              <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                {filteredManagers.map((manager) => (
                  <label key={manager.id} className="checkbox rounded-md border border-border bg-white p-3">
                    <input type="checkbox" checked={editForm.managerIds.includes(manager.id)} onChange={() => toggleManager(manager.id)} />
                    <span>
                      <strong className="block text-slate-800">{manager.nome}</strong>
                      <span className="text-xs text-slate-500">{manager.email}</span>
                    </span>
                  </label>
                ))}
                {!filteredManagers.length && <p className="muted small">Nenhum gestor encontrado para a busca informada.</p>}
              </div>
            </div>
            <label className="md:col-span-2">Adicionar gestor existente ao salvar<select className="w-full" value={editForm.selectedManagerId} disabled={editForm.createNewManager} onChange={(e) => setEditForm((p) => ({ ...p, selectedManagerId: e.target.value }))}><option value="">Nenhum</option>{managers.filter((m) => !editForm.managerIds.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.email})</option>)}</select><span className="mt-1 block text-xs text-slate-500">O gestor selecionado será somado à lista marcada acima.</span></label>
            <label className="checkbox md:col-span-2 rounded-md border border-border bg-surface-container-low p-3"><input type="checkbox" checked={editForm.createNewManager} onChange={(e) => setEditForm((p) => ({ ...p, createNewManager: e.target.checked, selectedManagerId: e.target.checked ? "" : p.selectedManagerId }))} />Criar novo gestor ao salvar</label>
            {editForm.createNewManager && <>
              <label>Nome do novo gestor<input value={editForm.addManagerNome} onChange={(e) => setEditForm((p) => ({ ...p, addManagerNome: e.target.value }))} /></label>
              <label>E-mail do novo gestor<input type="email" value={editForm.addManagerEmail} onChange={(e) => setEditForm((p) => ({ ...p, addManagerEmail: e.target.value }))} /></label>
              <label>Senha inicial<input type="password" minLength={6} value={editForm.addManagerSenha} onChange={(e) => setEditForm((p) => ({ ...p, addManagerSenha: e.target.value }))} /></label>
            </>}
            </div>
            <div className="shrink-0 border-t border-slate-100 bg-transparent px-4 py-3 sm:px-5">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setEditingSupplierId(null)}>Cancelar</button>
              <button className="btn-primary" type="submit">Salvar alterações</button>
              </div>
            </div>
          </form>
        </section>
      </div>}
    </> : null}
    {message && <p className="message" role="status">{message}</p>}
  </AppLayout>;
}
