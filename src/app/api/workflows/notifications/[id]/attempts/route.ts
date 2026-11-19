import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaginationMetadata, getPaginationParams } from "@/lib/pagination";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode consultar tentativas." }, { status: 403 });
  const notification = await prisma.workflowNotification.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!notification) return NextResponse.json({ error: "Aviso não encontrado." }, { status: 404 });
  const { page, pageSize } = getPaginationParams(request.nextUrl.searchParams);
  const total = await prisma.workflowNotificationAttempt.count({ where: { notificationId: params.id } });
  const pagination = getPaginationMetadata(total, page, pageSize);
  const items = await prisma.workflowNotificationAttempt.findMany({ where: { notificationId: params.id }, orderBy: { createdAt: "desc" }, skip: (pagination.page - 1) * pageSize, take: pageSize });
  return NextResponse.json({ items, pagination });
}
