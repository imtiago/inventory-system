import { ProductVariantDTO } from "../dto/ProductVariantDTO";
import { GetProductVariantByBarcodeUseCase } from "../useCases/queries/GetProductVariantByBarcodeUseCase";
import { GetProductVariantByIdUseCase } from "../useCases/queries/GetProductVariantByIdUseCase";
import { CatalogService } from "./CatalogService";

export class CatalogApplicationService implements CatalogService {
  constructor(
    private readonly getProductVariantUseCase: GetProductVariantByIdUseCase,
    private readonly getProductVariantByBarcodeUseCase: GetProductVariantByBarcodeUseCase,
  ) {}

  async getProductVariant(id: string): Promise<ProductVariantDTO | null> {
    return await this.getProductVariantUseCase.execute(id);
  }
  async getProductVariantByBarcode(
    barcode: string,
  ): Promise<ProductVariantDTO | null> {
    return await this.getProductVariantByBarcodeUseCase.execute(barcode);
  }
}
