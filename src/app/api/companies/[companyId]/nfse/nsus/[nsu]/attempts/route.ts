import { NextResponse } from "next/server";
import { listNsuAttempts } from "@/lib/nfse-nsu";
import { authorizeNfseNsuRead, handleNfseNsuError } from "../../../../../../nfse/nsu/_utils/route-helpers";
export async function GET(request: Request, { params }: { params: { companyId: string; nsu: string } }) {
  const unauthorized = await authorizeNfseNsuRead(request); if (unauthorized) return unauthorized;
  try { return NextResponse.json(await listNsuAttempts(params.companyId, Number(params.nsu))); } catch (error) { return handleNfseNsuError(error); }
}
