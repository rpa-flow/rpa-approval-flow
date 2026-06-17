"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/components/main-header";
import { AppLayout, PaginationControls } from "@/components/ui-kit";
import type { PaginationMetadata } from "@/lib/pagination";

type Me = {
  manager: {
    role: "ADMIN" | "GESTOR";
  };
};

type SupplierListItem = {
  id: string;
  nome: string;
  cnpj: string | null;
  managers: Array<{
    id: string;
    nome: string;
    email: string;
    role: "ADMIN" | "GESTOR";
    ativo: boolean;
  }>;
};
type SuppliersResponse = { items: SupplierListItem[]; pagination: PaginationMetadata };

export default function CadastrosPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({ page: 1, pageSize: 10, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    nome: "",
    cnpj: "",
    managerNome: "",
    managerEmail: "",
    managerSenha: ""
  });
  const [message, setMessage] = useState("");
  const router = useRouter();

  const loadData = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    const meData = (await meRes.json()) as Me;
    if (meData.manager.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    setMe(meData);
  }, [router]);

  const loadSuppliers = useCallback(async () => {
    setIsLoadingSuppliers(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      const suppliersRes = await fetch(`/api/fornecedores?${params.toString()}`);
      if (suppliersRes.status === 401) return router.push("/login");
      if (suppliersRes.status === 403) return router.push("/dashboard");
      if (suppliersRes.ok) {
        const payload = (await suppliersRes.json()) as SuppliersResponse;
        setSuppliers(payload.items);
        setPagination(payload.pagination);
      }
    } finally {
      setIsLoadingSuppliers(false);
    }
  }, [page, pageSize, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (me?.manager.role === "ADMIN") loadSuppliers();
  }, [loadSuppliers, me?.manager.role]);

  async function cadastrarFornecedor(e: React.FormEvent) {
    e.preventDefault();
    const cnpjDigits = supplierForm.cnpj.replace(/\D/g, "");

    const res = await fetch("/api/fornecedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: supplierForm.nome,
        cnpj: cnpjDigits || undefined,
        managers: [
          {
            nome: supplierForm.managerNome,
            email: supplierForm.managerEmail,
            senha: supplierForm.managerSenha
          }
        ]
      })
    });

    if (!res.ok) {
      setMessage("Erro ao cadastrar fornecedor/gestor. Verifique os dados.");
      return;
    }

    setSupplierForm({
      nome: "",
      cnpj: "",
      managerNome: "",
      managerEmail: "",
      managerSenha: ""
    });

    setMessage("Fornecedor e gestor cadastrados com sucesso.");
    setPage(1);
    await loadSuppliers();
  }

  if (!me || me.manager.role !== "ADMIN") {
    return null;
  }

  return (
    <AppLayout>
      <MainHeader
        title="Cadastros administrativos"
        subtitle="Cadastre fornecedores e gestores para operação diária."
      />

      <section className="card">
        <h2>Novo fornecedor + gestor</h2>
        <form onSubmit={cadastrarFornecedor} className="form-grid">
          <label>
            Nome do fornecedor
            <input
              required
              minLength={2}
              placeholder="Fornecedor ABC"
              value={supplierForm.nome}
              onChange={(e) => setSupplierForm((p) => ({ ...p, nome: e.target.value }))}
            />
          </label>
          <label>
            CNPJ (opcional)
            <input
              placeholder="12345678000199"
              value={supplierForm.cnpj}
              onChange={(e) => setSupplierForm((p) => ({ ...p, cnpj: e.target.value }))}
            />
          </label>
          <label>
            Nome do gestor
            <input
              required
              minLength={2}
              placeholder="Maria Gestora"
              value={supplierForm.managerNome}
              onChange={(e) => setSupplierForm((p) => ({ ...p, managerNome: e.target.value }))}
            />
          </label>
          <label>
            E-mail do gestor
            <input
              required
              type="email"
              placeholder="gestor@empresa.com"
              value={supplierForm.managerEmail}
              onChange={(e) => setSupplierForm((p) => ({ ...p, managerEmail: e.target.value }))}
            />
          </label>
          <label>
            Senha inicial do gestor
            <input
              required
              minLength={6}
              type="password"
              placeholder="mínimo 6 caracteres"
              value={supplierForm.managerSenha}
              onChange={(e) => setSupplierForm((p) => ({ ...p, managerSenha: e.target.value }))}
            />
          </label>
          <button type="submit">Cadastrar fornecedor e gestor</button>
        </form>
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2>Fornecedores cadastrados</h2>
          <span className="badge badge-slate">{isLoadingSuppliers ? "Carregando..." : `${pagination.total} fornecedor(es)`}</span>
        </div>
        <ul className="list">
          {suppliers.map((supplier) => (
            <li key={supplier.id}>
              <strong>{supplier.nome}</strong> {supplier.cnpj ? `(${supplier.cnpj})` : "(sem CNPJ)"} — gestores:{" "}
              {supplier.managers.map((manager) => `${manager.nome} <${manager.email}>`).join(", ")}
            </li>
          ))}
          {suppliers.length === 0 && <li>{isLoadingSuppliers ? "Carregando fornecedores..." : "Nenhum fornecedor cadastrado ainda."}</li>}
        </ul>
        <PaginationControls
          pagination={pagination}
          itemLabel="fornecedor(es)"
          loading={isLoadingSuppliers}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
        />
      </section>

      {message && <p className="message">{message}</p>}
    </AppLayout>
  );
}
