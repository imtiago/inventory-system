import { GenerateInventoryProductLabels } from "@inventory/application/useCases/GenerateInventoryProductLabelsUseCase";
import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { PrismaInventoryBoxReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryBoxReadRepository";

export function makeGenerateInventoryProductLabels() {
  const inventoryBoxRepository = new PrismaInventoryBoxReadRepository();
  const pdfService = new InventoryLabelPdfService();

  return new GenerateInventoryProductLabels(inventoryBoxRepository, pdfService);
}
