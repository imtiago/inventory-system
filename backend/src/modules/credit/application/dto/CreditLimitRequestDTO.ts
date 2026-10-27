export interface CreditLimitRequestDTO {
  id: string;
  customer: { id: string; name: string };
  currentLimit: number;
  requestedLimit: number;
  approvedLimit: number | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  autoApproved: boolean;
  requestedBy: { id: string; name: string } | null;
  requestedAt: Date;
  decidedBy: { id: string; name: string } | null;
  decidedAt: Date | null;
  decisionReason: string | null;
}
