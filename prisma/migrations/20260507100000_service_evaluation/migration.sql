-- CreateEnum
CREATE TYPE "SupplierRiskLevel" AS ENUM ('BAIXO', 'MEDIO', 'ALTO');

-- CreateTable
CREATE TABLE "ServiceEvaluation" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "managerEmail" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "riskLevel" "SupplierRiskLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEvaluation_invoiceId_key" ON "ServiceEvaluation"("invoiceId");

-- CreateIndex
CREATE INDEX "ServiceEvaluation_managerId_idx" ON "ServiceEvaluation"("managerId");

-- CreateIndex
CREATE INDEX "ServiceEvaluation_riskLevel_idx" ON "ServiceEvaluation"("riskLevel");

-- AddForeignKey
ALTER TABLE "ServiceEvaluation" ADD CONSTRAINT "ServiceEvaluation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
