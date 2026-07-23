import { FinancialParcel } from "../entities/FinancialParcel";

export interface FinancialParcelRepository {
  createMany(data: FinancialParcel[], tx?: any): Promise<FinancialParcel[]>;
  // markParcelAsPaid(parcelId: string, paidAt: Date): Promise<Parcel>;
}
