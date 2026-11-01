import { SaleCancelRequestDTO } from "./SaleCancelRequestDTO";
import { SaleItemDTO } from "./SaleItemDTO";

export interface SaleReceivableParcelDTO {
  id: string;
  amount: number;
  /** Data sem hora, "YYYY-MM-DD" (UTC). */
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface SaleReceivableDTO {
  id: string;
  status: string;
  parcels: SaleReceivableParcelDTO[];
}

/** Plano do crediário gravado na venda (snapshot). */
export interface SaleFinancingDTO {
  /** Itens (preço à vista). */
  cashPrice: number;
  downPayment: number;
  /** null sem entrada. */
  downPaymentMethod: string | null;
  financedAmount: number;
  installments: number;
  /** 0 até as parcelas sem acréscimo. */
  monthlyRatePercent: number;
  surchargeAmount: number;
  /** Entrada + parcelas (total a prazo). */
  totalAmount: number;
  dueDay: number | null;
  /** "YYYY-MM-DD" */
  firstDueDate: string;
  /** Exceção autorizada (limite/atraso); approver null se o usuário foi apagado. */
  override: { approver: { id: string; name: string } | null; reason: string; kinds: string[] } | null;
}

export interface SaleDetailDTO {
  id: string;
  status: string;
  /** Itens + acréscimo (repasse da taxa do cartão). */
  totalAmount: number;
  /** CASH | PIX | DEBIT_CARD | CREDIT_CARD | CREDIARIO | LEGACY_INSTALLMENTS (vendas antigas). */
  paymentCondition: string;
  /** Parcelas no cartão de crédito (1..12); null fora do crédito. */
  cardInstallments: number | null;
  cardFeePassedOn: boolean;
  /** Repasse da taxa do cartão / acréscimo do crediário. */
  surchargeAmount: number;
  downPayment: number;
  createdAt: Date;
  customer: { id: string; name: string };
  seller: { id: string; name: string } | null;
  items: SaleItemDTO[];
  receivable: SaleReceivableDTO | null;
  /** Só no crediário. */
  financing: SaleFinancingDTO | null;
  /** Pedido de cancelamento em aberto, se houver. */
  pendingCancelRequest: SaleCancelRequestDTO | null;
  /** Último pedido de cancelamento já decidido (aprovado ou recusado, com o motivo), se houver. */
  latestDecidedCancelRequest: SaleCancelRequestDTO | null;
}

export interface SaleListItemDTO {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  customer: { id: string; name: string };
  itemsCount: number;
}

export interface ICancelSaleInput {
  id: string;
  /** Usuário autenticado que cancela (auditoria das movimentações RETURN). */
  userId?: string;
}

export interface ICreateSaleInput {
  customerId: string;
  /** Usuário autenticado (request.user.sub). */
  sellerId: string;
  /** IP do pedido (limite de tentativas da autorização de exceção no crediário). */
  ip?: string;
  items: {
    productVariantId: string;
    quantity: number;
  }[];
  /** Condição escolhida no fechamento. */
  payment: {
    condition: "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD" | "CREDIARIO";
    /** 1..12, só CREDIT_CARD. */
    cardInstallments?: number;
    /** Padrão: true. */
    passCardFee?: boolean;
    crediario?: CrediarioPaymentInput;
    override?: CreditOverrideInput;
  };
}

export interface CrediarioPaymentInput {
  installments: number;
  /** Reais (≤ 2 casas). */
  downPayment: number;
  downPaymentMethod?: "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD";
  /** 1..28 */
  dueDay?: number;
}

export interface CreditOverrideInput {
  approverEmail: string;
  approverPassword: string;
  /** 3..200 */
  reason: string;
}

export interface SaleSimulationConditionDTO {
  condition: "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD";
  cardInstallments: number | null;
  passCardFee: boolean;
  total: number;
  /** Só para quem tem `reports.profit`; null se algum item não tem custo registrado. */
  margin?: { amount: number; percent: number } | null;
}

export interface SaleSimulationCrediarioOptionDTO {
  installments: number;
  downPayment: number;
  installmentAmount: number;
  lastInstallmentAmount: number;
  /** Entrada + parcelas. */
  total: number;
  /** Σ parcelas − financiado. */
  surcharge: number;
  /** Acréscimo ÷ financiado. */
  surchargePercent: number;
  /** Só para quem tem `reports.profit`; null se algum item não tem custo registrado. */
  margin?: { amount: number; percent: number } | null;
}

export interface SaleSimulationCrediarioDTO {
  allowed: boolean;
  blockedReason: "DISABLED" | "SUSPENDED" | "OVERDUE" | "LIMIT" | null;
  available: number;
  minDownPayment: number;
  maxInstallments: number;
  options: SaleSimulationCrediarioOptionDTO[];
}

export interface SaleSimulationDTO {
  itemsTotal: number;
  conditions: SaleSimulationConditionDTO[];
  crediario?: SaleSimulationCrediarioDTO;
}
