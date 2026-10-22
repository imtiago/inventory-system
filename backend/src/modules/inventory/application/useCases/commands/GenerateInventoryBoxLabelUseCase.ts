import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { IGenerateInventoryBoxLabelInput } from "@inventory/application/dto/InventoryBoxDTO";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";

export class GenerateInventoryBoxLabelUseCase {
  constructor(
    private repository: InventoryBoxReadRepository,
    private readonly pdfService: InventoryLabelPdfService,
  ) {}

  async execute({ code }: IGenerateInventoryBoxLabelInput): Promise<Buffer> {
    const box = await this.repository.getByCode(code);

    if (!box) {
      throw new NotFoundError("Caixa não encontrada.", ErrorCodes.BOX_NOT_FOUND);
    }

    return this.pdfService.generateBoxLabel(box.code);
  }
}
