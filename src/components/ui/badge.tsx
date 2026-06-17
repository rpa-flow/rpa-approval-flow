import * as React from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }) {
 const map={default:"bg-brand-soft text-brand-strong ring-brand/20",secondary:"bg-surface-container text-muted ring-border",success:"bg-emerald-100 text-emerald-900 ring-emerald-200",warning:"bg-amber-100 text-amber-900 ring-amber-200",destructive:"bg-rose-100 text-rose-800 ring-rose-200",outline:"bg-surface-container-lowest text-muted ring-border"};
 return <span className={cn("inline-flex max-w-max items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset", map[variant], className)} {...props}/>;
}
