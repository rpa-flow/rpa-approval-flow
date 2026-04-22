"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = {
  manager: {
    role: "ADMIN" | "GESTOR";
    suppliers: Array<{
      supplierId: string;
      supplierName: string;
    }>;
  };
};

export default function FornecedoresPage() {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadMe() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }

      const meData = (await meRes.json()) as Me;
      setMe(meData);

      if (meData.manager.role === "ADMIN") {
        router.push("/cadastros");
      }
    }

    loadMe();
  }, [router]);

  if (!me) return null;
  if (me.manager.role === "ADMIN") return null;

  return (
    <main className="container container-wide">
      <header className="topbar card">
        <div>
          <h1>Fornecedores</h1>
          <p className="muted">Visualização dos fornecedores vinculados ao seu usuário.</p>
        </div>
        <div className="actions-row">
          <Link href="/dashboard" className="button-secondary">
            Dashboard
          </Link>
          <Link href="/configuracoes" className="button-secondary">
            Configurações
          </Link>
        </div>
      </header>

      <section className="card">
        <h2>Meus fornecedores</h2>
        <ul className="list">
          {me.manager.suppliers.map((supplier) => (
            <li key={supplier.supplierId}>
              <strong>{supplier.supplierName}</strong>
            </li>
          ))}
          {me.manager.suppliers.length === 0 && <li>Você ainda não possui fornecedores vinculados.</li>}
        </ul>
      </section>

      <section className="card info-banner">
        Para cadastrar novos fornecedores/gestores, solicite acesso de <strong>ADMIN</strong>.
      </section>
    </main>
  );
}
