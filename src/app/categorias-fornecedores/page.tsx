"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";

type Category = {
  id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  createdAt: string;
};

type Me = { manager: { role: "ADMIN" | "GESTOR" | "FORNECEDOR" } };

const EMPTY_FORM = { nome: "", descricao: "" };

export default function CategoriasFornecedoresPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODAS" | "ATIVAS" | "INATIVAS">("TODAS");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const loadData = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    const meData = (await meRes.json()) as Me;
    setMe(meData);

    if (meData.manager.role !== "ADMIN") return;

    const categoriesRes = await fetch("/api/categorias-fornecedores");
    if (categoriesRes.ok) {
      setCategories(await categoriesRes.json());
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesSearch = !term
        || category.nome.toLowerCase().includes(term)
        || (category.descricao ?? "").toLowerCase().includes(term);

      const matchesStatus = statusFilter === "TODAS"
        || (statusFilter === "ATIVAS" && category.ativo)
        || (statusFilter === "INATIVAS" && !category.ativo);

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  if (!me) return null;

  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    const response = await fetch("/api/categorias-fornecedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setMessage("Erro ao criar categoria. Verifique os dados informados.");
      return;
    }

    setForm(EMPTY_FORM);
    setMessage("Categoria criada com sucesso.");
    await loadData();
  }

  async function toggleCategory(category: Category) {
    setMessage("");

    const response = await fetch(`/api/categorias-fornecedores/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !category.ativo }),
    });

    if (!response.ok) {
      setMessage("Erro ao atualizar o status da categoria.");
      return;
    }

    setMessage(`Categoria ${category.ativo ? "inativada" : "ativada"} com sucesso.`);
    await loadData();
  }

  if (me.manager.role !== "ADMIN") {
    return (
      <main className="container container-wide">
        <MainHeader title="Categorias de fornecedores" subtitle="Gestão das áreas de atuação" />
        <section className="card mt-4">
          <p>Acesso restrito ao perfil ADMIN.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container container-wide">
      <MainHeader title="Categorias de fornecedores" subtitle="Cadastre e organize áreas de atuação dos fornecedores." />

      <section className="card mt-4 space-y-4">
        <h2 className="text-lg font-semibold">Nova categoria</h2>
        <form onSubmit={createCategory} className="grid gap-3 md:grid-cols-3">
          <label>
            Nome da categoria
            <input
              value={form.nome}
              onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
              placeholder="Ex.: Manutenção Predial"
              required
            />
          </label>
          <label className="md:col-span-2">
            Descrição
            <input
              value={form.descricao}
              onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
              placeholder="Contexto opcional para facilitar a classificação"
            />
          </label>
          <div className="md:col-span-3 flex justify-end">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Cadastrando..." : "Cadastrar categoria"}
            </button>
          </div>
        </form>
      </section>

      <section className="card mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Categorias cadastradas</h2>
          <span className="text-sm text-slate-500">{filteredCategories.length} registro(s)</span>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou descrição"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="TODAS">Todos os status</option>
            <option value="ATIVAS">Somente ativas</option>
            <option value="INATIVAS">Somente inativas</option>
          </select>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("TODAS");
            }}
          >
            Limpar filtros
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCategories.map((category) => (
                <tr key={category.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{category.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{category.descricao || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${category.ativo
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"}`}
                    >
                      {category.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="btn-secondary" onClick={() => toggleCategory(category)}>
                      {category.ativo ? "Inativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredCategories.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Nenhuma categoria encontrada para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
