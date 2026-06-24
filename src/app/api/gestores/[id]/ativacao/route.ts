import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSecureToken, getSessionManager } from "@/lib/auth";
import { sendAccountActivationEmail } from "@/lib/email";

function appBaseUrl() {
  return (process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function validateAdmin() {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem enviar ativações." }, { status: 403 });
  }
  return null;
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const manager = await prisma.manager.findUnique({
    where: { id: params.id },
    select: { id: true, nome: true, email: true, ativo: true }
  });

  if (!manager) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if (manager.ativo) return NextResponse.json({ error: "Usuário já está ativo." }, { status: 400 });

  const { token, tokenHash } = createSecureToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2);

  await prisma.accountActivationToken.create({
    data: { managerId: manager.id, tokenHash, expiresAt }
  });

  const email = await sendAccountActivationEmail({
    recipient: manager.email,
    name: manager.nome,
    activationUrl: `${appBaseUrl()}/ativar-conta?token=${encodeURIComponent(token)}`,
    expiresAt
  });

  return NextResponse.json({ success: true, message: "E-mail de ativação enviado.", expiresAt, email });
}
