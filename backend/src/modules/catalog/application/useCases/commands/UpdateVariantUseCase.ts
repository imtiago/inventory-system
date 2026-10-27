import { ConflictError, ForbiddenError, NotFoundError } from "@shared/domain/errors";
import { ProductVariantRepository, VariantUpdatableField } from "@catalog/domain/repositories/ProductVariantRepository";
import type { PriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import {
  IProductVariantOutput,
  IUpdateVariantInput,
} from "@catalog/application/dto/ProductVariantDTO";

export class UpdateVariantUseCase extends TransactionalUseCase<
  IUpdateVariantInput,
  IProductVariantOutput
> {
  constructor(
    private variantRepository: ProductVariantRepository,
    private priceReviewTrigger: PriceReviewTrigger,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: IUpdateVariantInput): Promise<IProductVariantOutput> {
    // Trava a linha antes de ler: edições concorrentes se serializam e cada uma grava só o que mudou.
    const exists = await this.variantRepository.lockById(request.id);
    const variant = exists ? await this.variantRepository.findById(request.id) : null;
    if (!variant) {
      throw new NotFoundError("Variante não encontrada.", "VARIANT_NOT_FOUND");
    }

    const changedFields: VariantUpdatableField[] = [];
    if (request.name !== undefined && request.name !== variant.name) {
      variant.rename(request.name);
      changedFields.push("name");
    }
    if (request.salePrice !== undefined) {
      // O formulário reenvia o preço atual a cada edição: só o preço diferente exige catalog.price.
      const changed = Math.round(request.salePrice * 100) !== Math.round(variant.salePrice * 100);
      // Preço atual 0 = variante nunca precificada: o cadastro inicial do preço é livre.
      const neverPriced = Math.round(variant.salePrice * 100) === 0;
      if (changed && !neverPriced && !request.canChangePrice) {
        throw new ForbiddenError("Somente o administrador pode alterar o preço de venda.");
      }
      if (changed) {
        variant.changeSalePrice(request.salePrice);
        changedFields.push("salePrice");
      }
    }
    if (request.barcode !== undefined) {
      if (request.barcode !== null && request.barcode !== variant.barcode) {
        const other = await this.variantRepository.findByBarcode(request.barcode);
        if (other && other.id !== variant.id) {
          throw new ConflictError("Código de barras já cadastrado.", "BARCODE_ALREADY_EXISTS");
        }
      }
      if (request.barcode !== variant.barcode) {
        variant.changeBarcode(request.barcode);
        changedFields.push("barcode");
      }
    }

    const data =
      changedFields.length > 0
        ? await this.variantRepository.updateFields(variant, changedFields)
        : variant;

    // VariantPriceChanged: o preço praticado mudou, a revisão de preços recalcula a margem.
    if (changedFields.includes("salePrice")) await this.priceReviewTrigger.priceApplied(variant.id, request.userId);

    return {
      id: data.id,
      name: data.name,
      barcode: data.barcode,
      code: data.code,
      productId: data.productId,
      salePrice: data.salePrice,
    };
  }
}
