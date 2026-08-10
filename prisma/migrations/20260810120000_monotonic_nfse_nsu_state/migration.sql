-- Keep the attempt log separate from the materialized/effective NSU state.
ALTER TABLE "NfseNsuAttempt"
  ADD COLUMN "effectiveStateChanged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ignoredBecauseAlreadyDownloaded" BOOLEAN NOT NULL DEFAULT false;

-- Repair controls produced by the former "last attempt wins" behavior. Any
-- recorded successful download is authoritative, irrespective of later scans.
WITH latest_download AS (
  SELECT DISTINCT ON (a."nsuControlId")
    a."nsuControlId", a."documentId", a."accessKey"
  FROM "NfseNsuAttempt" a
  WHERE a."resultStatus" = 'Downloaded'
  ORDER BY a."nsuControlId", a."attemptedAt" DESC, a."createdAt" DESC, a."id" DESC
)
UPDATE "NfseNsuControl" c
SET "status" = 'Downloaded',
    "documentId" = COALESCE(d."documentId", c."documentId"),
    "accessKey" = COALESCE(d."accessKey", c."accessKey"),
    "ignoreReason" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM latest_download d
WHERE c."id" = d."nsuControlId"
  AND c."status" <> 'Downloaded';

-- Mark the first successful download as the historical state transition and
-- later non-download attempts as audit-only events.
WITH ordered_downloads AS (
  SELECT a."id",
         row_number() OVER (
           PARTITION BY a."nsuControlId"
           ORDER BY a."attemptedAt", a."createdAt", a."id"
         ) AS position
  FROM "NfseNsuAttempt" a
  WHERE a."resultStatus" = 'Downloaded'
)
UPDATE "NfseNsuAttempt" a
SET "effectiveStateChanged" = (d.position = 1)
FROM ordered_downloads d
WHERE a."id" = d."id";

UPDATE "NfseNsuAttempt" a
SET "ignoredBecauseAlreadyDownloaded" = true
WHERE a."resultStatus" IN ('PendingGap', 'RetryError', 'IgnoredByRule')
  AND EXISTS (
    SELECT 1
    FROM "NfseNsuAttempt" downloaded
    WHERE downloaded."nsuControlId" = a."nsuControlId"
      AND downloaded."resultStatus" = 'Downloaded'
      AND (downloaded."attemptedAt", downloaded."createdAt", downloaded."id")
          <= (a."attemptedAt", a."createdAt", a."id")
  );

-- companyId already determines the company CNPJ, but this explicit constraint
-- also protects and documents the complete scheduler identity.
CREATE UNIQUE INDEX "NfseNsuControl_companyId_cnpj_nsu_key"
  ON "NfseNsuControl"("companyId", "cnpj", "nsu");
