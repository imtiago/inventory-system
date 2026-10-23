import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { CreateProductUseCase } from "../useCases/commands/CreateProductUseCase";
import { CreateVariantUseCase } from "../useCases/commands/CreateVariantUseCase";
import { CatalogWriteService } from "./CatalogWriteService";

/** Reusa os casos de uso de criação (mesmas validações); aninhados, entram na transação do chamador. */
export class CatalogWriteApplicationService implements CatalogWriteService {
  constructor(
    private readonly createProductUseCase: Pick<CreateProductUseCase, "execute">,
    private readonly createVariantUseCase: Pick<CreateVariantUseCase, "execute">,
    private readonly variants: Pick<ProductVariantRepository, "findByProduct">,
  ) {}

  async createProductWithVariant(
    input: Parameters<CatalogWriteService["createProductWithVariant"]>[0],
  ): Promise<{ productId: string; productVariantId: string }> {
    const product = await this.createProductUseCase.execute(input);
    const [variant, ...extra] = await this.variants.findByProduct(product.id);
    if (!variant || extra.length > 0) {
      throw new InternalInvariantError(
        "Produto recém-criado deveria ter exatamente uma variante.",
        InternalErrorCodes.PRODUCT_READ_AFTER_WRITE,
      );
    }
    return { productId: product.id, productVariantId: variant.id };
  }

  async createVariant(
    input: Parameters<CatalogWriteService["createVariant"]>[0],
  ): Promise<{ productVariantId: string }> {
    const variant = await this.createVariantUseCase.execute({ ...input, barcode: input.barcode ?? undefined });
    return { productVariantId: variant.id };
  }
}
