import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { ApproveSaleCancelRequestUseCase } from "@sales/application/useCases/commands/ApproveSaleCancelRequestUseCase";
import { RejectSaleCancelRequestUseCase } from "@sales/application/useCases/commands/RejectSaleCancelRequestUseCase";
import { RequestSaleCancelUseCase } from "@sales/application/useCases/commands/RequestSaleCancelUseCase";
import { ListSaleCancelRequestsUseCase } from "@sales/application/useCases/queries/ListSaleCancelRequestsUseCase";
import { PrismaSaleCancelRequestRepository } from "@sales/infrastructure/prisma/repositories/PrismaSaleCancelRequestRepository";
import { PrismaSaleRepository } from "@sales/infrastructure/prisma/repositories/PrismaSaleRepository";
import { makeCancelSaleUseCase } from "./CancelSaleFactory";

export const makeRequestSaleCancelUseCase = () =>
  new RequestSaleCancelUseCase(new PrismaSaleRepository(), new PrismaSaleCancelRequestRepository(), new PrismaTransactionManager());

export const makeApproveSaleCancelRequestUseCase = () =>
  new ApproveSaleCancelRequestUseCase(new PrismaSaleCancelRequestRepository(), makeCancelSaleUseCase(), new PrismaTransactionManager());

export const makeRejectSaleCancelRequestUseCase = () =>
  new RejectSaleCancelRequestUseCase(new PrismaSaleCancelRequestRepository(), new PrismaTransactionManager());

export const makeListSaleCancelRequestsUseCase = () =>
  new ListSaleCancelRequestsUseCase(new PrismaSaleCancelRequestRepository());
