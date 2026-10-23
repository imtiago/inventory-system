import { purchaseNotFound } from "@purchases/domain/errors/purchaseErrors";
import { PurchaseReadRepository } from "../../contracts/PurchaseReadRepository";
import { PurchaseDTO } from "../../dto/PurchaseDTO";

export class GetPurchaseByIdUseCase {
  constructor(private readonly purchases: PurchaseReadRepository) {}

  async execute(id: string): Promise<PurchaseDTO> {
    const purchase = await this.purchases.getById(id);
    if (!purchase) throw purchaseNotFound();
    return purchase;
  }
}
