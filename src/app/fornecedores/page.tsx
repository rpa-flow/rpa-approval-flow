"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";

type Me = {
  manager: {
    role: "ADMIN" | "GESTOR";
    suppliers: Array<{
      supplierId: string;
      supplierName: string;
    }>;
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

type ManagerItem = {
  id: string;
  nome: string;
  email: string;
  role: "ADMIN" | "GESTOR";
  ativo: boolean;
};

export default function FornecedoresPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: "",
    cnpj: "",
    managerNome: "",
    managerEmail: "",
    managerSenha: ""
  });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    cnpj: "",
    selectedManagerEmail: "",
    createNewManager: false,
    addManagerNome: "",
    addManagerEmail: "",
    addManagerSenha: ""
  });
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function loadData() {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    const meData = (await meRes.json()) as Me;
    setMe(meData);

    if (meData.manager.role === "ADMIN") {
      const suppliersRes = await fetch("/api/fornecedores");
      if (suppliersRes.ok) {
        const payload = (await suppliersRes.json()) as SupplierListItem[];
        setSuppliers(payload);
      }

      const managersRes = await fetch("/api/gestores");
      if (managersRes.ok) {
        const payload = (await managersRes.json()) as ManagerItem[];
        setManagers(payload);
      }
    }
  }

  useEffect(() => {
    loadData();
  }, [router]);

  if (!me) return null;

  async function cadastrarFornecedor(e: React.FormEvent) {
    e.preventDefault();
    const cnpjDigits = createForm.cnpj.replace(/\D/g, "");

    const res = await fetch("/api/fornecedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: createForm.nome,
        cnpj: cnpjDigits || undefined,
        managers: [
          {
            nome: createForm.managerNome,
            email: createForm.managerEmail,
            senha: createForm.managerSenha
          }
        ]
      })
    });

    if (!res.ok) {
      setMessage("Erro ao cadastrar fornecedor/gestor. Verifique os dados.");
      return;
    }

    setCreateForm({
      nome: "",
      cnpj: "",
      managerNome: "",
      managerEmail: "",
      managerSenha: ""
    });
    setShowCreateForm(false);
    setMessage("Fornecedor e gestor cadastrados com sucesso.");
    await loadData();
  }

  function iniciarEdicao(supplier: SupplierListItem) {
    setEditingSupplierId(supplier.id);
    setEditForm({
      nome: supplier.nome,
      cnpj: supplier.cnpj ?? "",
      selectedManagerEmail: "",
      createNewManager: false,
      addManagerNome: "",
      addManagerEmail: "",
      addManagerSenha: ""
    });
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSupplierId) return;

    const cnpjDigits = editForm.cnpj.replace(/\D/g, "");
    const res = await fetch(`/api/fornecedores/${editingSupplierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: editForm.nome,
        cnpj: cnpjDigits || null,
        addManager: editForm.createNewManager
          ? {
              nome: editForm.addManagerNome || undefined,
              email: editForm.addManagerEmail,
              senha: editForm.addManagerSenha || undefined
            }
          : editForm.selectedManagerEmail
            ? {
                email: editForm.selectedManagerEmail
              }
          : undefined
      })
    });

    if (!res.ok) {
      setMessage("Erro ao salvar edição do fornecedor.");
      return;
    }

    setEditingSupplierId(null);
    setMessage("Fornecedor atualizado com sucesso.");
    await loadData();
  }

  return (
    <main className="container container-wide">
      <AppHeader
        title="Fornecedores"
        subtitle="Visualização e administração de fornecedores."
        links={[
          { href: "/dashboard", label: "Dashboard", icon: "📊" },
          { href: "/fornecedores", label: "Fornecedores", icon: "🏢" },
          { href: "/configuracoes", label: "Configurações", icon: "⚙️" },
          { href: "/perfil", label: "Perfil", icon: "👤" }
        ]}
      />

      {me.manager.role === "ADMIN" ? (
        <>
          <section className="card">
            <div className="filters-header">
              <h2>Fornecedores cadastrados</h2>
              <button type="button" onClick={() => setShowCreateForm((v) => !v)}>
                {showCreateForm ? "Cancelar" : "Adicionar novo fornecedor"}
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th>CNPJ</th>
                    <th>Gestores</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>{supplier.nome}</td>
                      <td>{supplier.cnpj ?? "—"}</td>
                      <td>{supplier.managers.map((m) => m.nome).join(", ") || "—"}</td>
                      <td>
                        <button type="button" className="chip" onClick={() => iniciarEdicao(supplier)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!suppliers.length && (
                    <tr>
                      <td colSpan={4} className="muted center">Nenhum fornecedor cadastrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {showCreateForm && (
            <section className="card">
              <h2>Novo fornecedor + gestor</h2>
              <form onSubmit={cadastrarFornecedor} className="form-grid">
                <label>
                  Nome do fornecedor
                  <input
                    required
                    minLength={2}
                    placeholder="Fornecedor ABC"
                    value={createForm.nome}
                    onChange={(e) => setCreateForm((p) => ({ ...p, nome: e.target.value }))}
                  />
                </label>
                <label>
                  CNPJ (opcional)
                  <input
                    placeholder="12345678000199"
                    value={createForm.cnpj}
                    onChange={(e) => setCreateForm((p) => ({ ...p, cnpj: e.target.value }))}
                  />
                </label>
                <label>
                  Nome do gestor
                  <input
                    required
                    minLength={2}
                    placeholder="Maria Gestora"
                    value={createForm.managerNome}
                    onChange={(e) => setCreateForm((p) => ({ ...p, managerNome: e.target.value }))}
                  />
                </label>
                <label>
                  E-mail do gestor
                  <input
                    required
                    type="email"
                    placeholder="gestor@empresa.com"
                    value={createForm.managerEmail}
                    onChange={(e) => setCreateForm((p) => ({ ...p, managerEmail: e.target.value }))}
                  />
                </label>
                <label>
                  Senha inicial do gestor
                  <input
                    required
                    minLength={6}
                    type="password"
                    placeholder="mínimo 6 caracteres"
                    value={createForm.managerSenha}
                    onChange={(e) => setCreateForm((p) => ({ ...p, managerSenha: e.target.value }))}
                  />
                </label>
                <button type="submit">Cadastrar fornecedor e gestor</button>
              </form>
            </section>
          )}

          {editingSupplierId && (
            <section className="card">
              <h2>Editar fornecedor</h2>
              <form onSubmit={salvarEdicao} className="form-grid">
                <label>
                  Nome do fornecedor
                  <input
                    required
                    minLength={2}
                    value={editForm.nome}
                    onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))}
                  />
                </label>
                <label>
                  CNPJ
                  <input
                    placeholder="12345678000199"
                    value={editForm.cnpj}
                    onChange={(e) => setEditForm((p) => ({ ...p, cnpj: e.target.value }))}
                  />
                </label>
                <h3>Vincular gestor ao fornecedor (opcional)</h3>
                <p className="muted small">
                  Selecione um gestor existente ou marque a opção para criar um novo.
                </p>
                <label>
                  Gestores existentes
                  <select
                    value={editForm.selectedManagerEmail}
                    onChange={(e) => setEditForm((p) => ({ ...p, selectedManagerEmail: e.target.value }))}
                    disabled={editForm.createNewManager}
                  >
                    <option value="">Selecione um gestor existente</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.email}>
                        {manager.nome} ({manager.email})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={editForm.createNewManager}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        createNewManager: e.target.checked,
                        selectedManagerEmail: e.target.checked ? "" : p.selectedManagerEmail
                      }))
                    }
                  />
                  Criar e vincular novo gestor
                </label>
                <label>
                  E-mail do gestor
                  <input
                    type="email"
                    placeholder="gestor@empresa.com"
                    value={editForm.addManagerEmail}
                    onChange={(e) => setEditForm((p) => ({ ...p, addManagerEmail: e.target.value }))}
                    disabled={!editForm.createNewManager}
                  />
                </label>
                <label>
                  Nome do gestor (novo)
                  <input
                    placeholder="Maria Gestora"
                    value={editForm.addManagerNome}
                    onChange={(e) => setEditForm((p) => ({ ...p, addManagerNome: e.target.value }))}
                    disabled={!editForm.createNewManager}
                  />
                </label>
                <label>
                  Senha inicial (novo)
                  <input
                    type="password"
                    minLength={6}
                    placeholder="mínimo 6 caracteres"
                    value={editForm.addManagerSenha}
                    onChange={(e) => setEditForm((p) => ({ ...p, addManagerSenha: e.target.value }))}
                    disabled={!editForm.createNewManager}
                  />
                </label>
                <div className="actions-row">
                  <button type="submit">Salvar alterações</button>
                  <button type="button" className="button-secondary" onClick={() => setEditingSupplierId(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="card">
            <h2>Meus fornecedores</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {me.manager.suppliers.map((supplier) => (
                    <tr key={supplier.supplierId}>
                      <td>{supplier.supplierName}</td>
                      <td>{supplier.supplierId}</td>
                    </tr>
                  ))}
                  {!me.manager.suppliers.length && (
                    <tr>
                      <td colSpan={2} className="muted center">Você ainda não possui fornecedores vinculados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card info-banner">
            Para cadastrar ou editar fornecedores, solicite acesso de <strong>ADMIN</strong>.
          </section>
        </>
      )}

      {message && <p className="message">{message}</p>}
    </main>
  );
}
