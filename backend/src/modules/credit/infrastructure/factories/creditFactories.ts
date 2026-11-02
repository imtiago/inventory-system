import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { CustomerCreditService } from "@credit/application/services/CustomerCreditService";
import { GetCustomerCreditUseCase, UpdateCustomerCreditUseCase } from "@credit/application/useCases/CustomerCreditUseCases";
import {
  ApproveCreditLimitRequestUseCase,
  ListCreditLimitRequestsUseCase,
  RejectCreditLimitRequestUseCase,
  RequestCreditLimitUseCase,
} from "@credit/application/useCases/CreditLimitRequestUseCases";
import { PrismaCreditLimitRequestRepository } from "@credit/infrastructure/prisma/PrismaCreditLimitRequestRepository";
import { PrismaCreditHistoryReader } from "@credit/infrastructure/prisma/PrismaCreditHistoryReader";
import { PrismaCustomerCreditRepository } from "@credit/infrastructure/prisma/PrismaCustomerCreditRepository";
import { PrismaCreditLimitChangeRepository } from "@credit/infrastructure/prisma/PrismaCreditLimitChangeRepository";
import { PrismaCreditProfileRepository } from "@credit/infrastructure/prisma/PrismaCreditProfileRepository";
import { PrismaCreditExposureReader } from "@credit/infrastructure/prisma/PrismaCreditExposureReader";
import { PrismaCreditSettingsRepository } from "@credit/infrastructure/prisma/PrismaCreditSettingsRepository";
import { RunCreditReviewUseCase } from "@credit/application/useCases/RunCreditReviewUseCase";
import { PrismaCreditReviewCandidates } from "@credit/infrastructure/prisma/PrismaCreditReviewCandidates";
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

export function makeRequestCreditLimitUseCase(): RequestCreditLimitUseCase {
  const settings = new PrismaCreditSettingsRepository();
  return new RequestCreditLimitUseCase(
    new PrismaCustomerCreditRepository(),
    new PrismaCreditLimitRequestRepository(),
    new PrismaCreditHistoryReader(settings),
    settings,
    makeCustomerCreditService(),
    new PrismaTransactionManager(),
  );
}

export function makeApproveCreditLimitRequestUseCase(): ApproveCreditLimitRequestUseCase {
  return new ApproveCreditLimitRequestUseCase(
    new PrismaCreditLimitRequestRepository(),
    makeCustomerCreditService(),
    new PrismaTransactionManager(),
    new PrismaCustomerCreditRepository(),
  );
}

export function makeRejectCreditLimitRequestUseCase(): RejectCreditLimitRequestUseCase {
  return new RejectCreditLimitRequestUseCase(new PrismaCreditLimitRequestRepository(), new PrismaTransactionManager());
}

export function makeListCreditLimitRequestsUseCase(): ListCreditLimitRequestsUseCase {
  return new ListCreditLimitRequestsUseCase(new PrismaCreditLimitRequestRepository());
}

export function makeRunCreditReviewUseCase(): RunCreditReviewUseCase {
  const settings = new PrismaCreditSettingsRepository();
  return new RunCreditReviewUseCase(
    new PrismaCreditReviewCandidates(),
    new PrismaCustomerCreditRepository(),
    new PrismaCreditProfileRepository(),
    settings,
    new PrismaCreditHistoryReader(settings),
    makeCustomerCreditService(),
    new PrismaTransactionManager(),
  );
}
