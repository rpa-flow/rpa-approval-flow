"use client";

import Link from "next/link";
import { useState } from "react";
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
};

export function AppHeader({ title, subtitle, links }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const normalizedLinks = links.some((link) => link.href === "/configuracoes")
    ? links
    : [...links, { href: "/configuracoes", label: "Configurações", icon: "⚙️" }];

  return (
    <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 line-clamp-2 max-w-5xl text-sm leading-relaxed text-slate-600" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>

        <nav className="hidden max-w-[560px] flex-wrap justify-end gap-2 xl:flex">
          {normalizedLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                }`}
              >
                {link.icon ? <span className="text-xs opacity-80">{link.icon}</span> : null}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="relative xl:hidden">
          <button
            type="button"
            className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setOpen((v) => !v)}
          >
            ☰ Menu
          </button>
          <nav
            className={`absolute right-0 top-[calc(100%+0.45rem)] z-20 min-w-56 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${
              open ? "flex" : "hidden"
            }`}
          >
            {normalizedLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={`${link.href}-${link.label}-mobile`}
                  href={link.href}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {link.icon ? <span className="text-xs opacity-80">{link.icon}</span> : null}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
