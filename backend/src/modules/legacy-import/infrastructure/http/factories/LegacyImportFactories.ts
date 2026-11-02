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
import { ConfirmLegacyBatchUseCase } from "../../../application/useCases/ConfirmLegacyBatchUseCase";
import { RevertLegacyBatchUseCase } from "../../../application/useCases/RevertLegacyBatchUseCase";
import { makeCustomerCreditService } from "@credit/infrastructure/factories/creditFactories";
import { PrismaCustomerCreditRepository } from "@credit/infrastructure/prisma/PrismaCustomerCreditRepository";
import { PrismaCreditProfileRepository } from "@credit/infrastructure/prisma/PrismaCreditProfileRepository";
import { PrismaCreditExposureReader } from "@credit/infrastructure/prisma/PrismaCreditExposureReader";
import { makeCreateCustomerUseCase } from "@customer/infrastructure/http/factories/CreateCustomerFactory";
import { CreateFinancialDocumentUseCase } from "@finance/application/useCases/commands/CreateFinancialDocumentUseCase";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaFinancialParcelRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialParcelRepository";

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

export const makeConfirmLegacyBatchUseCase = () =>
  new ConfirmLegacyBatchUseCase(
    {
      ...makeLegacyBatchDeps(),
      customerCredits: new PrismaCustomerCreditRepository(),
      creditService: makeCustomerCreditService(),
      profiles: new PrismaCreditProfileRepository(),
      exposure: new PrismaCreditExposureReader(),
      createCustomer: makeCreateCustomerUseCase(),
      createDocument: new CreateFinancialDocumentUseCase(
        new PrismaFinancialDocumentRepository(),
        new PrismaFinancialParcelRepository(),
        tm(),
      ),
    },
    tm(),
  );

export const makeRevertLegacyBatchUseCase = () =>
  new RevertLegacyBatchUseCase(
    {
      batches: new PrismaLegacyImportBatchRepository(),
      reads: new PrismaLegacyImportBatchReadRepository(),
      documents: new PrismaFinancialDocumentRepository(),
    },
    tm(),
  );
