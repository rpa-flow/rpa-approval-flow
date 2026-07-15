import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { NfseNsuConflictError, NfseNsuNotFoundError, NfseNsuValidationError } from "@/lib/nfse-nsu";

export async function authorizeNfseNsuWrite(request: NextRequest) {
  const configured = process.env.INVOICE_INGEST_API_KEY;
  if (configured && request.headers.get("x-api-key") === configured) return null;
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode executar esta operação." }, { status: 403 });
  return null;
}
export async function authorizeNfseNsuRead(request?: Request) {
  const configured = process.env.INVOICE_INGEST_API_KEY;
  if (configured && request?.headers.get("x-api-key") === configured) return null;
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode consultar o monitoramento de NSU." }, { status: 403 });
  return null;
}
export function handleNfseNsuError(error: unknown) {
  if (error instanceof NfseNsuConflictError) return NextResponse.json({ error: error.message, ...error.details }, { status: 409 });
  if (error instanceof NfseNsuValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof NfseNsuNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  throw error;
}
