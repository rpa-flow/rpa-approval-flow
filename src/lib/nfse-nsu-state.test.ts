import test from "node:test";
import assert from "node:assert/strict";
import { resolveNfseNsuTransition, type EffectiveNfseNsuStatus } from "./nfse-nsu-state.ts";

function run(...attempts: EffectiveNfseNsuStatus[]) {
  let status: EffectiveNfseNsuStatus = attempts[0];
  const history: Array<EffectiveNfseNsuStatus & string> = [];
  let hasPreviousAttempts = false;
  let lastTransition = resolveNfseNsuTransition(status, status, hasPreviousAttempts);
  for (const attempt of attempts) {
    history.push(attempt);
    lastTransition = resolveNfseNsuTransition(status, attempt, hasPreviousAttempts);
    status = lastTransition.effectiveStatus;
    hasPreviousAttempts = true;
  }
  return { status, history, lastTransition };
}

test("PendingGap -> Downloaded resolves the gap", () => {
  assert.equal(run("PendingGap", "Downloaded").status, "Downloaded");
});

test("Downloaded -> PendingGap remains Downloaded and reports ignored attempt", () => {
  const result = run("Downloaded", "PendingGap");
  assert.equal(result.status, "Downloaded");
  assert.equal(result.lastTransition.effectiveStateChanged, false);
  assert.equal(result.lastTransition.ignoredBecauseAlreadyDownloaded, true);
});

test("Downloaded -> RetryError remains Downloaded", () => {
  assert.equal(run("Downloaded", "RetryError").status, "Downloaded");
});

test("repeated Downloaded attempts are effective-state idempotent", () => {
  const result = run("Downloaded", "Downloaded", "Downloaded");
  assert.equal(result.status, "Downloaded");
  assert.equal(result.lastTransition.effectiveStateChanged, false);
  assert.equal(result.lastTransition.ignoredBecauseAlreadyDownloaded, false);
});

test("PendingGap without Downloaded remains a gap", () => {
  assert.equal(run("PendingGap", "PendingGap").status, "PendingGap");
});

test("concurrent Downloaded and PendingGap orderings both end Downloaded", () => {
  assert.equal(run("PendingGap", "Downloaded").status, "Downloaded");
  assert.equal(run("Downloaded", "PendingGap").status, "Downloaded");
});

test("audit history is preserved without replacing effective state", () => {
  const result = run("PendingGap", "Downloaded", "RetryError", "PendingGap");
  assert.deepEqual(result.history, ["PendingGap", "Downloaded", "RetryError", "PendingGap"]);
  assert.equal(result.status, "Downloaded");
});
