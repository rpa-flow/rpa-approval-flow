import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, signSession, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, senha } = await request.json();

  if (!email || !senha) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
  }

  const manager = await prisma.manager.findUnique({ where: { email } });

  if (!manager || !manager.ativo || !verifyPassword(senha, manager.senhaHash)) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const token = signSession({ managerId: manager.id, role: manager.role });

  const response = NextResponse.json({
    success: true,
    manager: {
      id: manager.id,
      nome: manager.nome,
      email: manager.email,
      role: manager.role
    }
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  return response;
}
