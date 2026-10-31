import test from "node:test";
import assert from "node:assert/strict";
import { getRetentionDetails } from "./retention-details.ts";

const prefix = "NFSe.infNFSe.DPS.infDPS.valores.trib.tribFed.";
function source(fields: Record<string, string>, layout = "NACIONAL") {
  return { documentDetail: { layout }, extras: Object.fromEntries(Object.entries(fields).map(([key, value]) => [prefix + key, value])) };
}

test("identifies explicit retentions and reconciles cents", () => {
  assert.deepEqual(getRetentionDetails(source({ vRetIRRF: "13.35", vRetCSLL: "8,90" }), "22.25"), {
    items: [{ label: "IRRF", amount: "13.35" }, { label: "CSLL", amount: "8.90" }], status: "complete"
  });
});

test("does not claim tax amounts are withheld without the withholding flag", () => {
  for (const flag of [undefined, "0", "2"]) {
    const fields: Record<string, string> = { "piscofins.vPis": "5.79", "piscofins.vCofins": "26.70" };
    if (flag !== undefined) fields["piscofins.tpRetPisCofins"] = flag;
    assert.equal(getRetentionDetails(source(fields), "32.49").status, "unavailable");
  }
});

test("uses marked PIS/COFINS and prioritizes explicit amounts without double counting", () => {
  const result = getRetentionDetails(source({ vRetPIS: "5.79", "piscofins.tpRetPisCofins": "1", "piscofins.vPis": "5.79", "piscofins.vCofins": "26.70" }), "32.49");
  assert.equal(result.items.length, 2);
  assert.equal(result.status, "complete");
});

test("flags a partial or inconsistent breakdown without changing the total", () => {
  for (const total of ["100.00", "0", undefined]) {
    assert.equal(getRetentionDetails(source({ vRetIRRF: "10.00" }), total).status, "partial");
  }
});

test("handles missing XML, unsupported layouts and invalid amounts", () => {
  assert.equal(getRetentionDetails(undefined, "10.00").status, "unavailable");
  assert.equal(getRetentionDetails(source({ vRetIRRF: "10" }, "ABRASF"), "10").status, "unavailable");
  assert.deepEqual(getRetentionDetails(source({ vRetIRRF: "abc", vRetCSLL: "-1", vRetINSS: "0", vRetCP: "1.234" }), "0").items, []);
});
