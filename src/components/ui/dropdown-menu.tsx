import { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function DropdownMenuContent({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn("z-50 min-w-44 rounded-md border border-border bg-surface-container-lowest p-1.5 shadow-elevated", className)}>{children}</div>; }
export function DropdownMenuItem({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={cn("flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-surface-container-low hover:text-text", className)} {...props}>{children}</button>; }
