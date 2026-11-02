import { ConflictError, ErrorCodes, InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { SaleStatus } from "../enums/SaleStatus";
import { PaymentCondition } from "../enums/PaymentCondition";
import { SaleItem } from "./SaleItem";

/** Condição de pagamento gravada na venda (snapshot do fechamento). */
export interface SalePaymentTerms {
  condition: PaymentCondition;
  /** Repasse da taxa do cartão / acréscimo do crediário, em centavos (≥ 0). */
  surchargeCents?: number;
  cardFeePassedOn?: boolean;
  cardInstallments?: number | null;
  cardFeeBps?: number | null;
  downPaymentCents?: number;
}

export class Sale extends BaseEntity {
  private _customerId: string;
  private _sellerId: string | null;
  private _items: SaleItem[];
  private _itemsTotalCents: number;
  private _status: SaleStatus;
  private _payment: Required<SalePaymentTerms>;

  constructor(props: {
    id?: string;
    customerId: string;
    sellerId?: string | null;
    items: SaleItem[];
    status?: SaleStatus;
    createdAt?: Date;
    payment?: SalePaymentTerms;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });

    this._customerId = props.customerId;
    this._sellerId = props.sellerId ?? null;
    this._items = props.items;
    this._itemsTotalCents = this._items.reduce((total, item) => total + item.totalCents, 0);
    this._status = props.status ?? SaleStatus.COMPLETED;
    const payment = props.payment ?? { condition: PaymentCondition.LEGACY_INSTALLMENTS };
    this._payment = {
      condition: payment.condition,
      surchargeCents: payment.surchargeCents ?? 0,
      cardFeePassedOn: payment.cardFeePassedOn ?? false,
      cardInstallments: payment.cardInstallments ?? null,
      cardFeeBps: payment.cardFeeBps ?? null,
      downPaymentCents: payment.downPaymentCents ?? 0,
    };
    if (!Number.isSafeInteger(this._payment.surchargeCents) || this._payment.surchargeCents < 0) {
      throw new InternalInvariantError("Acréscimo da venda inválido.", InternalErrorCodes.SALE_TOTAL_INVALID);
    }
  }

  get customerId() {
    return this._customerId;
  }

  get sellerId() {
    return this._sellerId;
  }

  get items() {
    return this._items;
  }

  /** Σ(quantidade × preço unitário), em centavos inteiros. */
  get itemsTotalCents() {
    return this._itemsTotalCents;
  }

  /** Itens + acréscimo (repasse da taxa do cartão), em centavos. */
  get totalAmountCents() {
    return this._itemsTotalCents + this._payment.surchargeCents;
  }

  get paymentCondition(): PaymentCondition {
    return this._payment.condition;
  }

  get surchargeCents() {
    return this._payment.surchargeCents;
  }

  get cardFeePassedOn() {
    return this._payment.cardFeePassedOn;
  }

  get cardInstallments() {
    return this._payment.cardInstallments;
  }

  get cardFeeBps() {
    return this._payment.cardFeeBps;
  }

  get downPaymentCents() {
    return this._payment.downPaymentCents;
  }

  get status() {
    return this._status;
  }

  cancel() {
    if (this._status === SaleStatus.CANCELED) {
      throw new ConflictError("Venda já cancelada.", ErrorCodes.SALE_ALREADY_CANCELED);
    }

    this._status = SaleStatus.CANCELED;
  }
}
