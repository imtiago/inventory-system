import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { ProductVariant } from "../../domain/entities/ProductVariant";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";

interface Input {
  productId: string;
  name: string;
  // sku: string;
  barcode?: string;
}

export class CreateVariantUseCase extends TransactionalUseCase<
  Input,
  ProductVariant
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
    request: Input,
    tx: Prisma.TransactionClient,
  ): Promise<ProductVariant> {
    // Verifica se o produto existe
    const product = await this.productRepository.findById(request.productId);
    if (!product) {
      throw new Error("Product not found");
    }
    if (request.barcode) {
      const barcodeExists = await this.variantRepository.findByBarcode(
        request.barcode,
      );

      if (barcodeExists) {
        throw new Error("Barcode already exists");
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
      code,
    });

    return this.variantRepository.create(variant);
  }
}
