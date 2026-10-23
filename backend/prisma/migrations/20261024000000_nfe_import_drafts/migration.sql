-- Fase 6B: rascunhos de importação de NF-e e vínculo código do fornecedor → variante (aditiva).
-- CreateEnum
CREATE TYPE "NfeImportStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateTable
CREATE TABLE "NfeImport" (
    "id" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "status" "NfeImportStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierDocument" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "payload" JSONB NOT NULL,
    "purchaseId" TEXT,
    "createdById" TEXT,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "NfeImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProductMapping" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "unitsPerPackage" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NfeImport_accessKey_key" ON "NfeImport"("accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "NfeImport_purchaseId_key" ON "NfeImport"("purchaseId");

-- CreateIndex
CREATE INDEX "NfeImport_status_createdAt_idx" ON "NfeImport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierProductMapping_productVariantId_idx" ON "SupplierProductMapping"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProductMapping_supplierId_supplierCode_key" ON "SupplierProductMapping"("supplierId", "supplierCode");

-- AddForeignKey
ALTER TABLE "NfeImport" ADD CONSTRAINT "NfeImport_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeImport" ADD CONSTRAINT "NfeImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeImport" ADD CONSTRAINT "NfeImport_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductMapping" ADD CONSTRAINT "SupplierProductMapping_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductMapping" ADD CONSTRAINT "SupplierProductMapping_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

