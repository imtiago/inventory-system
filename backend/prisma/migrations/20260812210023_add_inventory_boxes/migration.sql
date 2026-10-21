-- CreateTable
CREATE TABLE "InventoryBox" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBoxStock" (
    "id" TEXT NOT NULL,
    "inventoryLotId" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBoxStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBox_code_key" ON "InventoryBox"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBoxStock_inventoryLotId_boxId_key" ON "InventoryBoxStock"("inventoryLotId", "boxId");

-- AddForeignKey
ALTER TABLE "InventoryBoxStock" ADD CONSTRAINT "InventoryBoxStock_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBoxStock" ADD CONSTRAINT "InventoryBoxStock_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "InventoryBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
