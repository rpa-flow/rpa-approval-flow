import { NextResponse } from "next/server";
import { getNfseNsuDashboard } from "@/lib/nfse-nsu";
import { authorizeNfseNsuRead, handleNfseNsuError } from "../../_utils/route-helpers";
export async function GET(request: Request) { const unauthorized = await authorizeNfseNsuRead(request); if (unauthorized) return unauthorized; try { return NextResponse.json(await getNfseNsuDashboard()); } catch (error) { return handleNfseNsuError(error); } }
