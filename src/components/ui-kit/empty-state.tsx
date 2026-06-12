import { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center"><div className="mb-3 rounded-2xl bg-white p-3 text-slate-400 shadow-sm">{icon ?? <Inbox size={28} />}</div><h3 className="text-base font-bold text-slate-900">{title}</h3>{description && <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
