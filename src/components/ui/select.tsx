import * as React from "react";
import { cn } from "@/lib/utils";
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cn("flex h-10 w-full rounded-md border border-border bg-surface-container-lowest px-3 py-2 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />; }
