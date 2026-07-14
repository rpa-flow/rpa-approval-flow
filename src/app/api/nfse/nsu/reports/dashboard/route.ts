import { NextResponse } from "next/server";
import { getNfseNsuDashboard } from "@/lib/nfse-nsu";
import { authorizeNfseNsuRead, handleNfseNsuError } from "../../_utils/route-helpers";
export async function GET() { const unauthorized = await authorizeNfseNsuRead(); if (unauthorized) return unauthorized; try { return NextResponse.json(await getNfseNsuDashboard()); } catch (error) { return handleNfseNsuError(error); } }
