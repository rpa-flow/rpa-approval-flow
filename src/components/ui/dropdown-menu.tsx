import { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function DropdownMenuContent({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn("z-50 min-w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl", className)}>{children}</div>; }
export function DropdownMenuItem({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50", className)} {...props}>{children}</button>; }
