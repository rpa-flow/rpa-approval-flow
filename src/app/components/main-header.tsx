"use client";

import { ComponentType, ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Building2, FileText, LayoutDashboard, LogOut, Settings, Tags, UserCircle, Users } from "lucide-react";
import { AppHeader } from "@/app/components/app-header";
import { Button } from "@/components/ui/button";

const DEFAULT_HEADER_LINKS: Array<{ href: string; label: string; icon: ComponentType<{ size?: number | string; className?: string }> }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/notas", label: "Lançar nota", icon: FileText },
  { href: "/fornecedores", label: "Fornecedores", icon: Building2 },
  { href: "/gestores", label: "Gestores", icon: Users },
  { href: "/categorias-fornecedores", label: "Categorias", icon: Tags },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/perfil", label: "Perfil", icon: UserCircle }
];

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

      if (link.href === "/gestores" || link.href === "/categorias-fornecedores") {
        return role === "ADMIN";
      }

      return true;
    });
  }, [role]);

  const logoutButton = (
    <Button
      variant="outline"
      className="bg-white/95"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
      }}
    >
      <LogOut size={16} />
      Sair
    </Button>
  );

  return <AppHeader title={title} subtitle={subtitle} links={[...filteredLinks]} action={action ?? logoutButton} />;
}
