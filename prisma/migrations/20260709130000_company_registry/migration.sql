-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");

-- CreateIndex
CREATE INDEX "Company_active_idx" ON "Company"("active");

-- Initial company registry keyed by the full 14-digit CNPJ.
INSERT INTO "Company" ("id", "cnpj", "displayName", "active", "createdAt", "updatedAt") VALUES
  ('company-48671252000179', '48671252000179', 'MM GROUP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('company-31096483000284', '31096483000284', 'Sabinópolis', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('company-31096483000101', '31096483000101', 'Matriz', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('company-49229203000143', '49229203000143', 'Elijah', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('company-31096483000799', '31096483000799', 'Barão de Cocais', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('company-31096483000608', '31096483000608', 'Sarzedo', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('company-43003372000184', '43003372000184', 'Empresa não identificada', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('company-31096483000365', '31096483000365', 'Ouro Branco', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("cnpj") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "active" = EXCLUDED."active",
  "updatedAt" = CURRENT_TIMESTAMP;
