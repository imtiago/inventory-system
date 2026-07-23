import { FinancialApplicationService } from "@finance/application/services/FinancialApplicationService";
import { makeCreateReceivableUseCase } from "./CreateUserFactory";

export function makeFinancialService() {
  const createReceivable = makeCreateReceivableUseCase();

  return new FinancialApplicationService(createReceivable);
}
