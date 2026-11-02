import type { PaymentMethod } from "@finance/domain/enums/PaymentMethod";

/** Snapshot do plano do crediário gravado com a venda (valores em centavos). */
export interface SaleFinancingRecord {
  saleId: string;
  cashPriceCents: number;
  downPaymentCents: number;
  downPaymentMethod: PaymentMethod | null;
  financedCents: number;
  installments: number;
  monthlyRateBps: number;
  surchargeCents: number;
  /** Entrada + Σ parcelas. */
  totalCents: number;
  dueDay: number | null;
  /** "YYYY-MM-DD" */
  firstDueDate: string;
  overrideById: string | null;
  overrideReason: string | null;
  overrideKinds: ("LIMIT" | "OVERDUE")[];
  /** Termos de atraso contratados (configurações do crédito no momento da venda). */
  fineBps: number;
  monthlyInterestBps: number;
  graceDays: number;
}

export interface SaleFinancingRepository {
  create(record: SaleFinancingRecord): Promise<void>;
}
