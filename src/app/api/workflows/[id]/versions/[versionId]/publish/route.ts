import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nfseWorkflowPublishSchema } from "@/lib/workflow/configuration";

class PublicationConflict extends Error {}
const requestSchema = z.object({ revision: z.number().int().positive() }).strict();

export async function POST(request: NextRequest, { params }: { params: { id: string; versionId: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode publicar workflows." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const input = requestSchema.safeParse(body);
  if (!input.success) return NextResponse.json({ error: "Revisão inválida." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const workflow = await tx.approvalWorkflow.findUnique({ where: { id: params.id } });
      const version = await tx.approvalWorkflowVersion.findFirst({ where: { id: params.versionId, workflowId: params.id }, include: { steps: { orderBy: { position: "asc" }, include: { fields: true } } } });
      if (!workflow || !version) return { kind: "not_found" as const };
      if (version.status !== "DRAFT" || version.revision !== input.data.revision) throw new PublicationConflict();
      const configuration = { documentType: workflow.documentType, steps: version.steps.map((step) => ({ name: step.name, managerId: step.managerId, consultationScope: step.consultationScope, requiresPurchaseOrder: step.requiresPurchaseOrder, fields: step.fields.map((field) => ({ key: field.fieldKey, mode: field.mode, required: field.required })) })) };
      const parsed = nfseWorkflowPublishSchema.safeParse(configuration);
      if (!parsed.success) return { kind: "invalid" as const, details: parsed.error.flatten() };
      const managerIds = Array.from(new Set(version.steps.map((step) => step.managerId)));
      const count = await tx.manager.count({ where: { id: { in: managerIds }, ativo: true, role: { in: ["ADMIN", "GESTOR"] } } });
      if (count !== managerIds.length) return { kind: "inactive" as const };
      const changedVersion = await tx.approvalWorkflowVersion.updateMany({ where: { id: version.id, status: "DRAFT", revision: input.data.revision }, data: { status: "PUBLISHED", publishedAt: new Date(), revision: { increment: 1 } } });
      if (!changedVersion.count) throw new PublicationConflict();
      const changedWorkflow = await tx.approvalWorkflow.updateMany({ where: { id: workflow.id, activeVersionId: workflow.activeVersionId }, data: { activeVersionId: version.id, ...(workflow.activatedAt ? {} : { activatedAt: new Date() }) } });
      if (!changedWorkflow.count) throw new PublicationConflict();
      await tx.workflowConfigurationAudit.create({ data: { workflowId: workflow.id, versionId: version.id, actorId: manager.id, actorName: manager.nome, action: "VERSION_PUBLISHED", beforeData: { activeVersionId: workflow.activeVersionId }, afterData: { activeVersionId: version.id } } });
      return { kind: "published" as const, versionId: version.id };
    });
    if (result.kind === "not_found") return NextResponse.json({ error: "Workflow ou versão não encontrada." }, { status: 404 });
    if (result.kind === "invalid") return NextResponse.json({ error: "Configuração inválida para publicação.", details: result.details }, { status: 400 });
    if (result.kind === "inactive") return NextResponse.json({ error: "Todos os responsáveis devem estar ativos." }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PublicationConflict) return NextResponse.json({ error: "A configuração mudou. Atualize a página." }, { status: 409 });
    console.error("[workflows] Falha ao publicar", error);
    return NextResponse.json({ error: "Não foi possível publicar o workflow." }, { status: 500 });
  }
}
