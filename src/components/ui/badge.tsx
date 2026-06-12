import * as React from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }) {
 const map={default:"bg-blue-50 text-blue-700 ring-blue-200",secondary:"bg-slate-100 text-slate-700 ring-slate-200",success:"bg-emerald-50 text-emerald-700 ring-emerald-200",warning:"bg-amber-50 text-amber-700 ring-amber-200",destructive:"bg-rose-50 text-rose-700 ring-rose-200",outline:"bg-white text-slate-700 ring-slate-200"};
 return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset", map[variant], className)} {...props}/>;
}
