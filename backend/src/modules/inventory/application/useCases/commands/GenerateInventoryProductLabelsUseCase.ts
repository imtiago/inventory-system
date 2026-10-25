import { InventoryLabelPdfService } from "@inventory/infrastructure/pdf/InventoryLabelPdfService";
import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { IGenerateInventoryProductLabelsInput } from "@inventory/application/dto/InventoryBoxDTO";
import { BusinessRuleError, ErrorCodes, NotFoundError, ValidationError } from "@shared/domain/errors";
import { MAX_PRODUCT_CODE_LENGTH, MAX_PRODUCT_LABELS } from "@inventory/domain/labelLimits";

export class GenerateInventoryProductLabelsUseCase {
  constructor(
    private repository: InventoryBoxReadRepository,
    private readonly pdfService: InventoryLabelPdfService,
  ) {}

  async execute(input: IGenerateInventoryProductLabelsInput): Promise<Buffer> {
    // Também aqui (não só no Zod): Array.from + pdfkit síncrono com quantidade sem teto
    // congela o event loop e estoura a memória.
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }
    if (input.quantity > MAX_PRODUCT_LABELS) {
      throw new BusinessRuleError(
        `A quantidade deve ser no máximo ${MAX_PRODUCT_LABELS} etiquetas.`,
        ErrorCodes.INVALID_QUANTITY,
      );
    }
    if (input.productCode.length > MAX_PRODUCT_CODE_LENGTH) {
      const message = `O código do produto deve ter no máximo ${MAX_PRODUCT_CODE_LENGTH} caracteres.`;
      throw new ValidationError(message, [{ field: "productCode", message }]);
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
