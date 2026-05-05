ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FORNECEDOR';

ALTER TABLE "Invoice"
ADD COLUMN "criadoPorId" TEXT;

CREATE INDEX "Invoice_criadoPorId_idx" ON "Invoice"("criadoPorId");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_criadoPorId_fkey"
FOREIGN KEY ("criadoPorId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
