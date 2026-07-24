import { ProductVariantDTO } from "../dto/ProductVariantDTO";
import { GetProductVariantUseCase } from "../useCases/GetProductVariantByIdUseCase";
import { CatalogService } from "./CatalogService";

export class CatalogApplicationService implements CatalogService {
  constructor(
    private readonly getProductVariantUseCase: GetProductVariantUseCase,
  ) {}

  async getProductVariant(id: string): Promise<ProductVariantDTO | null> {
    return this.getProductVariantUseCase.execute(id);
  }
}
