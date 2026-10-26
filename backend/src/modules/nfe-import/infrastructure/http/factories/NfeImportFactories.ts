import { env } from "@shared/config/env";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { NfeSuggestionService } from "@nfe-import/application/services/NfeSuggestionService";
import { makeCatalogService, makeCatalogWriteService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { makePurchaseCreator, makeReceivePurchaseUseCase } from "@purchases/infrastructure/http/factories/PurchaseFactories";
import { PrismaSupplierRepository } from "@purchases/infrastructure/prisma/repositories/PrismaSupplierRepository";
import { ConfirmNfeImportUseCase } from "@nfe-import/application/useCases/commands/ConfirmNfeImportUseCase";
import { DiscardNfeImportUseCase } from "@nfe-import/application/useCases/commands/DiscardNfeImportUseCase";
import { UploadNfeImportUseCase } from "@nfe-import/application/useCases/commands/UploadNfeImportUseCase";
import { GetNfeImportUseCase } from "@nfe-import/application/useCases/queries/GetNfeImportUseCase";
import { ListNfeImportsUseCase } from "@nfe-import/application/useCases/queries/ListNfeImportsUseCase";
import { NfeParser } from "../../parser/NfeParser";
import { PrismaNfeImportReadRepository } from "../../prisma/PrismaNfeImportReadRepository";
import { PrismaNfeImportRepository } from "../../prisma/PrismaNfeImportRepository";
import { PrismaNfeLotLookup } from "../../prisma/PrismaNfeLotLookup";
import { PrismaNfeSuggestionLookup } from "../../prisma/PrismaNfeSuggestionLookup";
import { PrismaSupplierProductMappingRepository } from "../../prisma/PrismaSupplierProductMappingRepository";

export const makeGetNfeImportUseCase = () =>
  new GetNfeImportUseCase(
    new PrismaNfeImportReadRepository(),
    new NfeSuggestionService(new PrismaNfeSuggestionLookup()),
  );

export const makeListNfeImportsUseCase = () => new ListNfeImportsUseCase(new PrismaNfeImportReadRepository());

export const makeUploadNfeImportUseCase = () =>
  new UploadNfeImportUseCase(
    new NfeParser({ companyCnpj: env.COMPANY_CNPJ }),
    new PrismaNfeImportRepository(),
    new PrismaTransactionManager(),
    makeGetNfeImportUseCase(),
  );

export const makeDiscardNfeImportUseCase = () =>
  new DiscardNfeImportUseCase(new PrismaNfeImportRepository(), new PrismaTransactionManager());

/**
 * Confirmação: transação com prazo maior (cria catálogo, pedido, contas a pagar e estoque de uma vez);
 * lock_timeout maior para a confirmação concorrente esperar a primeira e responder NFE_IMPORT_CONFIRMED.
 */
/**
 * Tempos da transação da confirmação (nota grande, travas de estoque). Também
 * usados pela rota idempotente, cuja transação externa engloba a confirmação.
 */
export const CONFIRM_NFE_TRANSACTION_OPTIONS = { timeout: 30_000, lockTimeoutMs: 15_000 } as const;

export const makeConfirmNfeImportUseCase = () =>
  new ConfirmNfeImportUseCase(
    new PrismaNfeImportRepository(),
    new PrismaSupplierRepository(),
    makeCatalogService(),
    makeCatalogWriteService(),
    new PrismaSupplierProductMappingRepository(),
    makePurchaseCreator(),
    makeReceivePurchaseUseCase(),
    new PrismaNfeLotLookup(),
    new PrismaTransactionManager(CONFIRM_NFE_TRANSACTION_OPTIONS),
  );
