import { NextRequest, NextResponse } from "next/server";
import { listCompanyNfseNsus } from "@/lib/nfse-nsu";
import { authorizeNfseNsuRead, handleNfseNsuError } from "../../../../nfse/nsu/_utils/route-helpers";
export async function GET(request: NextRequest, { params }: { params: { companyId: string } }) {
  const unauthorized = await authorizeNfseNsuRead(); if (unauthorized) return unauthorized;
  try { return NextResponse.json(await listCompanyNfseNsus(params.companyId, request.nextUrl.searchParams)); } catch (error) { return handleNfseNsuError(error); }
}
