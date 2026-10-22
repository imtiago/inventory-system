import { prisma } from "../../../../../shared/prisma";
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

  async handle(
    { id }: ICancelSaleInput
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Buscar venda
      const sale = await this.saleRepo.findById(id, tx);

      if (!sale) throw new Error("Venda não encontrada");

      if (sale.status === "CANCELED") {
        throw new Error("Venda já cancelada");
      }

      // 2. Devolver estoque
      for (const item of sale.items) {
        const inventory = await this.inventoryRepo.findByVariant(
          item.productVariantId,
          tx,
        );

        if (!inventory) continue;

        inventory.quantity += item.quantity;

        await this.inventoryRepo.update(inventory, tx);
      }

      // 3. Cancelar parcelas (se existir)
      await tx.receivable.updateMany({
        where: { id },
        data: {},
      });

      await tx.receivableParcel.updateMany({
        where: {
          receivable: {
            id,
          },
        },
        data: {
          paid: false,
          paidAt: null,
        },
      });

      // 4. Atualizar status da venda
      await this.saleRepo.updateStatus(id, "CANCELED", tx);
    });
  }
}
