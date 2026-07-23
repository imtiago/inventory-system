import { FinancialParcelDTO } from "./FinancialParcelDTO";

export interface FinancialDocumentDTO {
  id: string;

  type: string;

  originId: string;
  originType: string;

  partyId: string;
  partyType: string;

  status: string;

  totalAmount: number;

  createdAt: Date;

  parcels: FinancialParcelDTO[];
}
