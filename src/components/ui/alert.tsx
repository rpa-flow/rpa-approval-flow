import * as React from "react";
import { cn } from "@/lib/utils";
export function Alert({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "success" | "warning" }) {
 const map={default:"border-blue-200 bg-blue-50 text-blue-900",destructive:"border-rose-200 bg-rose-50 text-rose-900",success:"border-emerald-200 bg-emerald-50 text-emerald-900",warning:"border-amber-200 bg-amber-50 text-amber-900"};
 return <div role="status" className={cn("rounded-2xl border p-4 text-sm font-medium", map[variant], className)} {...props}/>;
}
