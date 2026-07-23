// backend/src/modules/sales/application/useCases/CreateSale.ts

import { SaleRepository } from "../../domain/repositories/SaleRepository";

import { TransactionManager } from "@shared/domain/TransactionManager";
import { CustomerService } from "@customer/application/services/CustomerService";
import { CatalogService } from "@catalog/application/services/CatalogService";
import { InventoryService } from "@inventory/application/services/InventoryService";
import { FinancialService } from "@finance/application/services/FinacialService";
import { SaleItem } from "@sales/domain/entities/SaleItem";
import { Sale } from "@sales/domain/entities/Sale";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";

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

export class CreateSale extends TransactionalUseCase<CreateSaleRequest, Sale> {
  constructor(
    private readonly saleRepository: SaleRepository,
    readonly transactionManager: TransactionManager,
    private readonly customerService: CustomerService,
    private readonly catalogService: CatalogService,
    private readonly inventoryService: InventoryService,
    private readonly financialService: FinancialService,
  ) {
    super(transactionManager);
  }

  async handle(
    request: CreateSaleRequest,
    tx: Prisma.TransactionClient,
  ): Promise<Sale> {
    const customer = await this.customerService.getCustomer(request.customerId);
    if (!customer) {
      throw new Error(`Customer not found ${request.customerId}`);
    }

    const saleItems: SaleItem[] = [];

    for (const item of request.items) {
      const variant = await this.catalogService.getProductVariant(
        item.productVariantId,
      );
      if (!variant) {
        throw new Error(`Variant ${item.productVariantId} not found`);
      }
      saleItems.push(
        new SaleItem({
          variantName: variant.name,
          variantId: variant.id,
          quantity: item.quantity,
          unitPrice: variant.salePrice,
          variantCode: variant.code,
          barcode: variant.barcode,
        }),
      );
    }

    /*
     * 2 - Criar venda
     */
    const sale = new Sale({
      customerId: customer.id,
      items: saleItems,
      // items
      // sellerId: request.sellerId,
      // notes: request.notes,
      // discount: request.discount,
      // items: saleItems,
    });

    // const variant = await this.catalogService.getProductVariant(
    //   item.productVariantId,
    // );
    /*
     * 1 - Atualizar estoque
     */
    for (const item of request.items) {
      // const inventory =
      await this.inventoryService.consumeStock(
        {
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          reason: "SALE",
        },
        tx,
      );

      // if (!inventory) {
      //   throw new Error(
      //     `Inventory not found for variant ${item.productVariantId}`,
      //   );
      // }

      // const movement = inventory.removeStock(item.quantity, "Sale");

      // await this.inventoryRepo.save(inventory);

      // await this.inventoryRepo.addMovement(movement);
    }
    const createdSale = await this.saleRepository.create(sale, tx);
    // console.log("createdSale");

    /*
     * 3 - Criar contas a receber
     */

    //      const sale = Sale.create({
    //   customerId: customer.id,
    //   sellerId: request.sellerId,
    //   notes: request.notes,
    //   discount: request.discount,
    //   items: saleItems,
    // });

    // await this.saleRepository.create(sale);

    // for (const item of sale.items) {
    //   await this.inventoryService.consumeStock(
    //     item.productVariantId,
    //     item.quantity,
    //     "SALE",
    //   );
    // }
    await this.financialService.createReceivable(
      {
        customerId: sale.customerId,
        originId: sale.id,
        originType: FinancialOriginType.SALE,
        parcels: [],
        totalAmount: 500,
      },
      tx,
    );
    return createdSale;

    // return {
    //   saleId: sale.id,
    //   total: sale.total,
    // };
  }
}
