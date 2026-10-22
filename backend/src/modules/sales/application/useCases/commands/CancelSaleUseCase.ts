import { BusinessRuleError, ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { SaleRepository } from "../../../domain/repositories/SaleRepository";
import { InventoryRepository } from "../../../../inventory/domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ICancelSaleInput } from "@sales/application/dto/SaleDTO";

export class CancelSaleUseCase extends TransactionalUseCase<
  ICancelSaleInput,
  void
> {
  constructor(
    private saleRepo: SaleRepository,
    private inventoryRepo: InventoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle({ id }: ICancelSaleInput): Promise<void> {
    // 1. Buscar venda
    const sale = await this.saleRepo.findById(id);

    if (!sale) throw new NotFoundError("Venda não encontrada.", ErrorCodes.SALE_NOT_FOUND);

    if (sale.status === "CANCELED") {
      throw new BusinessRuleError("Venda já cancelada.", ErrorCodes.SALE_ALREADY_CANCELED);
    }

    // 2. Devolver estoque
    for (const item of sale.items) {
      const inventory = await this.inventoryRepo.findByVariant(
        item.productVariantId,
      );

      if (!inventory) continue;

      inventory.quantity += item.quantity;

      await this.inventoryRepo.update(inventory);
    }

    // 3. TODO: cancelar documento financeiro via FinancialService
    // (models receivable/receivableParcel não existem mais no schema)

    // 4. Atualizar status da venda
    await this.saleRepo.updateStatus(id, "CANCELED");
  }
}
