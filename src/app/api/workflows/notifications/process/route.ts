import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { processWorkflowNotifications } from "@/lib/workflow/notifications";

export async function POST() {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode processar notificações." }, { status: 403 });
  try {
    return NextResponse.json(await processWorkflowNotifications());
  } catch (error) {
    console.error("[workflows:notifications] Falha ao processar fila", error);
    return NextResponse.json({ error: "Não foi possível processar as notificações." }, { status: 500 });
  }
}

/** Pode ser chamado por agendador com segredo configurado no ambiente. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Agendador não configurado." }, { status: 503 });
  const provided = request.headers.get("authorization") ?? "";
  const expectedBuffer = Buffer.from(`Bearer ${secret}`);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try { return NextResponse.json(await processWorkflowNotifications()); }
  catch (error) {
    console.error("[workflows:notifications] Falha no processamento agendado", error);
    return NextResponse.json({ error: "Não foi possível processar as notificações." }, { status: 500 });
  }
}
