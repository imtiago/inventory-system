import { GenerateInventoryBoxLabel } from "@inventory/application/useCases/GenerateInventoryBoxLabelUseCase";
import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { PrismaInventoryBoxReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryBoxReadRepository";

export function makeGenerateInventoryBoxLabel() {
  const inventoryBoxRepository = new PrismaInventoryBoxReadRepository();
  const pdfService = new InventoryLabelPdfService();

  return new GenerateInventoryBoxLabel(inventoryBoxRepository, pdfService);
}
