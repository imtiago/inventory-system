import { ProductVariantDTO } from "../dto/ProductVariantDTO";
import { GetProductVariantByBarcodeUseCase } from "../useCases/GetProductVariantByBarcodeUseCase";
import { GetProductVariantUseCase } from "../useCases/GetProductVariantByIdUseCase";
import { CatalogService } from "./CatalogService";

export class CatalogApplicationService implements CatalogService {
  constructor(
    private readonly getProductVariantUseCase: GetProductVariantUseCase,
    private readonly getProductVariantByBarcodeUseCase: GetProductVariantByBarcodeUseCase,
  ) {}

  async getProductVariant(id: string): Promise<ProductVariantDTO | null> {
    return this.getProductVariantUseCase.execute(id);
  }
  async getProductVariantByBarcode(
    barcode: string,
  ): Promise<ProductVariantDTO | null> {
    return this.getProductVariantByBarcodeUseCase.execute(barcode);
  }
}
