import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { ProductVariant } from "../../domain/entities/ProductVariant";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";

interface Input {
  productId: string;
  name: string;
  // sku: string;
  barcode?: string;
}

export class CreateVariantUseCase {
  constructor(
    private productRepository: ProductRepository,
    private variantRepository: ProductVariantRepository,
    private numberGenerator: NumberGenerator,
  ) {}

  async execute({ productId, name, barcode }: Input): Promise<ProductVariant> {
    // Verifica se o produto existe
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    if (barcode) {
      const barcodeExists = await this.variantRepository.findByBarcode(barcode);

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
      productId,
      name,
      barcode,
      code,
    });

    return this.variantRepository.create(variant);
  }
}
