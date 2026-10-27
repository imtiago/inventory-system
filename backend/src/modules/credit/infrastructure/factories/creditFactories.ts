import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { CustomerCreditService } from "@credit/application/services/CustomerCreditService";
import { GetCustomerCreditUseCase, UpdateCustomerCreditUseCase } from "@credit/application/useCases/CustomerCreditUseCases";
import { PrismaCustomerCreditRepository } from "@credit/infrastructure/prisma/PrismaCustomerCreditRepository";
import { PrismaCreditLimitChangeRepository } from "@credit/infrastructure/prisma/PrismaCreditLimitChangeRepository";
import { PrismaCreditProfileRepository } from "@credit/infrastructure/prisma/PrismaCreditProfileRepository";
import { PrismaCreditExposureReader } from "@credit/infrastructure/prisma/PrismaCreditExposureReader";

export function makeCustomerCreditService(): CustomerCreditService {
  return new CustomerCreditService(
    new PrismaCustomerCreditRepository(),
    new PrismaCreditLimitChangeRepository(),
    new PrismaTransactionManager(),
  );
}

export function makeGetCustomerCreditUseCase(): GetCustomerCreditUseCase {
  return new GetCustomerCreditUseCase(
    new PrismaCustomerCreditRepository(),
    new PrismaCreditProfileRepository(),
    new PrismaCreditExposureReader(),
    new PrismaCreditLimitChangeRepository(),
  );
}

export function makeUpdateCustomerCreditUseCase(): UpdateCustomerCreditUseCase {
  return new UpdateCustomerCreditUseCase(
    makeCustomerCreditService(),
    makeGetCustomerCreditUseCase(),
    new PrismaTransactionManager(),
  );
}
