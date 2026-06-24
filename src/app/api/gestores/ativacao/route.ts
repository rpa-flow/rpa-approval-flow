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

export async function POST() {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const managers = await prisma.manager.findMany({
    where: { ativo: false },
    select: { id: true, nome: true, email: true }
  });

  const results = [];
  for (const manager of managers) {
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

    results.push({ managerId: manager.id, email: manager.email, expiresAt, simulated: email.simulated });
  }

  return NextResponse.json({ success: true, sent: results.length, results });
}
