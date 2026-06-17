import { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function AppLayout({ children, className, ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <main className={cn("app-layout container container-wide min-w-0 space-y-4", className)} {...props}>
      {children}
    </main>
  );
}
