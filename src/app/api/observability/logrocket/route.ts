import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";

export async function GET() {
  const manager = await getSessionManager();

  if (!manager || (manager.role !== "ADMIN" && manager.role !== "GESTOR")) {
    return NextResponse.json({ enabled: false }, {
      status: manager ? 403 : 401,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const enabled = process.env.VERCEL_ENV === "production"
    && process.env.NEXT_PUBLIC_LOGROCKET_ENABLED === "true"
    && Boolean(process.env.NEXT_PUBLIC_LOGROCKET_APP_ID);

  return NextResponse.json({ enabled, ...(enabled ? { userId: manager.id } : {}) }, {
    headers: { "Cache-Control": "no-store" }
  });
}
