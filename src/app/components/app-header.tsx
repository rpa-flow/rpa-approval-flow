"use client";

import Link from "next/link";
import { ComponentType, ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { cn } from "@/lib/utils";

type HeaderLink = {
  href: string;
  label: string;
  icon?: ComponentType<{ size?: number | string; className?: string }>;
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

  const navItems = links.map((link) => {
    const Icon = link.icon;
    const isActive = pathname === link.href;
    return (
      <Link
        key={link.href}
        href={link.href}
        className={cn(
          "group inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition",
          isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm"
        )}
        aria-current={isActive ? "page" : undefined}
        onClick={() => setOpen(false)}
      >
        {Icon && <Icon size={17} className={cn(isActive ? "text-white" : "text-slate-400 group-hover:text-blue-600")} />}
        {link.label}
      </Link>
    );
  });

  return (
    <header className="sticky top-0 z-40 -mx-3 mb-4 rounded-b-[2rem] border border-t-0 border-slate-200/80 bg-white/90 px-3 py-3 shadow-[0_18px_40px_rgba(15,23,42,.08)] backdrop-blur-xl sm:static sm:mx-0 sm:rounded-[2rem] sm:border sm:p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4 text-white sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <ShieldCheck size={22} />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-100"><Sparkles size={14} /> Plataforma de aprovação</p>
              <p className="truncate text-sm text-slate-300">RPA Approval Flow</p>
            </div>
          </div>
          <div className="hidden sm:block">{action}</div>
          <Button type="button" size="icon" variant="secondary" className="bg-white/10 text-white hover:bg-white/20 sm:hidden" aria-expanded={open} aria-controls="mobile-main-navigation" onClick={() => setOpen((prev) => !prev)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>

        <PageHeader title={title} description={subtitle} actions={<div className="sm:hidden">{action}</div>} />

        <nav className="hidden rounded-3xl border border-slate-200 bg-slate-50/80 p-1.5 md:flex md:flex-wrap md:items-center md:gap-1" aria-label="Navegação principal">
          {navItems}
        </nav>

        {open && (
          <nav id="mobile-main-navigation" className="grid gap-1 rounded-3xl border border-slate-200 bg-slate-50 p-2 shadow-sm md:hidden" aria-label="Navegação mobile">
            {navItems}
          </nav>
        )}
      </div>
    </header>
  );
}
