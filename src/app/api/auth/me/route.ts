import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";

export async function GET() {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    manager: {
      id: manager.id,
      nome: manager.nome,
      email: manager.email,
      role: manager.role,
      suppliers: manager.managerSuppliers.map((ms) => ({
        supplierId: ms.supplierId,
        supplierName: ms.supplier.nome
      }))
    }
  });
}
