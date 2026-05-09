"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";

const DEFAULT_HEADER_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/notas", label: "Lançar nota", icon: "🧾" },
  { href: "/fornecedores", label: "Fornecedores", icon: "🏢" },
  { href: "/categorias-fornecedores", label: "Categorias", icon: "🗂️" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙️" },
  { href: "/perfil", label: "Perfil", icon: "👤" }
] as const;

type ManagerRole = "ADMIN" | "GESTOR" | "FORNECEDOR";

type MainHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function MainHeader({ title, subtitle, action }: MainHeaderProps) {
  const [role, setRole] = useState<ManagerRole | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function loadRole() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) setRole(data.manager.role as ManagerRole);
      } catch {
        // Mantém fallback sem o link de lançamento para perfis não conhecidos.
      }
    }

    loadRole();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLinks = useMemo(() => {
    return DEFAULT_HEADER_LINKS.filter((link) => {
      if (link.href === "/notas") {
        return role === "ADMIN" || role === "FORNECEDOR";
      }

      if (link.href === "/categorias-fornecedores") {
        return role === "ADMIN";
      }

      return true;
    });
  }, [role]);

  const logoutButton = (
    <button
      className="button-secondary"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
      }}
    >
      Sair
    </button>
  );

  return <AppHeader title={title} subtitle={subtitle} links={[...filteredLinks]} action={action ?? logoutButton} />;
}
