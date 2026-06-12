import { Alert } from "@/components/ui/alert";
export function Toast({ message, variant = "default" }: { message: string; variant?: "default" | "destructive" | "success" | "warning" }) { if (!message) return null; return <Alert variant={variant}>{message}</Alert>; }
