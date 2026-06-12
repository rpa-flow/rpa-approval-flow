import * as React from "react";
import { cn } from "@/lib/utils";
export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,.07)] backdrop-blur", className)} {...props} />;
export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col gap-1.5 p-5 sm:p-6", className)} {...props} />;
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("text-lg font-bold tracking-tight text-slate-950", className)} {...props} />;
export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn("text-sm leading-6 text-slate-500", className)} {...props} />;
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
