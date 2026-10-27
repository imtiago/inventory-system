import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { CustomerCreditService } from "@credit/application/services/CustomerCreditService";
import { GetCustomerCreditUseCase, UpdateCustomerCreditUseCase } from "@credit/application/useCases/CustomerCreditUseCases";
import { PrismaCustomerCreditRepository } from "@credit/infrastructure/prisma/PrismaCustomerCreditRepository";
import { PrismaCreditLimitChangeRepository } from "@credit/infrastructure/prisma/PrismaCreditLimitChangeRepository";
import { PrismaCreditProfileRepository } from "@credit/infrastructure/prisma/PrismaCreditProfileRepository";
import { PrismaCreditExposureReader } from "@credit/infrastructure/prisma/PrismaCreditExposureReader";
import { PrismaCreditSettingsRepository } from "@credit/infrastructure/prisma/PrismaCreditSettingsRepository";
import { CrediarioCheckoutService } from "@credit/application/services/CrediarioCheckoutService";
import { CreditOverrideAuthorizer } from "@credit/application/services/CreditOverrideAuthorizer";
import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
import { BcryptPasswordHasher } from "@auth/infrastructure/security/BcryptPasswordHasher";
import { creditOverrideAttemptLimiter } from "@auth/infrastructure/security/LoginAttemptLimiter";

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

export function makeCrediarioCheckoutService(): CrediarioCheckoutService {
  return new CrediarioCheckoutService(
    new PrismaCreditSettingsRepository(),
    new PrismaCustomerCreditRepository(),
    new PrismaCreditProfileRepository(),
    new PrismaCreditExposureReader(),
    new CreditOverrideAuthorizer(new PrismaUserRepository(), new BcryptPasswordHasher(), creditOverrideAttemptLimiter),
    new PrismaTransactionManager(),
  );
}
