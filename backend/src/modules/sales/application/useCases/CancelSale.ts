import { prisma } from "../../../../shared/prisma";
import { SaleRepository } from "../../domain/repositories/SaleRepository";
import { InventoryRepository } from "../../../inventory/domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
interface CancelSaleRequest {
  saleId: string;
}
export class CancelSale extends TransactionalUseCase<CancelSaleRequest, void> {
  constructor(
    private saleRepo: SaleRepository,
    private inventoryRepo: InventoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: CancelSaleRequest,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Buscar venda
      const sale = await this.saleRepo.findById(request.saleId, tx);

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
        where: { saleId },
        data: {},
      });

      await tx.receivableParcel.updateMany({
        where: {
          receivable: {
            saleId,
          },
        },
        data: {
          paid: false,
          paidAt: null,
        },
      });

      // 4. Atualizar status da venda
      await this.saleRepo.updateStatus(saleId, "CANCELED", tx);
    });
  }
}
