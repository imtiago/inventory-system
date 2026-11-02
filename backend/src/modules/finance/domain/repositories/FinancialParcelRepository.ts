import { FinancialParcel } from "../entities/FinancialParcel";

export interface FinancialParcelRepository {
  createMany(parcels: FinancialParcel[]): Promise<FinancialParcel[]>;
  /** Aplica o resultado de `splitUnknownDueParcel` (na transação, sob a trava do documento). */
  replaceForSplit(result: {
    closedParcel: FinancialParcel | null;
    removedParcelId: string | null;
    newParcels: FinancialParcel[];
  }): Promise<void>;
}
