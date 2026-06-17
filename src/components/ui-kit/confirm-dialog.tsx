import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirmar", cancelLabel = "Cancelar", destructive, onConfirm, onCancel, children }: { open: boolean; title: string; description?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void; onCancel: () => void; children?: ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-card border border-border bg-surface-container-lowest p-6 shadow-elevated"><h2 className="text-lg font-semibold text-text">{title}</h2>{description && <p className="mt-2 text-sm leading-6 text-muted">{description}</p>}{children && <div className="mt-4">{children}</div>}<div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button><Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm}>{confirmLabel}</Button></div></div></div>;
}
