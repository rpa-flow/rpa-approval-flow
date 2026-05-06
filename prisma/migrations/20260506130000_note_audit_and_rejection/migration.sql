-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'RECUSADO';

-- CreateTable
CREATE TABLE "NoteStatusHistory" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "previousStatus" "InvoiceStatus",
    "newStatus" "InvoiceStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteNotification" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    CONSTRAINT "NoteNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteAuditLog" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "actionType" TEXT NOT NULL,
    "previousStatus" "InvoiceStatus",
    "newStatus" "InvoiceStatus",
    "reason" TEXT,
    "comment" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NoteStatusHistory_invoiceId_createdAt_idx" ON "NoteStatusHistory"("invoiceId", "createdAt");
CREATE INDEX "NoteNotification_invoiceId_sentAt_idx" ON "NoteNotification"("invoiceId", "sentAt");
CREATE INDEX "NoteAuditLog_invoiceId_createdAt_idx" ON "NoteAuditLog"("invoiceId", "createdAt");

ALTER TABLE "NoteStatusHistory" ADD CONSTRAINT "NoteStatusHistory_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteNotification" ADD CONSTRAINT "NoteNotification_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteAuditLog" ADD CONSTRAINT "NoteAuditLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
