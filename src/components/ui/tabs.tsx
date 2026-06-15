import { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function TabsList({ children, className, ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex w-full flex-wrap rounded-2xl border border-slate-200 bg-slate-100 p-1 sm:inline-flex sm:w-auto", className)} {...props}>{children}</div>; }
export function TabsTrigger({ active, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) { return <button className={cn("min-w-0 flex-1 rounded-xl px-3 py-2 text-sm font-bold transition sm:flex-none sm:px-4", active ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-950", className)} {...props}>{children}</button>; }
