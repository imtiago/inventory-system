export type SaleStatus = 'COMPLETED' | 'PENDING' | 'CANCELED';

/** GET /sales list row (SaleListItemDTO). */
export interface ISale {
  id: string;
  status: SaleStatus;
  totalAmount: number;
  createdAt: string;
  customer: { id: string; name: string };
  itemsCount: number;
}

/** Business-day period (inclusive, "YYYY-MM-DD") and status: the same fields the CSV export uses. */
export interface ISaleFilters {
  from?: string;
  to?: string;
  status?: SaleStatus | '';
}

export interface ISalesResponse {
  data: ISale[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ISaleDraftItem {
  productVariantId: string;
  productName: string;
  productCode: string;
  /** null while the field is empty (validated on submit). */
  quantity: number | null;
  /** R$ unit price from the variant (salePrice). 0 means the variant has no price. */
  unitPrice: number;
}

/** Condição escolhida no fechamento. */
export type SalePaymentCondition = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'CREDIARIO';

/** Forma de pagamento da entrada do crediário (e do pagamento no ato). */
export type CheckoutPaymentMethod = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD';

/** Autorização de exceção (limite/atraso) por quem aprova crédito, com a própria senha. */
export interface ICreditOverrideInput {
  approverEmail: string;
  approverPassword: string;
  /** 3..200 */
  reason: string;
}

export interface ISaleCrediarioInput {
  installments: number;
  /** Reais (≤ 2 casas). */
  downPayment: number;
  /** Obrigatória quando há entrada. */
  downPaymentMethod?: CheckoutPaymentMethod;
  /** 1..28; ausente = padrão da loja. */
  dueDay?: number;
}

export interface ISalePaymentInput {
  condition: SalePaymentCondition;
  /** 1..12, só CREDIT_CARD (obrigatório nele). */
  cardInstallments?: number;
  /** Repassar a taxa do cartão; padrão true no backend. */
  passCardFee?: boolean;
  crediario?: ISaleCrediarioInput;
  override?: ICreditOverrideInput;
}

interface ICreateSaleBase {
  customerId: string;
  items: {
    productVariantId: string;
    quantity: number;
  }[];
}

export interface ICreateSaleDTO extends ICreateSaleBase {
  payment: ISalePaymentInput;
}

/** GET /credit/approvers: quem pode autorizar exceção de crédito na venda. */
export interface ICreditApprover {
  id: string;
  name: string;
  email: string;
}

/** Exceções que só passam com autorização (as demais travas não têm exceção). */
export type CreditOverrideKind = 'LIMIT' | 'OVERDUE';

/** POST /sales/simulate: valores por condição; `margin` só para quem vê lucro (ADMIN). */
export interface ISaleSimulationCondition {
  condition: 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD';
  cardInstallments: number | null;
  passCardFee: boolean;
  total: number;
  /** null quando algum item não tem custo registrado. */
  margin?: { amount: number; percent: number } | null;
}

/** Uma opção do crediário (1..máximo); `margin` só para quem vê lucro. */
export interface ISaleSimulationCrediarioOption {
  installments: number;
  downPayment: number;
  installmentAmount: number;
  lastInstallmentAmount: number;
  /** Entrada + parcelas. */
  total: number;
  /** Acréscimo em R$ (Σ parcelas − financiado) e em % do financiado. */
  surcharge: number;
  surchargePercent: number;
  margin?: { amount: number; percent: number } | null;
}

export type CrediarioBlockedReason = 'DISABLED' | 'SUSPENDED' | 'OVERDUE' | 'LIMIT';

export interface ISaleSimulationCrediario {
  allowed: boolean;
  blockedReason: CrediarioBlockedReason | null;
  available: number;
  minDownPayment: number;
  maxInstallments: number;
  options: ISaleSimulationCrediarioOption[];
}

export interface ISaleSimulation {
  itemsTotal: number;
  conditions: ISaleSimulationCondition[];
  crediario?: ISaleSimulationCrediario;
}

/** Pedido de simulação: entrada (reais) e dia de vencimento do crediário são opcionais. */
export interface ISaleSimulationRequest extends ICreateSaleBase {
  downPayment?: number;
  dueDay?: number;
}

/** Plano do crediário gravado na venda (snapshot). */
export interface ISaleFinancing {
  cashPrice: number;
  downPayment: number;
  downPaymentMethod: CheckoutPaymentMethod | null;
  financedAmount: number;
  installments: number;
  monthlyRatePercent: number;
  surchargeAmount: number;
  totalAmount: number;
  dueDay: number | null;
  /** Date-only "YYYY-MM-DD". */
  firstDueDate: string;
  /** Exceção autorizada na venda (limite/atraso). */
  override: { approver: { id: string; name: string } | null; reason: string; kinds: CreditOverrideKind[] } | null;
}

export interface ISaleParcel {
  id: string;
  amount: number;
  /** Date-only "YYYY-MM-DD". */
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface ISaleDetail {
  id: string;
  status: SaleStatus;
  /** Itens + acréscimo (repasse da taxa do cartão). */
  totalAmount: number;
  /** LEGACY_INSTALLMENTS = venda parcelada antiga. */
  paymentCondition: SalePaymentCondition | 'LEGACY_INSTALLMENTS';
  cardInstallments: number | null;
  cardFeePassedOn: boolean;
  surchargeAmount: number;
  downPayment: number;
  createdAt: string;
  customer: { id: string; name: string };
  seller: { id: string; name: string } | null;
  items: {
    id: string;
    productVariant: { id: string; name: string; code: string; barcode: string | null };
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  receivable: { id: string; status: string; parcels: ISaleParcel[] } | null;
  /** Só no crediário. */
  financing: ISaleFinancing | null;
  pendingCancelRequest: ISaleCancelRequest | null;
  /** Último pedido de cancelamento já decidido (aprovado ou recusado, com o motivo). */
  latestDecidedCancelRequest: ISaleCancelRequest | null;
}

export interface ISaleCancelRequestsResponse {
  data: ISaleCancelRequest[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ISaleCancelRequest {
  id: string;
  saleId: string;
  customerName: string;
  total: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: { id: string; name: string } | null;
  requestedAt: string;
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  decisionReason: string | null;
}
