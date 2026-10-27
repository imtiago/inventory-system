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
  items: {
    productVariantId: string;
    quantity: number;
  }[];
  /** Condição escolhida no fechamento (exclusiva com `paymentTerms`). */
  payment?: {
    condition: "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD" | "CREDIARIO";
    /** 1..12, só CREDIT_CARD. */
    cardInstallments?: number;
    /** Padrão: true. */
    passCardFee?: boolean;
    crediario?: CrediarioPaymentInput;
    override?: CreditOverrideInput;
  };
  /** Parcelado antigo (LEGACY_INSTALLMENTS), aceito até a Task 9. */
  paymentTerms?: {
    installments: number;
    /** Meia-noite UTC; ausente com 1 parcela = hoje. */
    firstDueDate?: Date;
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

export interface SaleSimulationDTO {
  itemsTotal: number;
  conditions: SaleSimulationConditionDTO[];
}
