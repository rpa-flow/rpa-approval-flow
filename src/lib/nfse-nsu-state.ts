export type EffectiveNfseNsuStatus = "Downloaded" | "PendingGap" | "RetryError" | "IgnoredByRule";

export type NfseNsuTransition = {
  effectiveStatus: EffectiveNfseNsuStatus;
  effectiveStateChanged: boolean;
  ignoredBecauseAlreadyDownloaded: boolean;
};

/**
 * Downloaded is a terminal state. Attempt results remain useful audit events, but
 * a failed scan can never undo a download that has already been accepted.
 */
export function resolveNfseNsuTransition(
  currentStatus: EffectiveNfseNsuStatus,
  attemptedStatus: EffectiveNfseNsuStatus,
  hasPreviousAttempts = true
): NfseNsuTransition {
  const alreadyDownloaded = hasPreviousAttempts && currentStatus === "Downloaded";
  const ignoredBecauseAlreadyDownloaded = alreadyDownloaded && attemptedStatus !== "Downloaded";
  const effectiveStatus = alreadyDownloaded ? "Downloaded" : attemptedStatus;

  return {
    effectiveStatus,
    effectiveStateChanged: !hasPreviousAttempts || effectiveStatus !== currentStatus,
    ignoredBecauseAlreadyDownloaded
  };
}
