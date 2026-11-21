import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FiscalIngestError } from "@/lib/fiscal-document-ingest";
import { fiscalReviewSchema, reviewFiscalDocument } from "@/lib/fiscal-document-review";
import { processWorkflowNotifications } from "@/lib/workflow/notifications";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode consultar versões para revisão." }, { status: 403 });
  const versionId = new URL(request.url).searchParams.get("versionId");
  if (!versionId) return NextResponse.json({ error: "Informe a versão do XML." }, { status: 400 });
  const version = await prisma.fiscalDocumentVersion.findFirst({ where: { id: versionId, invoiceId: params.id }, select: { id: true, state: true, xml: true } });
  return version ? NextResponse.json(version, { headers: { "Cache-Control": "private, no-store" } })
    : NextResponse.json({ error: "Versão não encontrada." }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode resolver a revisão." }, { status: 403 });
  const parsed = fiscalReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe a ação, a versão e a justificativa." }, { status: 400 });
  try {
    const result = await prisma.$transaction(tx => reviewFiscalDocument(tx, params.id, parsed.data,
      { id: manager.id, nome: manager.nome, email: manager.email, role: manager.role, allowedSupplierIds: [] }));
    if (result.workflow === "STARTED") {
      try { await processWorkflowNotifications(); } catch { /* O aviso permanece na fila. */ }
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FiscalIngestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Não foi possível concluir a revisão fiscal." }, { status: 500 });
  }
}
