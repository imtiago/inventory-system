// backend/src/modules/sales/application/useCases/CreateSale.ts

import { SaleRepository } from "../../domain/repositories/SaleRepository";
import { Sale } from "../../domain/entities/Sale";

import { InventoryRepository } from "../../../inventory/domain/repositories/InventoryRepository";

import { Receivable } from "../../../finance/domain/entities/Receivable";
import { ReceivableRepository } from "../../../finance/domain/repositories/ReceivableRepository";

import { TransactionManager } from "@shared/domain/TransactionManager";

interface CreateSaleRequest {
  customerId: string;

  items: {
    productVariantId: string;
    quantity: number;
    price: number;
  }[];

  installments?: {
    amount: number;
    dueDate: Date;
  }[];
}

export class CreateSale {
  constructor(
    private saleRepo: SaleRepository,
    private inventoryRepo: InventoryRepository,
    private receivableRepo: ReceivableRepository,
    private transaction: TransactionManager,
  ) {}

  async execute(data: CreateSaleRequest): Promise<Sale> {
    return this.transaction.execute(async (tx) => {
      /*
       * 1 - Atualizar estoque
       */
      for (const item of data.items) {
        const inventory = await this.inventoryRepo.findByVariant(
          item.productVariantId,
          tx,
        );

        if (!inventory) {
          throw new Error(
            `Inventory not found for variant ${item.productVariantId}`,
          );
        }

        const movement = inventory.removeStock(item.quantity, "Sale");

        await this.inventoryRepo.save(inventory, tx);

        await this.inventoryRepo.addMovement(movement, tx);
      }

      /*
       * 2 - Criar venda
       */

      const sale = new Sale({
        customerId: data.customerId,

        items: data.items,
      });

      const createdSale = await this.saleRepo.save(sale, tx);

      /*
       * 3 - Criar contas a receber
       */

      if (data.installments?.length) {
        const receivable = new Receivable({
          saleId: createdSale.id,

          totalAmount: createdSale.totalAmount,
        });

        for (const installment of data.installments) {
          receivable.addParcel({
            amount: installment.amount,

            dueDate: installment.dueDate,
          });
        }

        await this.receivableRepo.create(receivable, tx);
      }

      return createdSale;
    });
  }
}
