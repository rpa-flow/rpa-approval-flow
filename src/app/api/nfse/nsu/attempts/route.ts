import { NextRequest, NextResponse } from "next/server";
import { nfseNsuAttemptSchema } from "@/lib/validations";
import { registerNfseNsuAttempt } from "@/lib/nfse-nsu";
import { authorizeNfseNsuWrite, handleNfseNsuError } from "../_utils/route-helpers";

export async function POST(request: NextRequest) {
  const unauthorized = await authorizeNfseNsuWrite(request);
  if (unauthorized) return unauthorized;
  const payload = await request.json();
  const parsed = nfseNsuAttemptSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await registerNfseNsuAttempt(parsed.data as any) as { idempotent?: boolean };
    return NextResponse.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) { return handleNfseNsuError(error); }
}
