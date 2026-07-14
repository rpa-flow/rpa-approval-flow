"use client";

import Link from "next/link";
import { ComponentType, FocusEvent, MouseEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { MinasLogoIcon } from "@/components/brand/minas-logo-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeaderLink = {
  href: string;
  label: string;
  icon?: ComponentType<{ size?: number | string; className?: string }>;
};

type AppHeaderProps = {
  links: HeaderLink[];
  onLogout: () => void | Promise<void>;
};

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_COLLAPSED_WIDTH = "4.75rem";

type SidebarTooltip = {
  label: string;
  left: number;
  top: number;
} | null;

export function AppHeader({ links, onLogout }: AppHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [sidebarTooltip, setSidebarTooltip] = useState<SidebarTooltip>(null);
  const pathname = usePathname();

  const collapsed = sidebarCollapsed && !hoverExpanded;

  useEffect(() => {
    const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
    document.documentElement.style.setProperty("--app-sidebar-width", width);
    if (!collapsed) {
      setSidebarTooltip(null);
    }
  }, [collapsed]);

  const showCollapsedTooltip = (label: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setSidebarTooltip({
      label,
      left: rect.right + 8,
      top: rect.top + rect.height / 2
    });
  };

  const renderNavItem = (link: HeaderLink, mode: "desktop" | "mobile") => {
    const Icon = link.icon;
    const isActive = pathname === link.href;
    const desktopCollapsed = mode === "desktop" && collapsed;

    return (
      <Link
        key={`${mode}-${link.href}`}
        href={link.href}
        title={desktopCollapsed ? link.label : undefined}
        className={cn(
          "group relative flex min-w-0 items-center gap-3 rounded-md text-sm font-semibold transition",
          mode === "desktop" ? "px-3 py-2.5" : "px-3 py-2",
          desktopCollapsed && "justify-center px-2",
          isActive ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-surface-container-lowest hover:text-text hover:shadow-sm"
        )}
        aria-current={isActive ? "page" : undefined}
        aria-label={desktopCollapsed ? link.label : undefined}
        onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
          if (desktopCollapsed) {
            showCollapsedTooltip(link.label, event.currentTarget);
          }
        }}
        onMouseLeave={() => setSidebarTooltip(null)}
        onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
          if (desktopCollapsed) {
            showCollapsedTooltip(link.label, event.currentTarget);
          }
        }}
        onBlur={() => setSidebarTooltip(null)}
        onClick={() => {
          setMobileOpen(false);
          setSidebarTooltip(null);
        }}
      >
        {Icon && <Icon size={18} className={cn("shrink-0", isActive ? "text-white" : "text-outline group-hover:text-secondary")} />}
        <span className={cn("min-w-0 truncate", desktopCollapsed && "sr-only")}>{link.label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-border bg-surface-container-lowest shadow-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.75rem]" : "w-64"
        )}
        aria-label="Navegação principal"
        onMouseEnter={() => {
          if (sidebarCollapsed) {
            setHoverExpanded(true);
          }
        }}
        onMouseLeave={() => {
          setHoverExpanded(false);
          setSidebarTooltip(null);
        }}
      >
        <div className={cn("flex min-h-20 items-center gap-3 border-b border-border px-3", collapsed && "justify-center")}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded bg-white p-1 shadow-sm ring-1 ring-border">
            <MinasLogoIcon className="h-9 w-9" />
          </div>
          <div className={cn("min-w-0", collapsed && "sr-only")}>
            <p className="truncate text-xs font-bold uppercase text-brand">Minas Mineração</p>
            <p className="truncate text-sm text-muted">RPA Approval Flow</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          {links.map((link) => renderNavItem(link, "desktop"))}
        </nav>

        <div className="grid gap-2 border-t border-border p-2">
          <Button
            type="button"
            size={collapsed ? "icon" : "default"}
            variant="outline"
            className={cn("w-full bg-surface-container-lowest", collapsed ? "justify-center px-0" : "justify-start")}
            aria-label="Sair"
            onClick={onLogout}
          >
            <LogOut size={18} />
            {!collapsed && <span>Sair</span>}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-10 w-full justify-center"
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-pressed={collapsed}
            onClick={() => {
              setSidebarCollapsed((current) => !current);
              setHoverExpanded(false);
            }}
          >
            <Menu size={18} />
          </Button>
        </div>
      </aside>

      {collapsed && sidebarTooltip && (
        <span
          className="pointer-events-none fixed z-[60] hidden -translate-y-1/2 whitespace-nowrap rounded bg-brand px-2.5 py-1.5 text-xs font-semibold text-white shadow-card lg:block"
          style={{ left: sidebarTooltip.left, top: sidebarTooltip.top }}
        >
          {sidebarTooltip.label}
        </span>
      )}

      <header className="sticky top-0 z-40 mb-4 rounded-b-md border border-t-0 border-border bg-surface-container-lowest/95 px-2 py-3 shadow-card backdrop-blur-xl lg:hidden">
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border-l-4 border-secondary bg-brand p-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded bg-white p-1 shadow-sm ring-1 ring-white/25">
                <MinasLogoIcon className="h-9 w-9" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold uppercase text-surface-container-low">Minas Mineração</p>
                <p className="truncate text-sm text-surface-container-high">RPA Approval Flow</p>
              </div>
            </div>
            <Button type="button" size="icon" variant="secondary" className="bg-white/10 text-white hover:bg-white/20" aria-expanded={mobileOpen} aria-controls="mobile-main-navigation" onClick={() => setMobileOpen((prev) => !prev)}>
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </Button>
          </div>

          {mobileOpen && (
            <nav id="mobile-main-navigation" className="grid gap-1 rounded-md border border-border bg-surface-container-low p-2 shadow-sm lg:hidden" aria-label="Navegação mobile">
              {links.map((link) => renderNavItem(link, "mobile"))}
              <div className="mt-2 border-t border-border pt-2">
                <Button type="button" variant="outline" className="w-full justify-start bg-surface-container-lowest" onClick={onLogout}>
                  <LogOut size={18} />
                  Sair
                </Button>
              </div>
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
