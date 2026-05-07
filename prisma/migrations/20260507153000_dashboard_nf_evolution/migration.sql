-- CreateEnum
CREATE TYPE "DelphiIntegrationStatus" AS ENUM ('AGUARDANDO', 'SUCESSO', 'FALHA');

-- CreateEnum
CREATE TYPE "InvoiceSituation" AS ENUM ('AUTORIZADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "Invoice"
ADD COLUMN "ocContrato" TEXT,
ADD COLUMN "dataLancamentoDelphi" TIMESTAMP(3),
ADD COLUMN "codigoDelphi" TEXT,
ADD COLUMN "statusIntegracaoDelphi" "DelphiIntegrationStatus" NOT NULL DEFAULT 'AGUARDANDO',
ADD COLUMN "situacaoNotaFiscal" "InvoiceSituation" NOT NULL DEFAULT 'AUTORIZADA',
ADD COLUMN "responsavelValidacao" TEXT,
ADD COLUMN "dataValidacao" TIMESTAMP(3),
ADD COLUMN "observacaoValidacao" TEXT;
