-- CreateEnum
CREATE TYPE "NfseNsuStatus" AS ENUM ('Downloaded', 'PendingGap', 'RetryError', 'IgnoredByRule');

-- CreateTable
CREATE TABLE "NfseNsuCheckpoint" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "lastContiguousNsu" BIGINT NOT NULL,
    "highestScannedNsu" BIGINT NOT NULL,
    "lastScanAt" TIMESTAMP(3),
    "lastDocumentDownloadedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NfseNsuCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfseNsuControl" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "nsu" BIGINT NOT NULL,
    "status" "NfseNsuStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastHttpStatus" INTEGER,
    "lastError" TEXT,
    "documentId" TEXT,
    "accessKey" TEXT,
    "ignoreReason" TEXT,
    "wasLastAttemptScanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NfseNsuControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfseNsuAttempt" (
    "id" TEXT NOT NULL,
    "nsuControlId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "resultStatus" "NfseNsuStatus" NOT NULL,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "wasNsuScanned" BOOLEAN NOT NULL,
    "documentId" TEXT,
    "accessKey" TEXT,
    "ignoreReason" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NfseNsuAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NfseNsuCheckpoint_companyId_key" ON "NfseNsuCheckpoint"("companyId");
CREATE UNIQUE INDEX "NfseNsuCheckpoint_cnpj_key" ON "NfseNsuCheckpoint"("cnpj");
CREATE INDEX "NfseNsuCheckpoint_lastScanAt_idx" ON "NfseNsuCheckpoint"("lastScanAt");
CREATE INDEX "NfseNsuCheckpoint_lastDocumentDownloadedAt_idx" ON "NfseNsuCheckpoint"("lastDocumentDownloadedAt");
CREATE UNIQUE INDEX "NfseNsuControl_companyId_nsu_key" ON "NfseNsuControl"("companyId", "nsu");
CREATE INDEX "NfseNsuControl_companyId_status_idx" ON "NfseNsuControl"("companyId", "status");
CREATE INDEX "NfseNsuControl_companyId_nsu_idx" ON "NfseNsuControl"("companyId", "nsu");
CREATE INDEX "NfseNsuControl_companyId_lastAttemptAt_idx" ON "NfseNsuControl"("companyId", "lastAttemptAt");
CREATE INDEX "NfseNsuControl_status_lastAttemptAt_idx" ON "NfseNsuControl"("status", "lastAttemptAt");
CREATE INDEX "NfseNsuControl_status_firstAttemptAt_idx" ON "NfseNsuControl"("status", "firstAttemptAt");
CREATE UNIQUE INDEX "NfseNsuAttempt_idempotencyKey_key" ON "NfseNsuAttempt"("idempotencyKey");
CREATE INDEX "NfseNsuAttempt_nsuControlId_attemptedAt_idx" ON "NfseNsuAttempt"("nsuControlId", "attemptedAt");
CREATE INDEX "NfseNsuAttempt_resultStatus_attemptedAt_idx" ON "NfseNsuAttempt"("resultStatus", "attemptedAt");
ALTER TABLE "NfseNsuCheckpoint" ADD CONSTRAINT "NfseNsuCheckpoint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfseNsuControl" ADD CONSTRAINT "NfseNsuControl_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfseNsuAttempt" ADD CONSTRAINT "NfseNsuAttempt_nsuControlId_fkey" FOREIGN KEY ("nsuControlId") REFERENCES "NfseNsuControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
