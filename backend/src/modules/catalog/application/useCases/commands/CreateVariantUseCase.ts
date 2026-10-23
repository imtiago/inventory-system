import { ConflictError, NotFoundError } from "@shared/domain/errors";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import {
  ICreateVariantInput,
  IProductVariantOutput,
} from "@catalog/application/dto/ProductVariantDTO";
import { ProductVariant } from "@catalog/domain/entities/ProductVariant";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";

export class CreateVariantUseCase extends TransactionalUseCase<
  ICreateVariantInput,
  IProductVariantOutput
> {
  constructor(
    private productRepository: ProductRepository,
    private variantRepository: ProductVariantRepository,
    private numberGenerator: NumberGenerator,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateVariantInput,
  ): Promise<IProductVariantOutput> {
    // Verifica se o produto existe
    const product = await this.productRepository.findById(request.productId);
    if (!product) {
      throw new NotFoundError("Produto não encontrado.", "PRODUCT_NOT_FOUND");
    }
    if (request.barcode) {
      const barcodeExists = await this.variantRepository.findByBarcode(
        request.barcode,
      );

      if (barcodeExists) {
        throw new ConflictError("Código de barras já cadastrado.", "BARCODE_ALREADY_EXISTS");
      }
    }

    const code = await this.numberGenerator.generate(
      NumberRangeName.PRODUCT_VARIANT,
      "V",
    );

    // Cria a variante
    const variant = new ProductVariant({
      productId: request.productId,
      name: request.name,
      barcode: request.barcode,
      salePrice: request.salePrice,
      code,
    });

    const data = await this.variantRepository.create(variant);

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
