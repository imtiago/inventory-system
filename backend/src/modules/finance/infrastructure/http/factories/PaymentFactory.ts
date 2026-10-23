import { RegisterPaymentUseCase } from "@finance/application/useCases/commands/RegisterPaymentUseCase";
import { ReversePaymentUseCase } from "@finance/application/useCases/commands/ReversePaymentUseCase";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaPaymentRepository } from "@finance/infrastructure/prisma/repositories/PrismaPaymentRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { makeGetReceivableByIdUseCase } from "./ListReceivableFactory";

export function makeRegisterPaymentUseCase() {
  return new RegisterPaymentUseCase(
    new PrismaFinancialDocumentRepository(),
    new PrismaPaymentRepository(),
    new PrismaTransactionManager(),
    makeGetReceivableByIdUseCase(),
  );
}

export function makeReversePaymentUseCase() {
  return new ReversePaymentUseCase(
    new PrismaFinancialDocumentRepository(),
    new PrismaPaymentRepository(),
    new PrismaTransactionManager(),
    makeGetReceivableByIdUseCase(),
  );
}
