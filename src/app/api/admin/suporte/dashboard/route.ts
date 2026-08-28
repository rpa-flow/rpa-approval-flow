import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionManager } from "@/lib/auth";
import { getSupportDashboard } from "@/lib/support-dashboard";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  periodDays: z.coerce.number().int().min(7).max(90).default(30),
  dueDays: z.coerce.number().int().min(1).max(30).default(7)
});

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") {
    return NextResponse.json({ error: "Somente ADMIN pode acessar o painel de suporte." }, { status: 403 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Filtros inválidos.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await getSupportDashboard(parsed.data));
  } catch (error) {
    console.error("Falha ao montar painel de suporte", error instanceof Error ? error.message : "Erro desconhecido");
    return NextResponse.json({ error: "Não foi possível carregar o painel de suporte." }, { status: 500 });
  }
}
