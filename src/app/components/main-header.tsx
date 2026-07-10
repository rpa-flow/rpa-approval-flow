"use client";

import { ComponentType, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Building2, FileText, Truck, LayoutDashboard, Settings, Tags, UserCircle, Users } from "lucide-react";
import { AppHeader } from "@/app/components/app-header";

const DEFAULT_HEADER_LINKS: Array<{ href: string; label: string; icon: ComponentType<{ size?: number | string; className?: string }> }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/notas", label: "Lançar nota", icon: FileText },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/gestores", label: "Gestores", icon: Users },
  { href: "/categorias-fornecedores", label: "Categorias", icon: Tags },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/perfil", label: "Perfil", icon: UserCircle }
];

type ManagerRole = "ADMIN" | "GESTOR" | "FORNECEDOR";

type MainHeaderProps = {
  title: string;
  subtitle?: string;
};

export function MainHeader(_: MainHeaderProps) {
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

      if (link.href === "/gestores" || link.href === "/categorias-fornecedores" || link.href === "/empresas") {
        return role === "ADMIN";
      }

      return true;
    });
  }, [role]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return <AppHeader links={[...filteredLinks]} onLogout={logout} />;
}
