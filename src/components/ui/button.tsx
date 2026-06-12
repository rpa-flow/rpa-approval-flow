import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
};

const variants = {
  default: "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950",
  ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
  destructive: "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
};
const sizes = {
  sm: "h-9 rounded-xl px-3 text-xs",
  default: "h-10 rounded-xl px-4 py-2 text-sm",
  lg: "h-11 rounded-2xl px-5 text-sm",
  icon: "h-10 w-10 rounded-xl p-0"
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return <button className={cn("inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />;
}
