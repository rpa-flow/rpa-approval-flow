import { Badge } from "@/components/ui/badge";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  AGUARDANDO_APROVACAO: { label: "Aguardando aprovação", variant: "warning" },
  APROVADO: { label: "Aprovado", variant: "success" },
  RECUSADO: { label: "Recusado", variant: "destructive" },
  PROCESSADO: { label: "Processado", variant: "default" },
  DADOS_INCONSISTENTES: { label: "Dados inconsistentes", variant: "warning" },
  ATIVO: { label: "Ativo", variant: "success" },
  INATIVO: { label: "Inativo", variant: "secondary" },
  ADMIN: { label: "Administrador", variant: "default" },
  GESTOR: { label: "Gestor", variant: "secondary" },
  FORNECEDOR: { label: "Fornecedor", variant: "outline" }
};
export function StatusBadge({ status, label }: { status: string; label?: string }) { const item = statusMap[status] ?? { label: label ?? status.replaceAll("_", " "), variant: "secondary" as BadgeVariant }; return <Badge variant={item.variant}>{label ?? item.label}</Badge>; }
