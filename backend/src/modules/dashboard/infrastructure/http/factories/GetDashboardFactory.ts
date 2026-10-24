import { GetDashboardUseCase } from "../../../application/useCases/queries/GetDashboardUseCase";
import { PrismaDashboardReadRepository } from "../../prisma/contracts/PrismaDashboardReadRepository";

export function makeGetDashboardUseCase() {
  return new GetDashboardUseCase(new PrismaDashboardReadRepository());
}
