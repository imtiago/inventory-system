import { GenerateInventoryProductLabelsUseCase } from "@inventory/application/useCases/commands/GenerateInventoryProductLabelsUseCase";
import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { PrismaInventoryBoxReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryBoxReadRepository";

export function makeGenerateInventoryProductLabels() {
  const inventoryBoxRepository = new PrismaInventoryBoxReadRepository();
  const pdfService = new InventoryLabelPdfService();

  return new GenerateInventoryProductLabelsUseCase(
    inventoryBoxRepository,
    pdfService,
  );
}
