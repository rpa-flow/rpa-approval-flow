import { NextResponse } from "next/server";
import { getNfseNsuIntegrityReport } from "@/lib/nfse-nsu";
import { authorizeNfseNsuRead, handleNfseNsuError } from "../../_utils/route-helpers";
export async function GET(request: Request) { const unauthorized = await authorizeNfseNsuRead(request); if (unauthorized) return unauthorized; try { return NextResponse.json(await getNfseNsuIntegrityReport()); } catch (error) { return handleNfseNsuError(error); } }
