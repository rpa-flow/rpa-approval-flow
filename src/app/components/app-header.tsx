"use client";

import Link from "next/link";
import { ComponentType, ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { MinasLogoIcon } from "@/components/brand/minas-logo-icon";
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
          "group inline-flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition",
          isActive ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-surface-container-lowest hover:text-text hover:shadow-sm"
        )}
        aria-current={isActive ? "page" : undefined}
        onClick={() => setOpen(false)}
      >
        {Icon && <Icon size={17} className={cn(isActive ? "text-white" : "text-outline group-hover:text-secondary")} />}
        <span className="truncate">{link.label}</span>
      </Link>
    );
  });

  return (
    <header className="sticky top-0 z-40 mb-4 rounded-b-md border border-t-0 border-border bg-surface-container-lowest/95 px-2 py-3 shadow-card backdrop-blur-xl sm:static sm:rounded-md sm:border sm:p-4">
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border-l-4 border-secondary bg-brand p-3 text-white sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-white p-1 shadow-sm ring-1 ring-white/25">
              <MinasLogoIcon className="h-10 w-10" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase text-surface-container-low">Minas Mineração</p>
              <p className="truncate text-sm text-surface-container-high">RPA Approval Flow</p>
            </div>
          </div>
          <div className="hidden sm:block">{action}</div>
          <Button type="button" size="icon" variant="secondary" className="bg-white/10 text-white hover:bg-white/20 sm:hidden" aria-expanded={open} aria-controls="mobile-main-navigation" onClick={() => setOpen((prev) => !prev)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>

        <PageHeader title={title} description={subtitle} actions={<div className="sm:hidden">{action}</div>} />

        <nav className="hidden rounded-md border border-border bg-surface-container-low p-1.5 md:flex md:flex-wrap md:items-center md:gap-1" aria-label="Navegação principal">
          {navItems}
        </nav>

        {open && (
          <nav id="mobile-main-navigation" className="grid gap-1 rounded-md border border-border bg-surface-container-low p-2 shadow-sm md:hidden" aria-label="Navegação mobile">
            {navItems}
          </nav>
        )}
      </div>
    </header>
  );
}
