CREATE TABLE "SupplierCategory" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierCategory_nome_key" ON "SupplierCategory"("nome");

CREATE TABLE "SupplierCategoryLink" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCategoryLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierCategoryLink_supplierId_categoryId_key" ON "SupplierCategoryLink"("supplierId", "categoryId");
CREATE INDEX "SupplierCategoryLink_supplierId_idx" ON "SupplierCategoryLink"("supplierId");
CREATE INDEX "SupplierCategoryLink_categoryId_idx" ON "SupplierCategoryLink"("categoryId");

ALTER TABLE "SupplierCategoryLink" ADD CONSTRAINT "SupplierCategoryLink_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCategoryLink" ADD CONSTRAINT "SupplierCategoryLink_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SupplierCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
