import type { NextRequest } from "next/server";
import { createInvoiceFromRequest } from "../create-invoice";

export async function POST(request: NextRequest) {
  return createInvoiceFromRequest(request);
}
