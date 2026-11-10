ALTER TABLE "Invoice"
ADD COLUMN "gestoresSincronizadosIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
