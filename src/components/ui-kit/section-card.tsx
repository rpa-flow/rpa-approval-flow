import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionCard({ title, description, actions, children, className, contentClassName }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string; contentClassName?: string }) {
  return (
    <Card className={cn("mt-4", className)}>
      {(title || description || actions) && (
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b border-border">
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(title || description || actions ? "pt-5 sm:pt-6" : "pt-5 sm:pt-6", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
