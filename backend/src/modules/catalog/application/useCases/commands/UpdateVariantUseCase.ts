import { ConflictError, ForbiddenError, NotFoundError } from "@shared/domain/errors";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
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
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(request: IUpdateVariantInput): Promise<IProductVariantOutput> {
    const variant = await this.variantRepository.findById(request.id);
    if (!variant) {
      throw new NotFoundError("Variante não encontrada.", "VARIANT_NOT_FOUND");
    }

    if (request.name !== undefined) variant.rename(request.name);
    if (request.salePrice !== undefined) {
      // O formulário reenvia o preço atual a cada edição: só o preço diferente exige catalog.price.
      const changed = Math.round(request.salePrice * 100) !== Math.round(variant.salePrice * 100);
      // Preço atual 0 = variante nunca precificada: o cadastro inicial do preço é livre.
      const neverPriced = Math.round(variant.salePrice * 100) === 0;
      if (changed && !neverPriced && !request.canChangePrice) {
        throw new ForbiddenError("Somente o administrador pode alterar o preço de venda.");
      }
      if (changed) variant.changeSalePrice(request.salePrice);
    }
    if (request.barcode !== undefined) {
      if (request.barcode !== null && request.barcode !== variant.barcode) {
        const other = await this.variantRepository.findByBarcode(request.barcode);
        if (other && other.id !== variant.id) {
          throw new ConflictError("Código de barras já cadastrado.", "BARCODE_ALREADY_EXISTS");
        }
      }
      variant.changeBarcode(request.barcode);
    }

    const data = await this.variantRepository.update(variant);

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
