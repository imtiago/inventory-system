export interface SaleCancelRequestDTO {
  id: string;
  saleId: string;
  customerName: string;
  total: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: { id: string; name: string } | null;
  requestedAt: Date;
  decidedBy: { id: string; name: string } | null;
  decidedAt: Date | null;
  decisionReason: string | null;
}
