import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionManager, hashPassword, verifyPassword } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = changePasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const passwordMatches = verifyPassword(parsed.data.currentPassword, manager.senhaHash);
  if (!passwordMatches) {
    return NextResponse.json({ error: "Senha atual inválida." }, { status: 400 });
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: "A nova senha deve ser diferente da senha atual." }, { status: 400 });
  }

  await prisma.manager.update({
    where: { id: manager.id },
    data: {
      senhaHash: hashPassword(parsed.data.newPassword)
    }
  });

  return NextResponse.json({ success: true, message: "Senha alterada com sucesso." });
}
