import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { FinancialParcel } from "../entities/FinancialParcel";

export interface FinancialParcelRepository extends ICrudRepository<FinancialParcel> {
  createMany(data: FinancialParcel[], tx?: any): Promise<FinancialParcel[]>;
  // markParcelAsPaid(parcelId: string, paidAt: Date): Promise<Parcel>;
}
