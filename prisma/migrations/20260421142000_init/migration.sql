-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('APROVADO', 'EM_ANALISE');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GESTOR');

CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Manager" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'GESTOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagerSupplier" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManagerSupplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "codigoIdentificador" TEXT NOT NULL,
    "numeroNota" TEXT NOT NULL,
    "nDfse" TEXT,
    "fornecedorId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'EM_ANALISE',
    "processada" BOOLEAN NOT NULL DEFAULT false,
    "statusProcessamento" "ProcessingStatus" NOT NULL DEFAULT 'PENDENTE',
    "dataAtualizacao" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xmlOriginal" TEXT,
    "localEmissao" TEXT,
    "localPrestacao" TEXT,
    "municipioIncidencia" TEXT,
    "itemTributacaoNac" TEXT,
    "itemTributacaoMun" TEXT,
    "nbsDescricao" TEXT,
    "dataProcessamento" TIMESTAMP(3),
    "dataEmissao" TIMESTAMP(3),
    "dataCompetencia" TIMESTAMP(3),
    "prestadorCnpj" TEXT,
    "prestadorNome" TEXT,
    "prestadorEmail" TEXT,
    "tomadorCnpj" TEXT,
    "tomadorNome" TEXT,
    "tomadorEmail" TEXT,
    "valorBaseCalculo" DECIMAL(14,2),
    "valorIssqn" DECIMAL(14,2),
    "valorTotalRetido" DECIMAL(14,2),
    "valorLiquido" DECIMAL(14,2),
    "valorServico" DECIMAL(14,2),
    "aliquota" DECIMAL(5,2),
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "diasLembrete" INTEGER NOT NULL DEFAULT 2,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "destinatarioAdicional" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierNotificationConfig" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "recorrenciaDias" INTEGER NOT NULL DEFAULT 2,
    "emailsExtras" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ultimoEnvioEm" TIMESTAMP(3),
    "proximoEnvioEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierNotificationConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_cnpj_key" ON "Supplier"("cnpj");
CREATE UNIQUE INDEX "Manager_email_key" ON "Manager"("email");
CREATE UNIQUE INDEX "ManagerSupplier_managerId_supplierId_key" ON "ManagerSupplier"("managerId", "supplierId");
CREATE INDEX "ManagerSupplier_managerId_idx" ON "ManagerSupplier"("managerId");
CREATE INDEX "ManagerSupplier_supplierId_idx" ON "ManagerSupplier"("supplierId");
CREATE UNIQUE INDEX "Invoice_codigoIdentificador_key" ON "Invoice"("codigoIdentificador");
CREATE INDEX "Invoice_fornecedorId_idx" ON "Invoice"("fornecedorId");
CREATE INDEX "Invoice_codigoIdentificador_idx" ON "Invoice"("codigoIdentificador");
CREATE UNIQUE INDEX "SupplierNotificationConfig_supplierId_key" ON "SupplierNotificationConfig"("supplierId");
CREATE INDEX "SupplierNotificationConfig_supplierId_idx" ON "SupplierNotificationConfig"("supplierId");

ALTER TABLE "ManagerSupplier" ADD CONSTRAINT "ManagerSupplier_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagerSupplier" ADD CONSTRAINT "ManagerSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierNotificationConfig" ADD CONSTRAINT "SupplierNotificationConfig_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
