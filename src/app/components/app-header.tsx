"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";

type HeaderLink = {
  href: string;
  label: string;
  icon?: string;
};

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  links: HeaderLink[];
  action?: ReactNode;
};

export function AppHeader({ title, subtitle, links, action }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="card mt-2 overflow-hidden">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Plataforma de aprovação</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600">{subtitle}</p>}
          </div>

          <div className="flex justify-end lg:pt-1">{action}</div>
        </div>

        <nav className="hidden rounded-xl border border-slate-200 bg-slate-50 p-1 md:flex md:flex-wrap md:items-center md:gap-1" aria-label="Navegação principal">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-white hover:text-slate-900"
                }`}
              >
                {link.icon && <span className="text-xs">{link.icon}</span>}
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="md:hidden">
          <button className="button-secondary w-full" type="button" onClick={() => setOpen((prev) => !prev)}>
            {open ? "Fechar menu" : "Abrir menu"}
          </button>
          {open && (
            <nav className="mt-2 grid gap-1 rounded-xl border border-slate-200 bg-white p-2" aria-label="Navegação mobile">
              {links.map((link) => (
                <Link
                  key={`${link.href}-mobile`}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm ${pathname === link.href ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700"}`}
                  onClick={() => setOpen(false)}
                >
                  {link.icon ? `${link.icon} ` : ""}
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
