import { SaleRepository } from "../../domain/repositories/SaleRepository";
import { Sale } from "../../domain/entities/Sale";
import { v4 as uuid } from "uuid";
import { InventoryRepository } from "../../../inventory/domain/repositories/InventoryRepository";

interface CreateSaleRequest {
  customerId: string;
  items: { productVariantId: string; quantity: number; price: number }[];
}

export class CreateSale {
  constructor(
    private saleRepo: SaleRepository,
    private inventoryRepo: InventoryRepository,
  ) {}

  async execute(data: CreateSaleRequest): Promise<Sale> {
    // Atualizar estoque
    for (const item of data.items) {
      const inventory = await this.inventoryRepo.findByVariant(
        item.productVariantId,
      );
      if (!inventory || inventory.quantity < item.quantity) {
        throw new Error(
          `Estoque insuficiente para o produto ${item.productVariantId}`,
        );
      }
      inventory.quantity -= item.quantity;
      await this.inventoryRepo.update(inventory);
    }

    const sale: Sale = {
      id: uuid(),
      customerId: data.customerId,
      items: data.items,
      totalAmount: data.items.reduce((acc, i) => acc + i.quantity * i.price, 0),
      createdAt: new Date(),
    };

    return this.saleRepo.create(sale);
  }
}
