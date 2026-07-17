import { SaleRepository } from "../../domain/repositories/SaleRepository";
import { Sale } from "../../domain/entities/Sale";
import { v4 as uuid } from "uuid";
import { InventoryRepository } from "../../../inventory/domain/repositories/InventoryRepository";

import { ReceivableRepository } from "modules/finance/domain/repositories/ReceivableRepository";
import { SaleStatus } from "@prisma/client";
import { TransactionManager } from "@shared/domain/TransactionManager";

interface CreateSaleRequest {
  customerId: string;
  items: {
    productVariantId: string;
    quantity: number;
    price: number;
  }[];

  // 🔥 NOVO
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
      // 🧠 1. VALIDAR ESTOQUE
      for (const item of data.items) {
        const inventory = await this.inventoryRepo.findByVariant(
          item.productVariantId,
          tx,
        );

        if (!inventory || inventory.quantity < item.quantity) {
          throw new Error(
            `Estoque insuficiente para o produto ${item.productVariantId}`,
          );
        }
      }

      // 📉 2. BAIXAR ESTOQUE
      for (const item of data.items) {
        const inventory = await this.inventoryRepo.findByVariant(
          item.productVariantId,
          tx,
        );

        if (!inventory) continue;

        inventory.quantity -= item.quantity;

        await this.inventoryRepo.update(inventory, tx);
      }

      // 💰 3. CALCULAR TOTAL
      const totalAmount = data.items.reduce(
        (acc, i) => acc + i.quantity * i.price,
        0,
      );

      // 🧾 4. CRIAR VENDA
      const saleId = uuid();

      const sale: Sale = {
        id: saleId,
        status: SaleStatus.COMPLETED,
        customerId: data.customerId,
        items: data.items,
        totalAmount,
        createdAt: new Date(),
      };

      const createdSale = await this.saleRepo.create(sale, tx);

      // 💳 5. CRIAR RECEIVABLE (SE PARCELADO)
      if (data.installments && data.installments.length > 0) {
        const receivableId = uuid();

        await this.receivableRepo.create(
          {
            id: receivableId,
            saleId: saleId,
            totalAmount,
            createdAt: new Date(),
            parcels: data.installments.map((p) => ({
              id: uuid(),
              amount: p.amount,
              dueDate: p.dueDate,
              paid: false,
            })),
          },
          tx,
        );
      }

      return createdSale;
    });
  }
}
