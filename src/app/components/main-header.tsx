"use client";

import { ReactNode } from "react";
import { AppHeader } from "@/app/components/app-header";

const DEFAULT_HEADER_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/notas", label: "Lançar nota", icon: "🧾" },
  { href: "/fornecedores", label: "Fornecedores", icon: "🏢" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙️" },
  { href: "/perfil", label: "Perfil", icon: "👤" }
] as const;

type MainHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function MainHeader({ title, subtitle, action }: MainHeaderProps) {
  return <AppHeader title={title} subtitle={subtitle} links={[...DEFAULT_HEADER_LINKS]} action={action} />;
}
