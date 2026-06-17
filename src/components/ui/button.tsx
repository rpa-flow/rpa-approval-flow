import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
};

const variants = {
  default: "bg-brand text-white shadow-sm hover:bg-brand-strong",
  secondary: "bg-secondary text-white shadow-sm hover:bg-emerald-600",
  outline: "border border-border bg-surface-container-lowest text-brand hover:bg-surface-container-low hover:text-brand-strong",
  ghost: "text-muted hover:bg-surface-container-low hover:text-text",
  destructive: "bg-danger text-white shadow-sm hover:bg-rose-700"
};
const sizes = {
  sm: "h-9 rounded px-3 text-xs",
  default: "h-10 rounded-md px-4 py-2 text-sm",
  lg: "h-11 rounded-md px-5 text-sm",
  icon: "h-10 w-10 rounded-md p-0"
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return <button className={cn("inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />;
}
