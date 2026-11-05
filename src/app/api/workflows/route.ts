import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nfseWorkflowDraftSchema } from "@/lib/workflow/configuration";

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode acessar workflows." }, { status: 403 });
  if (request.nextUrl.searchParams.get("documentType") !== "NFSE") return NextResponse.json({ error: "Tipo de documento inválido ou indisponível." }, { status: 400 });
  const workflow = await prisma.approvalWorkflow.findUnique({
    where: { documentType: "NFSE" },
    include: { versions: { orderBy: { number: "desc" }, include: { steps: { orderBy: { position: "asc" }, include: { fields: true } } } } }
  });
  return NextResponse.json({ workflow });
}

export async function POST(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode configurar workflows." }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const parsed = nfseWorkflowDraftSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Configuração inválida.", details: parsed.error.flatten() }, { status: 400 });

  const managerIds = Array.from(new Set(parsed.data.steps.map((step) => step.managerId)));
  const managers = await prisma.manager.findMany({ where: { id: { in: managerIds }, ativo: true, role: { in: ["ADMIN", "GESTOR"] } }, select: { id: true } });
  if (managers.length !== managerIds.length) return NextResponse.json({ error: "Selecione responsáveis ativos com perfil de gestor ou administrador." }, { status: 400 });
  try {
    const version = await prisma.$transaction(async (tx) => {
      const workflow = await tx.approvalWorkflow.upsert({ where: { documentType: "NFSE" }, update: {}, create: { documentType: "NFSE" } });
      const last = await tx.approvalWorkflowVersion.aggregate({ where: { workflowId: workflow.id }, _max: { number: true } });
      const created = await tx.approvalWorkflowVersion.create({
        data: {
          workflowId: workflow.id, number: (last._max.number ?? 0) + 1, createdById: manager.id,
          steps: { create: parsed.data.steps.map((step, index) => ({ name: step.name, position: index + 1, managerId: step.managerId, consultationScope: step.consultationScope, requiresPurchaseOrder: step.requiresPurchaseOrder, fields: { create: step.fields.map((field) => ({ fieldKey: field.key, mode: field.mode, required: field.required })) } })) }
        },
        include: { steps: { orderBy: { position: "asc" }, include: { fields: true } } }
      });
      await tx.workflowConfigurationAudit.create({ data: { workflowId: workflow.id, versionId: created.id, actorId: manager.id, actorName: manager.nome, action: "DRAFT_CREATED", afterData: parsed.data as Prisma.InputJsonValue } });
      return created;
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "A configuração foi alterada simultaneamente. Tente novamente." }, { status: 409 });
    console.error("[workflows] Falha ao criar rascunho", error);
    return NextResponse.json({ error: "Não foi possível salvar o rascunho." }, { status: 500 });
  }
}
