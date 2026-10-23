import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { makeSequentialNumberGenerator } from "@shared/infrastructure/factories/SequentialNumberGenerator";
import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { makeFinancialService } from "@finance/infrastructure/http/factories/FinancialServiceFactory";
import { makeInventoryService } from "@inventory/infrastructure/http/factories/InventoryServiceFactory";
import { PurchaseCreator } from "@purchases/application/services/PurchaseCreator";
import { CreatePurchaseUseCase } from "@purchases/application/useCases/commands/CreatePurchaseUseCase";
import { CancelPurchaseUseCase } from "@purchases/application/useCases/commands/CancelPurchaseUseCase";
import { ReceivePurchaseUseCase } from "@purchases/application/useCases/commands/ReceivePurchaseUseCase";
import { GetPurchaseByIdUseCase } from "@purchases/application/useCases/queries/GetPurchaseByIdUseCase";
import { ListPurchasesUseCase } from "@purchases/application/useCases/queries/ListPurchasesUseCase";
import { PrismaPurchaseRepository } from "../../prisma/repositories/PrismaPurchaseRepository";
import { PrismaSupplierRepository } from "../../prisma/repositories/PrismaSupplierRepository";
import { PrismaPurchaseReadRepository } from "../../prisma/contracts/PrismaPurchaseReadRepository";

export const makePurchaseCreator = () =>
  new PurchaseCreator(
    new PrismaPurchaseRepository(),
    new PrismaSupplierRepository(),
    makeCatalogService(),
    makeFinancialService(),
    makeSequentialNumberGenerator(),
  );

export const makeCreatePurchaseUseCase = () =>
  new CreatePurchaseUseCase(new PrismaTransactionManager(), makePurchaseCreator());

export const makeCancelPurchaseUseCase = () =>
  new CancelPurchaseUseCase(new PrismaPurchaseRepository(), new PrismaTransactionManager(), makeFinancialService());

export const makeReceivePurchaseUseCase = () =>
  new ReceivePurchaseUseCase(new PrismaPurchaseRepository(), new PrismaTransactionManager(), makeInventoryService());

export const makeGetPurchaseUseCase = () => new GetPurchaseByIdUseCase(new PrismaPurchaseReadRepository());

export const makeListPurchasesUseCase = () => new ListPurchasesUseCase(new PrismaPurchaseReadRepository());
