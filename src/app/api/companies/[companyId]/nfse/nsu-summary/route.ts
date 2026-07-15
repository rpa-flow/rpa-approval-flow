import { NextResponse } from "next/server";
import { getCompanyNfseNsuSummary } from "@/lib/nfse-nsu";
import { authorizeNfseNsuRead, handleNfseNsuError } from "../../../../nfse/nsu/_utils/route-helpers";
export async function GET(request: Request, { params }: { params: { companyId: string } }) {
  const unauthorized = await authorizeNfseNsuRead(request); if (unauthorized) return unauthorized;
  try { return NextResponse.json(await getCompanyNfseNsuSummary(params.companyId)); } catch (error) { return handleNfseNsuError(error); }
}
