import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { IGenerateInventoryBoxLabelInput } from "@inventory/application/dto/InventoryBoxDTO";

export class GenerateInventoryBoxLabelUseCase {
  constructor(
    private repository: InventoryBoxReadRepository,
    private readonly pdfService: InventoryLabelPdfService,
  ) {}

  async execute({ code }: IGenerateInventoryBoxLabelInput): Promise<Buffer> {
    const box = await this.repository.getByCode(code);

    if (!box) {
      throw new Error(`Inventory box "${code}" not found.`);
    }

    return this.pdfService.generateBoxLabel(box.code);
  }
}
