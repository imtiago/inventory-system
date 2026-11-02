import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { LegacyBatchReviewer } from "../../../application/services/LegacyBatchReviewer";
import {
  AddLegacyRowsUseCase,
  CreateManualLegacyBatchUseCase,
  DeleteLegacyDraftUseCase,
  GetLegacyBatchUseCase,
  ListLegacyBatchesUseCase,
  UpdateLegacyRowUseCase,
  UploadLegacyCsvUseCase,
  type LegacyBatchDeps,
} from "../../../application/useCases/LegacyBatchUseCases";
import { PrismaLegacyCustomerLookup } from "../../prisma/PrismaLegacyCustomerLookup";
import { PrismaLegacyImportBatchReadRepository } from "../../prisma/PrismaLegacyImportBatchReadRepository";
import { PrismaLegacyImportBatchRepository } from "../../prisma/PrismaLegacyImportBatchRepository";

export function makeLegacyBatchDeps(): LegacyBatchDeps {
  const batches = new PrismaLegacyImportBatchRepository();
  const customers = new PrismaLegacyCustomerLookup();
  return {
    batches,
    customers,
    reads: new PrismaLegacyImportBatchReadRepository(),
    reviewer: new LegacyBatchReviewer(batches, customers),
  };
}

const tm = () => new PrismaTransactionManager();

export const makeUploadLegacyCsvUseCase = () => new UploadLegacyCsvUseCase(makeLegacyBatchDeps(), tm());
export const makeCreateManualLegacyBatchUseCase = () => new CreateManualLegacyBatchUseCase(makeLegacyBatchDeps(), tm());
export const makeAddLegacyRowsUseCase = () => new AddLegacyRowsUseCase(makeLegacyBatchDeps(), tm());
export const makeUpdateLegacyRowUseCase = () => new UpdateLegacyRowUseCase(makeLegacyBatchDeps(), tm());
export const makeGetLegacyBatchUseCase = () => new GetLegacyBatchUseCase(makeLegacyBatchDeps());
export const makeListLegacyBatchesUseCase = () => new ListLegacyBatchesUseCase(new PrismaLegacyImportBatchReadRepository());
export const makeDeleteLegacyDraftUseCase = () => new DeleteLegacyDraftUseCase(new PrismaLegacyImportBatchRepository(), tm());
