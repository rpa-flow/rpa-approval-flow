"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";

type Me = { manager: { role: "ADMIN" | "GESTOR"; suppliers: Array<{ supplierId: string; supplierName: string }> } };
type CategoryItem = { id: string; nome: string; ativo: boolean };
type SupplierListItem = { id: string; nome: string; cnpj: string | null; categories?: CategoryItem[]; managers: Array<{ id: string; nome: string; email: string; role: "ADMIN" | "GESTOR"; ativo: boolean }> };
type ManagerItem = { id: string; nome: string; email: string; role: "ADMIN" | "GESTOR"; ativo: boolean };

const EMPTY_CREATE_FORM = { nome: "", cnpj: "", managerNome: "", managerEmail: "", managerSenha: "", categoryIds: [] as string[] };

export default function FornecedoresPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cnpj: "", selectedManagerEmail: "", createNewManager: false, addManagerNome: "", addManagerEmail: "", addManagerSenha: "", categoryIds: [] as string[] });
  const [managerSearch, setManagerSearch] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const loadData = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) return router.push("/login");
    const meData = (await meRes.json()) as Me;
    setMe(meData);
    if (meData.manager.role !== "ADMIN") return;
    const [suppliersRes, categoriesRes, managersRes] = await Promise.all([fetch("/api/fornecedores"), fetch("/api/categorias-fornecedores"), fetch("/api/gestores")]);
    if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
    if (categoriesRes.ok) setCategories((await categoriesRes.json()).filter((c: CategoryItem) => c.ativo));
    if (managersRes.ok) setManagers(await managersRes.json());
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredSuppliers = useMemo(() => suppliers.filter((s) => {
    const byCategory = categoryFilter === "TODAS" || (s.categories ?? []).some((c) => c.id === categoryFilter);
    const term = search.trim().toLowerCase();
    const bySearch = !term || s.nome.toLowerCase().includes(term) || (s.cnpj ?? "").includes(term) || s.managers.some((m) => m.nome.toLowerCase().includes(term));
    return byCategory && bySearch;
  }), [suppliers, categoryFilter, search]);
  const filteredManagers = useMemo(() => {
    const term = managerSearch.trim().toLowerCase();
    if (!term) return managers;
    return managers.filter((m) => m.nome.toLowerCase().includes(term) || m.email.toLowerCase().includes(term));
  }, [managers, managerSearch]);

  if (!me) return null;

  async function cadastrarFornecedor(e: React.FormEvent) { e.preventDefault();
    const res = await fetch("/api/fornecedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: createForm.nome, cnpj: createForm.cnpj.replace(/\D/g, "") || undefined, managers: [{ nome: createForm.managerNome, email: createForm.managerEmail, senha: createForm.managerSenha }], categoryIds: createForm.categoryIds }) });
    if (!res.ok) return setMessage("Erro ao cadastrar fornecedor/gestor. Verifique os dados.");
    setCreateForm(EMPTY_CREATE_FORM); setShowCreateForm(false); setMessage("Fornecedor e gestor cadastrados com sucesso."); await loadData(); }

  function iniciarEdicao(supplier: SupplierListItem) { setEditingSupplierId(supplier.id); setEditForm({ nome: supplier.nome, cnpj: supplier.cnpj ?? "", selectedManagerEmail: "", createNewManager: false, addManagerNome: "", addManagerEmail: "", addManagerSenha: "", categoryIds: supplier.categories?.map((c) => c.id) ?? [] }); }

  async function salvarEdicao(e: React.FormEvent) { e.preventDefault(); if (!editingSupplierId) return;
    const res = await fetch(`/api/fornecedores/${editingSupplierId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: editForm.nome, cnpj: editForm.cnpj.replace(/\D/g, "") || null, addManager: editForm.createNewManager ? { nome: editForm.addManagerNome || undefined, email: editForm.addManagerEmail, senha: editForm.addManagerSenha || undefined } : editForm.selectedManagerEmail ? { email: editForm.selectedManagerEmail } : undefined, categoryIds: editForm.categoryIds }) });
    if (!res.ok) return setMessage("Erro ao salvar edição do fornecedor.");
    setEditingSupplierId(null); setMessage("Fornecedor atualizado com sucesso."); await loadData(); }

  return <main className="container container-wide">
    <MainHeader title="Fornecedores" subtitle="Gestão central de fornecedores, categorias e responsáveis." />

    {me.manager.role === "ADMIN" ? <>
      <section className="card mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Base de fornecedores</h2><button type="button" className="btn-primary" onClick={() => setShowCreateForm((v) => !v)}>{showCreateForm ? "Cancelar" : "Adicionar fornecedor"}</button></div>
        <div className="grid gap-2 md:grid-cols-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por fornecedor, CNPJ ou gestor" />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="TODAS">Todas as categorias</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          <button className="btn-secondary" type="button" onClick={() => { setSearch(""); setCategoryFilter("TODAS"); }}>Limpar filtros</button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">Fornecedor</th><th className="px-4 py-3 text-left">CNPJ</th><th className="px-4 py-3 text-left">Categorias</th><th className="px-4 py-3 text-left">Gestores</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredSuppliers.map((supplier) => <tr key={supplier.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-800">{supplier.nome}</td><td className="px-4 py-3 text-slate-600">{supplier.cnpj ?? "—"}</td><td className="px-4 py-3">{supplier.categories?.length ? <div className="flex flex-wrap gap-1">{supplier.categories.map((c) => <span key={c.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{c.nome}</span>)}</div> : <span className="text-slate-400">—</span>}</td><td className="px-4 py-3 text-slate-600">{supplier.managers.map((m) => m.nome).join(", ") || "—"}</td><td className="px-4 py-3 text-right"><button type="button" className="btn-secondary" onClick={() => iniciarEdicao(supplier)}>Editar</button></td></tr>)}{!filteredSuppliers.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Nenhum fornecedor encontrado para os filtros aplicados.</td></tr>}</tbody></table>
        </div>
      </section>
      {showCreateForm && <section className="card mt-4">
        <h3 className="mb-3 text-base font-semibold">Novo fornecedor + gestor</h3>
        <form onSubmit={cadastrarFornecedor} className="grid-2">
          <label>Nome do fornecedor<input required value={createForm.nome} onChange={(e) => setCreateForm((p) => ({ ...p, nome: e.target.value }))} /></label>
          <label>CNPJ<input value={createForm.cnpj} onChange={(e) => setCreateForm((p) => ({ ...p, cnpj: e.target.value }))} /></label>
          <label className="md:col-span-2">Categorias<select multiple value={createForm.categoryIds} onChange={(e) => setCreateForm((p) => ({ ...p, categoryIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))}>{categories.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label>Nome do gestor<input required value={createForm.managerNome} onChange={(e) => setCreateForm((p) => ({ ...p, managerNome: e.target.value }))} /></label>
          <label>E-mail do gestor<input required type="email" value={createForm.managerEmail} onChange={(e) => setCreateForm((p) => ({ ...p, managerEmail: e.target.value }))} /></label>
          <label>Senha inicial<input required type="password" minLength={6} value={createForm.managerSenha} onChange={(e) => setCreateForm((p) => ({ ...p, managerSenha: e.target.value }))} /></label>
          <div className="flex items-end"><button className="btn-primary" type="submit">Cadastrar fornecedor</button></div>
        </form>
      </section>}
      {editingSupplierId && <div className="fixed inset-0 z-40 bg-slate-950/40 px-4 py-8" onClick={() => setEditingSupplierId(null)}>
        <section className="card mx-auto flex max-h-[88vh] w-full max-w-3xl flex-col p-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold">Editar fornecedor</h3>
              <p className="text-sm text-slate-500">Atualize dados cadastrais sem sair da listagem.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setEditingSupplierId(null)}>Fechar</button>
          </div>
          <form onSubmit={salvarEdicao} className="flex flex-1 flex-col">
            <div className="grid-2 overflow-y-auto px-5 pb-4">
            <label>Nome<input required value={editForm.nome} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))} /></label>
            <label>CNPJ<input value={editForm.cnpj} onChange={(e) => setEditForm((p) => ({ ...p, cnpj: e.target.value }))} /></label>
            <label className="md:col-span-2">Categorias<select multiple value={editForm.categoryIds} onChange={(e) => setEditForm((p) => ({ ...p, categoryIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))}>{categories.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <label className="md:col-span-2">Buscar gestor<input placeholder="Filtrar por nome ou e-mail" value={managerSearch} onChange={(e) => setManagerSearch(e.target.value)} /></label>
            <label className="md:col-span-2">Vincular gestor<select className="w-full" value={editForm.selectedManagerEmail} onChange={(e) => setEditForm((p) => ({ ...p, selectedManagerEmail: e.target.value }))}><option value="">Nenhum</option>{filteredManagers.map((m) => <option key={m.id} value={m.email}>{m.nome} ({m.email})</option>)}</select></label>
            </div>
            <div className="mt-auto flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
              <button type="button" className="btn-secondary" onClick={() => setEditingSupplierId(null)}>Cancelar</button>
              <button className="btn-primary" type="submit">Salvar alterações</button>
            </div>
          </form>
        </section>
      </div>}
    </> : null}
    {message && <p className="message">{message}</p>}
  </main>;
}
