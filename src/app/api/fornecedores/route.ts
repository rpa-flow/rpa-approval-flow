import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    include: {
      managers: {
        select: {
          id: true,
          nome: true,
          email: true,
          role: true,
          ativo: true
        }
      }
    },
    orderBy: {
      nome: "asc"
    }
  });

  return NextResponse.json(suppliers);
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const parsed = supplierSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      nome: parsed.data.nome,
      cnpj: parsed.data.cnpj,
      managers: {
        create: parsed.data.managers.map((m) => ({
          nome: m.nome,
          email: m.email,
          senhaHash: hashPassword(m.senha)
        }))
      }
    },
    include: {
      managers: {
        select: {
          id: true,
          nome: true,
          email: true,
          role: true,
          ativo: true
        }
      }
    }
  });

  return NextResponse.json(supplier, { status: 201 });
}
