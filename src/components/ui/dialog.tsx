import { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Dialog({ open, title, description, children, onOpenChange }: { open: boolean; title?: string; description?: string; children: ReactNode; onOpenChange?: (open: boolean) => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-card border border-border bg-surface-container-lowest p-6 shadow-elevated">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>{title && <h2 className="text-lg font-semibold text-text">{title}</h2>}{description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}</div>
          {onOpenChange && <Button type="button" size="icon" variant="ghost" onClick={() => onOpenChange(false)}><X size={18}/></Button>}
        </div>
        {children}
      </div>
    </div>
  );
}
