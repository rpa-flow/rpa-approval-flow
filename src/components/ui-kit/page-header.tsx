import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase text-brand">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold text-text sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:justify-end lg:pt-1">{actions}</div>}
    </div>
  );
}
