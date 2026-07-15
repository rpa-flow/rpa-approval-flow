import { NextRequest, NextResponse } from "next/server";
import { listNfseNsuCompaniesReport } from "@/lib/nfse-nsu";
import { authorizeNfseNsuRead, handleNfseNsuError } from "../../_utils/route-helpers";
export async function GET(request: NextRequest) { const unauthorized = await authorizeNfseNsuRead(); if (unauthorized) return unauthorized; try { return NextResponse.json(await listNfseNsuCompaniesReport(request.nextUrl.searchParams)); } catch (error) { return handleNfseNsuError(error); } }
