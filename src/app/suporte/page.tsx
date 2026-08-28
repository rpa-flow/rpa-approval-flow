import { redirect } from "next/navigation";
import { getSessionManager } from "@/lib/auth";
import { SupportDashboard } from "./support-dashboard";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const manager = await getSessionManager();

  if (!manager) redirect("/login");
  if (manager.role !== "ADMIN") redirect("/dashboard");

  return <SupportDashboard />;
}
