import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { IGenerateInventoryProductLabelsInput } from "@inventory/application/dto/InventoryBoxDTO";

export class GenerateInventoryProductLabelsUseCase {
  constructor(
    private repository: InventoryBoxReadRepository,
    private readonly pdfService: InventoryLabelPdfService,
  ) {}

  async execute(input: IGenerateInventoryProductLabelsInput): Promise<Buffer> {
    if (input.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    const box = await this.repository.getByCode(input.boxCode);

    if (!box) {
      throw new Error(`Inventory box "${input.boxCode}" not found.`);
    }

    const labels = Array.from({ length: input.quantity }, () => ({
      boxCode: box.code,
      productCode: input.productCode,
    }));

    return this.pdfService.generateProductLabels(labels);
  }
}
