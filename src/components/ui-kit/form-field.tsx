import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
export function FormField({ label, description, error, children, className }: { label: string; description?: string; error?: string; children: ReactNode; className?: string }) { return <div className={cn("grid gap-2", className)}><Label>{label}</Label>{children}{description && <p className="text-xs leading-5 text-slate-500">{description}</p>}{error && <p className="text-xs font-semibold text-rose-600">{error}</p>}</div>; }
