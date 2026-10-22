import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { IGenerateInventoryProductLabelsInput } from "@inventory/application/dto/InventoryBoxDTO";
import { BusinessRuleError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

export class GenerateInventoryProductLabelsUseCase {
  constructor(
    private repository: InventoryBoxReadRepository,
    private readonly pdfService: InventoryLabelPdfService,
  ) {}

  async execute(input: IGenerateInventoryProductLabelsInput): Promise<Buffer> {
    if (input.quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }

    const box = await this.repository.getByCode(input.boxCode);

    if (!box) {
      throw new NotFoundError("Caixa não encontrada.", ErrorCodes.BOX_NOT_FOUND);
    }

    const labels = Array.from({ length: input.quantity }, () => ({
      boxCode: box.code,
      productCode: input.productCode,
    }));

    return this.pdfService.generateProductLabels(labels);
  }
}
