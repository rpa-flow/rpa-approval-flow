import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { NFSE_WORKFLOW_FIELDS } from "@/lib/workflow/field-catalog";

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode acessar esta configuração." }, { status: 403 });

  const documentType = request.nextUrl.searchParams.get("documentType");
  if (documentType !== "NFSE") {
    return NextResponse.json({ error: "Tipo de documento inválido ou indisponível." }, { status: 400 });
  }

  return NextResponse.json({ documentType, fields: NFSE_WORKFLOW_FIELDS });
}
