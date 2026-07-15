import { NextRequest, NextResponse } from "next/server";
import { nfseNsuCheckpointUpdateSchema } from "@/lib/validations";
import { getCheckpoint, getCheckpointByCnpj, normalizeCnpj, updateCheckpoint } from "@/lib/nfse-nsu";
import { authorizeNfseNsuRead, authorizeNfseNsuWrite, handleNfseNsuError } from "../../_utils/route-helpers";

export async function GET(request: NextRequest, { params }: { params: { companyId: string } }) {
  const unauthorized = await authorizeNfseNsuRead(request);
  if (unauthorized) return unauthorized;
  const cnpj = normalizeCnpj(params.companyId);
  const read = /^\d{14}$/.test(cnpj) ? getCheckpointByCnpj(cnpj) : getCheckpoint(params.companyId);
  try { return NextResponse.json(await read); } catch (error) { return handleNfseNsuError(error); }
}
export async function PUT(request: NextRequest, { params }: { params: { companyId: string } }) {
  const unauthorized = await authorizeNfseNsuWrite(request);
  if (unauthorized) return unauthorized;
  const parsed = nfseNsuCheckpointUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  try { return NextResponse.json(await updateCheckpoint(params.companyId, parsed.data)); } catch (error) { return handleNfseNsuError(error); }
}
