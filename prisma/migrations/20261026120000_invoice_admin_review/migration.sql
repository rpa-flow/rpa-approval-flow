CREATE TYPE "InvoiceAdminReviewStatus" AS ENUM ('PENDENTE', 'LIBERADA');

CREATE TABLE "InvoiceAdminReviewConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvoiceAdminReviewConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceAdminReview" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "InvoiceAdminReviewStatus" NOT NULL DEFAULT 'PENDENTE',
    "motivos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "mesReferencia" TEXT NOT NULL,
    "valorSugerido" DECIMAL(14,2),
    "origemValor" TEXT,
    "evidenciaValor" TEXT,
    "valorConfirmado" DECIMAL(14,2),
    "emissaoConfirmada" BOOLEAN NOT NULL DEFAULT false,
    "responsavelId" TEXT,
    "responsavelNome" TEXT,
    "responsavelEmail" TEXT,
    "justificativa" TEXT,
    "observacao" TEXT,
    "revisadoEm" TIMESTAMP(3),
    "emailDestinatario" TEXT,
    "emailEnviadoEm" TIMESTAMP(3),
    "tentativasEmail" INTEGER NOT NULL DEFAULT 0,
    "erroEmail" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvoiceAdminReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceAdminReview_invoiceId_key" ON "InvoiceAdminReview"("invoiceId");
CREATE INDEX "InvoiceAdminReview_status_createdAt_idx" ON "InvoiceAdminReview"("status", "createdAt");
CREATE INDEX "InvoiceAdminReview_mesReferencia_idx" ON "InvoiceAdminReview"("mesReferencia");

ALTER TABLE "InvoiceAdminReview"
ADD CONSTRAINT "InvoiceAdminReview_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
