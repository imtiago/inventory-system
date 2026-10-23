import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { NfeSuggestionService } from "@nfe-import/application/services/NfeSuggestionService";
import { DiscardNfeImportUseCase } from "@nfe-import/application/useCases/commands/DiscardNfeImportUseCase";
import { UploadNfeImportUseCase } from "@nfe-import/application/useCases/commands/UploadNfeImportUseCase";
import { GetNfeImportUseCase } from "@nfe-import/application/useCases/queries/GetNfeImportUseCase";
import { ListNfeImportsUseCase } from "@nfe-import/application/useCases/queries/ListNfeImportsUseCase";
import { NfeParser } from "../../parser/NfeParser";
import { PrismaNfeImportReadRepository } from "../../prisma/PrismaNfeImportReadRepository";
import { PrismaNfeImportRepository } from "../../prisma/PrismaNfeImportRepository";
import { PrismaNfeSuggestionLookup } from "../../prisma/PrismaNfeSuggestionLookup";

export const makeGetNfeImportUseCase = () =>
  new GetNfeImportUseCase(
    new PrismaNfeImportReadRepository(),
    new NfeSuggestionService(new PrismaNfeSuggestionLookup()),
  );

export const makeListNfeImportsUseCase = () => new ListNfeImportsUseCase(new PrismaNfeImportReadRepository());

export const makeUploadNfeImportUseCase = () =>
  new UploadNfeImportUseCase(
    new NfeParser(),
    new PrismaNfeImportRepository(),
    new PrismaTransactionManager(),
    makeGetNfeImportUseCase(),
  );

export const makeDiscardNfeImportUseCase = () =>
  new DiscardNfeImportUseCase(new PrismaNfeImportRepository(), new PrismaTransactionManager());
