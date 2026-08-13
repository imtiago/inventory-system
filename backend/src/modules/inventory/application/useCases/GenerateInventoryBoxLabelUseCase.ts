import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { InventoryBoxReadRepository } from "../contracts/InventoryBoxReadRepository";

export class GenerateInventoryBoxLabel {
  constructor(
    private repository: InventoryBoxReadRepository,
    private readonly pdfService: InventoryLabelPdfService,
  ) {}

  async execute(code: string): Promise<Buffer> {
    const box = await this.repository.getByCode(code);

    if (!box) {
      throw new Error(`Inventory box "${code}" not found.`);
    }

    return this.pdfService.generateBoxLabel(box.code);
  }
}
