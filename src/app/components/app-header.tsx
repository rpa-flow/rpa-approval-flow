"use client";

import Link from "next/link";
import { useState } from "react";

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

  return (
    <header className="topbar card">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>

      <div className="header-menu">
        <button type="button" className="button-secondary menu-toggle" onClick={() => setOpen((v) => !v)}>
          ☰ Menu
        </button>
        <nav className={`actions-row nav-menu ${open ? "open" : ""}`}>
          {links.map((link) => (
            <Link key={`${link.href}-${link.label}`} href={link.href} className="button-secondary">
              {link.icon ? `${link.icon} ` : ""}
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
