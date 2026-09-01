-- CreateTable
CREATE TABLE "InvoiceDocumentDetail" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "documentFamily" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "layoutVersion" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "additionalData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDocumentDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceDocumentDetail_invoiceId_key" ON "InvoiceDocumentDetail"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceDocumentDetail_documentFamily_layout_idx" ON "InvoiceDocumentDetail"("documentFamily", "layout");

-- AddForeignKey
ALTER TABLE "InvoiceDocumentDetail" ADD CONSTRAINT "InvoiceDocumentDetail_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
