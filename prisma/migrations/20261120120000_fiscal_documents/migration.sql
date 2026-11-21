BEGIN;

-- CreateEnum
CREATE TYPE "FiscalProtocolStatus" AS ENUM ('AUTHORIZED', 'CANCELLED', 'NOT_AUTHORIZED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FiscalVersionState" AS ENUM ('CURRENT', 'CANDIDATE', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FiscalReferenceKind" AS ENUM ('NFE', 'SUBSTITUTES_CTE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowDocumentType" ADD VALUE 'NFE';
ALTER TYPE "WorkflowDocumentType" ADD VALUE 'CTE';
ALTER TYPE "WorkflowExecutionStatus" ADD VALUE 'SUPERSEDED';
ALTER TYPE "InvoiceSituation" ADD VALUE 'NAO_AUTORIZADA';
ALTER TYPE "InvoiceSituation" ADD VALUE 'DESCONHECIDA';

-- DropIndex
DROP INDEX "InvoiceWorkflow_invoiceId_key";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "fiscalStatus" "FiscalProtocolStatus",
ADD COLUMN     "referenceValue" DECIMAL(17,2),
ALTER COLUMN "fornecedorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceWorkflow" ADD COLUMN     "currentInvoiceId" TEXT,
ADD COLUMN     "documentVersionId" TEXT;

-- CreateTable
CREATE TABLE "FiscalDocumentVersion" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "contentHash" CHAR(64) NOT NULL,
    "xml" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "state" "FiscalVersionState" NOT NULL,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfeDocumentDetail" (
    "versionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "NfeDocumentDetail_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "CteDocumentDetail" (
    "versionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "CteDocumentDetail_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "FiscalDocumentReference" (
    "id" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "kind" "FiscalReferenceKind" NOT NULL,
    "targetKey" VARCHAR(44) NOT NULL,
    "targetInvoiceId" TEXT,

    CONSTRAINT "FiscalDocumentReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalDocumentVersion_invoiceId_state_idx" ON "FiscalDocumentVersion"("invoiceId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocumentVersion_invoiceId_contentHash_key" ON "FiscalDocumentVersion"("invoiceId", "contentHash");

-- CreateIndex
CREATE INDEX "FiscalDocumentReference_kind_targetKey_idx" ON "FiscalDocumentReference"("kind", "targetKey");

-- CreateIndex
CREATE INDEX "FiscalDocumentReference_targetInvoiceId_idx" ON "FiscalDocumentReference"("targetInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocumentReference_sourceVersionId_kind_targetKey_key" ON "FiscalDocumentReference"("sourceVersionId", "kind", "targetKey");

-- CreateIndex
CREATE INDEX "Invoice_companyId_documentType_idx" ON "Invoice"("companyId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceWorkflow_currentInvoiceId_key" ON "InvoiceWorkflow"("currentInvoiceId");

-- CreateIndex
CREATE INDEX "InvoiceWorkflow_invoiceId_createdAt_idx" ON "InvoiceWorkflow"("invoiceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocumentVersion" ADD CONSTRAINT "FiscalDocumentVersion_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeDocumentDetail" ADD CONSTRAINT "NfeDocumentDetail_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FiscalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CteDocumentDetail" ADD CONSTRAINT "CteDocumentDetail_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FiscalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocumentReference" ADD CONSTRAINT "FiscalDocumentReference_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "FiscalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocumentReference" ADD CONSTRAINT "FiscalDocumentReference_targetInvoiceId_fkey" FOREIGN KEY ("targetInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceWorkflow" ADD CONSTRAINT "InvoiceWorkflow_currentInvoiceId_fkey" FOREIGN KEY ("currentInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
CREATE UNIQUE INDEX "FiscalDocumentVersion_id_invoiceId_key" ON "FiscalDocumentVersion"("id", "invoiceId");
ALTER TABLE "InvoiceWorkflow" ADD CONSTRAINT "InvoiceWorkflow_documentVersionId_invoiceId_fkey"
  FOREIGN KEY ("documentVersionId", "invoiceId") REFERENCES "FiscalDocumentVersion"("id", "invoiceId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "FiscalDocumentVersion_one_current" ON "FiscalDocumentVersion"("invoiceId") WHERE "state" = 'CURRENT';
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_existing_supplier_required"
  CHECK ("fornecedorId" IS NOT NULL OR COALESCE("documentType"::text, 'NFSE') IN ('NFE', 'CTE'));
ALTER TABLE "FiscalDocumentReference" ADD CONSTRAINT "FiscalDocumentReference_key_format"
  CHECK ("targetKey" ~ '^[0-9]{44}$');

-- Preserve earlier assignments and their execution IDs. PostgreSQL locks the DDL
-- transaction so there is no write window between replacing the two unique indexes.
UPDATE "InvoiceWorkflow" SET "currentInvoiceId" = "invoiceId";
ALTER TABLE "InvoiceWorkflow" ADD CONSTRAINT "InvoiceWorkflow_current_owner"
  CHECK ("currentInvoiceId" IS NULL OR "currentInvoiceId" = "invoiceId");
ALTER TABLE "InvoiceWorkflow" ADD CONSTRAINT "InvoiceWorkflow_active_is_current"
  CHECK ("currentInvoiceId" IS NOT NULL OR "status" NOT IN ('ACTIVE', 'BLOCKED'));

-- Older application instances also create the current execution during rollout.
CREATE FUNCTION set_current_invoice_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."currentInvoiceId" := NEW."invoiceId";
  IF NEW."documentVersionId" IS NULL THEN
    SELECT "id" INTO NEW."documentVersionId" FROM "FiscalDocumentVersion"
      WHERE "invoiceId" = NEW."invoiceId" AND "state" = 'CURRENT';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InvoiceWorkflow_set_current" BEFORE INSERT ON "InvoiceWorkflow"
  FOR EACH ROW EXECUTE FUNCTION set_current_invoice_workflow();

-- Only a recorded type or parsed detail is evidence. Keep ambiguous legacy rows
-- for the operator's reconciliation report, including manual receipts without XML.
UPDATE "Invoice" i SET "documentType" = 'NFSE'
  FROM "InvoiceDocumentDetail" d
  WHERE d."invoiceId" = i."id" AND i."documentType" IS NULL AND d."documentFamily" = 'NFSE';
UPDATE "Invoice" SET "referenceValue" = COALESCE("valorServico", "valorLiquido", "valorBaseCalculo")
  WHERE "documentType" = 'NFSE';
WITH unambiguous_company AS (
  SELECT regexp_replace(cnpj, '[^0-9]', '', 'g') AS digits, min(id) AS id
  FROM "Company" WHERE active
  GROUP BY regexp_replace(cnpj, '[^0-9]', '', 'g') HAVING count(*) = 1
)
UPDATE "Invoice" i SET "companyId" = c.id FROM unambiguous_company c
  WHERE i."documentType" = 'NFSE' AND length(c.digits) = 14
    AND regexp_replace(i."tomadorCnpj", '[^0-9]', '', 'g') = c.digits;
INSERT INTO "FiscalDocumentVersion" ("id", "invoiceId", "contentHash", "xml", "parserVersion", "state", "createdAt")
  SELECT 'initial:' || "id", "id", encode(sha256(convert_to("xmlOriginal", 'UTF8')), 'hex'),
    "xmlOriginal", 'legacy-preserved', 'CURRENT', "createdAt"
  FROM "Invoice"
  WHERE "documentType" = 'NFSE' AND "xmlOriginal" IS NOT NULL AND length("xmlOriginal") > 0;
UPDATE "InvoiceWorkflow" w SET "documentVersionId" = v."id"
  FROM "FiscalDocumentVersion" v WHERE v."invoiceId" = w."invoiceId" AND v."state" = 'CURRENT';

COMMIT;
