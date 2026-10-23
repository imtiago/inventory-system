import { FinancialType } from "@finance/domain/enums/FinancialType";
import { RegisterPaymentUseCase } from "@finance/application/useCases/commands/RegisterPaymentUseCase";
import { ReversePaymentUseCase } from "@finance/application/useCases/commands/ReversePaymentUseCase";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaPaymentRepository } from "@finance/infrastructure/prisma/repositories/PrismaPaymentRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { makeGetFinancialDocumentByIdUseCase } from "./FinancialDocumentReadFactory";

export function makeRegisterPaymentUseCase<T extends FinancialType>(type: T) {
  return new RegisterPaymentUseCase(
    type,
    new PrismaFinancialDocumentRepository(),
    new PrismaPaymentRepository(),
    new PrismaTransactionManager(),
    makeGetFinancialDocumentByIdUseCase(type),
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
