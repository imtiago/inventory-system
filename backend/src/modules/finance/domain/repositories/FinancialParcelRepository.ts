import { FinancialParcel } from "../entities/FinancialParcel";

export interface FinancialParcelRepository {
  createMany(parcels: FinancialParcel[]): Promise<FinancialParcel[]>;
}
