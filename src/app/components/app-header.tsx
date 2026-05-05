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

  return (
    <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
        </div>

        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen((v) => !v)}
          >
            ☰ Menu
          </button>
          <nav
            className={`absolute right-0 top-[calc(100%+0.45rem)] z-20 min-w-56 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${
              open ? "flex" : "hidden"
            }`}
          >
            {links.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${pathname === link.href ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                onClick={() => setOpen(false)}
              >
                {link.icon ? `${link.icon} ` : ""}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
