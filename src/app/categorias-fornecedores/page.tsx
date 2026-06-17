"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout, DataTable, FormField, PaginationControls, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PaginationMetadata } from "@/lib/pagination";

type Category = {
  id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  createdAt: string;
};

type Me = { manager: { role: "ADMIN" | "GESTOR" | "FORNECEDOR" } };
type CategoriesResponse = { items: Category[]; pagination: PaginationMetadata };

const EMPTY_FORM = { nome: "", descricao: "" };

export default function CategoriasFornecedoresPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({ page: 1, pageSize: 10, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODAS" | "ATIVAS" | "INATIVAS">("TODAS");
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
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
  }, [router]);

  const loadCategories = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });

    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "TODAS") params.set("status", statusFilter);

    setIsLoadingCategories(true);
    try {
      const categoriesRes = await fetch(`/api/categorias-fornecedores?${params.toString()}`);
      if (!categoriesRes.ok) {
        setMessage("Erro ao carregar categorias.");
        return;
      }

      const payload = await categoriesRes.json() as CategoriesResponse;
      setCategories(payload.items);
      setPagination(payload.pagination);
    } finally {
      setIsLoadingCategories(false);
    }
  }, [debouncedSearch, page, pageSize, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (me?.manager.role === "ADMIN") loadCategories();
  }, [loadCategories, me?.manager.role]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

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
    setPage(1);
    setMessage("Categoria criada com sucesso.");
    await loadCategories();
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
    await loadCategories();
  }

  if (me.manager.role !== "ADMIN") {
    return (
      <AppLayout>
        <MainHeader title="Categorias de fornecedores" subtitle="Gestão das áreas de atuação" />
        <section className="card mt-4">
          <p>Acesso restrito ao perfil ADMIN.</p>
        </section>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <MainHeader title="Categorias de fornecedores" subtitle="Cadastre e organize áreas de atuação dos fornecedores." />

      <SectionCard title="Nova categoria" description="Crie categorias para manter a classificação dos fornecedores consistente.">
        <form onSubmit={createCategory} className="grid gap-4 md:grid-cols-3">
          <FormField label="Nome da categoria">
            <Input
              value={form.nome}
              onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
              placeholder="Ex.: Manutenção Predial"
              required
            />
          </FormField>
          <FormField label="Descrição" className="md:col-span-2">
            <Input
              value={form.descricao}
              onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
              placeholder="Contexto opcional para facilitar a classificação"
            />
          </FormField>
          <div className="md:col-span-3 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Cadastrando..." : "Cadastrar categoria"}
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Categorias cadastradas"
        description="Pesquise e altere rapidamente a disponibilidade de cada categoria."
        actions={<span className="text-sm font-semibold text-slate-500">{isLoadingCategories ? "Carregando..." : `${pagination.total} registro(s)`}</span>}
      >
        <div className="mb-4 grid gap-3 rounded-md border border-border bg-surface-container-low p-3 md:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Buscar por nome ou descrição"
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
          data={categories}
          getRowKey={(category) => category.id}
          loading={isLoadingCategories}
          emptyTitle="Nenhuma categoria encontrada"
          emptyDescription="Ajuste os filtros ou cadastre uma nova categoria para começar."
          columns={[
            { key: "nome", header: "Nome", cell: (category) => <span className="font-semibold text-slate-900">{category.nome}</span> },
            { key: "descricao", header: "Descrição", cell: (category) => <span className="text-slate-600">{category.descricao || "—"}</span> },
            { key: "status", header: "Status", cell: (category) => <StatusBadge status={category.ativo ? "ATIVO" : "INATIVO"} label={category.ativo ? "Ativa" : "Inativa"} /> }
          ]}
          actions={(category) => (
            <Button type="button" variant="outline" size="sm" onClick={() => toggleCategory(category)}>
              {category.ativo ? "Inativar" : "Ativar"}
            </Button>
          )}
        />
        <PaginationControls
          pagination={pagination}
          itemLabel="registro(s)"
          loading={isLoadingCategories}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
        />
      </SectionCard>

      {message && <Alert variant={message.startsWith("Erro") ? "destructive" : "success"}>{message}</Alert>}
    </AppLayout>
  );
}
