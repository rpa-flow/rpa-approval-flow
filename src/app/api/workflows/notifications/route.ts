import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode consultar notificações." }, { status: 403 });
  const items = await prisma.workflowNotification.findMany({
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, recipient: true, status: true, createdAt: true, attempts: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, error: true, createdAt: true } }, task: { select: { step: { select: { name: true } }, execution: { select: { invoice: { select: { numeroNota: true } } } } } } }
  });
  return NextResponse.json({ items });
}
