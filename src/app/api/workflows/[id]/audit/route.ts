import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode consultar esta auditoria." }, { status: 403 });
  const workflow = await prisma.approvalWorkflow.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!workflow) return NextResponse.json({ error: "Workflow não encontrado." }, { status: 404 });
  const events = await prisma.workflowConfigurationAudit.findMany({ where: { workflowId: workflow.id }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ events });
}
