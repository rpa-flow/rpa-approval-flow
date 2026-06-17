import { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-outline bg-surface-container-low p-8 text-center"><div className="mb-3 rounded bg-surface-container-lowest p-3 text-outline shadow-sm">{icon ?? <Inbox size={28} />}</div><h3 className="text-base font-semibold text-text">{title}</h3>{description && <p className="mt-1 max-w-md text-sm leading-6 text-muted">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
