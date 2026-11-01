import { FinancialType } from "@finance/domain/enums/FinancialType";
import { RegisterPaymentUseCase } from "@finance/application/useCases/commands/RegisterPaymentUseCase";
import { ReversePaymentUseCase } from "@finance/application/useCases/commands/ReversePaymentUseCase";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaPaymentRepository } from "@finance/infrastructure/prisma/repositories/PrismaPaymentRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { LateFeeService } from "@credit/application/services/LateFeeService";
import { GetLateFeeQuoteUseCase } from "@credit/application/useCases/GetLateFeeQuoteUseCase";
import { PrismaCreditSettingsRepository } from "@credit/infrastructure/prisma/PrismaCreditSettingsRepository";
import { makeGetFinancialDocumentByIdUseCase } from "./FinancialDocumentReadFactory";

export function makeRegisterPaymentUseCase<T extends FinancialType>(type: T) {
  return new RegisterPaymentUseCase(
    type,
    new PrismaFinancialDocumentRepository(),
    new PrismaPaymentRepository(),
    new PrismaTransactionManager(),
    makeGetFinancialDocumentByIdUseCase(type),
    undefined,
    type === FinancialType.RECEIVABLE ? new LateFeeService(new PrismaCreditSettingsRepository()) : null,
  );
}

export function makeGetLateFeeQuoteUseCase() {
  return new GetLateFeeQuoteUseCase(
    new PrismaFinancialDocumentRepository(),
    new LateFeeService(new PrismaCreditSettingsRepository()),
  );
}

export function makeReversePaymentUseCase<T extends FinancialType>(type: T) {
  return new ReversePaymentUseCase(
    type,
    new PrismaFinancialDocumentRepository(),
    new PrismaPaymentRepository(),
    new PrismaTransactionManager(),
    makeGetFinancialDocumentByIdUseCase(type),
  );
}
