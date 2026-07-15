import { StatusBadge } from "@/components/ui-kit";

const labels: Record<string, string> = {
  Healthy: "Saudável",
  HasGaps: "Com gaps",
  HasErrors: "Com erros",
  NeverScanned: "Nunca processada",
  Downloaded: "Baixado",
  PendingGap: "Gap pendente",
  RetryError: "Erro",
  IgnoredByRule: "Ignorado"
};

export function NfseProcessingStatusBadge({ status }: { status?: string | null }) {
  const safeStatus = status ?? "NeverScanned";
  return <StatusBadge status={safeStatus} label={labels[safeStatus] ?? safeStatus} />;
}
