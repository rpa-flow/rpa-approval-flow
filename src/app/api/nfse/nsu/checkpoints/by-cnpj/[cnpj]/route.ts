import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nfseNsuCheckpointUpdateSchema } from "@/lib/validations";
import { getCheckpointByCnpj, normalizeCnpj, updateCheckpoint, NfseNsuNotFoundError } from "@/lib/nfse-nsu";
import { authorizeNfseNsuRead, authorizeNfseNsuWrite, handleNfseNsuError } from "../../../_utils/route-helpers";

export async function GET(request: NextRequest, { params }: { params: { cnpj: string } }) {
  const unauthorized = await authorizeNfseNsuRead(request);
  if (unauthorized) return unauthorized;
  try { return NextResponse.json(await getCheckpointByCnpj(params.cnpj)); } catch (error) { return handleNfseNsuError(error); }
}
export async function PUT(request: NextRequest, { params }: { params: { cnpj: string } }) {
  const unauthorized = await authorizeNfseNsuWrite(request);
  if (unauthorized) return unauthorized;
  const parsed = nfseNsuCheckpointUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  try {
    const company = await prisma.company.findUnique({ where: { cnpj: normalizeCnpj(params.cnpj) } });
    if (!company) throw new NfseNsuNotFoundError("Empresa não encontrada para este CNPJ.");
    return NextResponse.json(await updateCheckpoint(company.id, parsed.data));
  } catch (error) { return handleNfseNsuError(error); }
}
