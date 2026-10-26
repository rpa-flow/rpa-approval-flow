export type RetentionDetails = {
  items: Array<{ label: string; amount: string }>;
  status: "complete" | "partial" | "unavailable";
};

type ParsedRetentionSource = {
  extras: Record<string, string>;
  documentDetail: { layout: string };
};

function cents(value: string | null | undefined) {
  if (value == null || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return undefined;
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : undefined;
}

// Only identify withholding fields already recognized by the national parser.
// Other layouts/fields remain unavailable or partial instead of guessing a breakdown.
export function getRetentionDetails(
  parsed: ParsedRetentionSource | undefined,
  total: string | null | undefined
): RetentionDetails {
  const items: RetentionDetails["items"] = [];
  let identifiedCents = 0;
  if (parsed?.documentDetail.layout === "NACIONAL") {
    const prefix = "NFSe.infNFSe.DPS.infDPS.valores.trib.tribFed.";
    const fields = parsed.extras;
    const add = (label: string, field: string, fallback?: string) => {
      const primary = cents(fields[prefix + field]);
      const amount = primary ?? (fallback ? cents(fields[prefix + fallback]) : undefined);
      if (amount === undefined || amount <= 0) return;
      items.push({ label, amount: (amount / 100).toFixed(2) });
      identifiedCents += amount;
    };
    add("IRRF", "vRetIRRF");
    add("CSLL", "vRetCSLL");
    add("INSS", "vRetINSS");
    add("Contribuição previdenciária", "vRetCP");
    const pisCofinsWithheld = fields[prefix + "piscofins.tpRetPisCofins"] === "1";
    add("PIS", "vRetPIS", pisCofinsWithheld ? "piscofins.vPis" : undefined);
    add("COFINS", "vRetCOFINS", pisCofinsWithheld ? "piscofins.vCofins" : undefined);
  }
  const totalCents = cents(total);
  return {
    items,
    status: !items.length ? "unavailable" : totalCents === identifiedCents ? "complete" : "partial"
  };
}
