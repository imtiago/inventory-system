import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { InventoryBoxReadRepository } from "../contracts/InventoryBoxReadRepository";

export interface GenerateInventoryProductLabelsInput {
  boxCode: string;
  productCode: string;
  quantity: number;
}

export class GenerateInventoryProductLabels {
  constructor(
    private repository: InventoryBoxReadRepository,
    private readonly pdfService: InventoryLabelPdfService,
  ) {}

  async execute(input: GenerateInventoryProductLabelsInput): Promise<Buffer> {
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
