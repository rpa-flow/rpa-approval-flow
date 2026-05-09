import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { sendTestEmail } from "@/lib/email";
import { testEmailSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = testEmailSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const recipient = parsed.data.destinatario ?? manager.email;

  if (manager.role !== "ADMIN" && recipient.toLowerCase() !== manager.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Somente ADMIN pode enviar teste para outro destinatário." },
      { status: 403 }
    );
  }

  let result: Awaited<ReturnType<typeof sendTestEmail>>;

  try {
    result = await sendTestEmail({
      recipient,
      subject: parsed.data.assunto,
      message: parsed.data.mensagem
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao enviar e-mail de teste.", details: (error as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    recipient,
    simulated: result.simulated,
    messageId: result.messageId ?? null,
    accepted: result.accepted ?? [],
    rejected: result.rejected ?? [],
    message: result.simulated
      ? "SMTP não configurado. E-mail simulado no console do servidor."
      : "E-mail de teste enviado com sucesso."
  });
}
