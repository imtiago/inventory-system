import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { PurchaseItem } from "./PurchaseItem";
import { PurchaseOrigin } from "../enums/PurchaseOrigin";
import { PurchaseStatus } from "../enums/PurchaseStatus";
import { purchaseAlreadyCanceled, purchaseHasReceipts, purchaseTotalZero } from "../errors/purchaseErrors";

export interface PurchaseProps {
  id?: string;
  code: string;
  supplierId: string;
  status: PurchaseStatus;
  origin: PurchaseOrigin;
  /** Data do pedido "YYYY-MM-DD". */
  purchaseDate: string;
  notes: string | null;
  items: PurchaseItem[];
  cancelReason?: string | null;
  canceledAt?: Date | null;
  canceledById?: string | null;
  createdAt?: Date;
}

export interface NewPurchaseProps {
  code: string;
  supplierId: string;
  purchaseDate: string;
  notes: string | null;
  items: PurchaseItem[];
  origin?: PurchaseOrigin;
}

/**
 * Pedido de compra. Total = Σ total dos itens (centavos). Status inicial
 * PENDING; recebimentos (Tarefa 3) movem para PARTIALLY_RECEIVED/RECEIVED.
 */
export class Purchase extends BaseEntity {
  readonly code: string;
  readonly supplierId: string;
  readonly origin: PurchaseOrigin;
  readonly purchaseDate: string;
  readonly notes: string | null;
  private readonly _items: PurchaseItem[];
  private _status: PurchaseStatus;
  private _cancelReason: string | null;
  private _canceledAt: Date | null;
  private _canceledById: string | null;

  constructor(props: PurchaseProps) {
    super({ id: props.id, createdAt: props.createdAt });
    const variants = new Set(props.items.map((i) => i.productVariantId));
    if (props.items.length === 0 || variants.size !== props.items.length) {
      throw new InternalInvariantError(
        "Pedido de compra exige itens com variantes distintas.",
        InternalErrorCodes.PURCHASE_ITEM_INVALID,
      );
    }
    this.code = props.code;
    this.supplierId = props.supplierId;
    this.origin = props.origin;
    this.purchaseDate = props.purchaseDate;
    this.notes = props.notes;
    this._items = props.items;
    this._status = props.status;
    this._cancelReason = props.cancelReason ?? null;
    this._canceledAt = props.canceledAt ?? null;
    this._canceledById = props.canceledById ?? null;
  }

  /** Novo pedido: PENDING (origem MANUAL por padrão); total > 0 senão 422 PURCHASE_TOTAL_ZERO. */
  static create(props: NewPurchaseProps): Purchase {
    const purchase = new Purchase({
      ...props,
      origin: props.origin ?? PurchaseOrigin.MANUAL,
      status: PurchaseStatus.PENDING,
    });
    if (purchase.totalAmountCents <= 0) throw purchaseTotalZero();
    return purchase;
  }

  get items(): readonly PurchaseItem[] {
    return this._items;
  }

  get status(): PurchaseStatus {
    return this._status;
  }

  get totalAmountCents(): number {
    return this._items.reduce((sum, item) => sum + item.totalCents, 0);
  }

  get hasReceipts(): boolean {
    return this._items.some((item) => item.receivedQuantity > 0);
  }

  get cancelReason(): string | null {
    return this._cancelReason;
  }

  get canceledAt(): Date | null {
    return this._canceledAt;
  }

  get canceledById(): string | null {
    return this._canceledById;
  }

  /** Já cancelado → 409 PURCHASE_ALREADY_CANCELED; qualquer quantidade recebida → 409 PURCHASE_HAS_RECEIPTS. */
  cancel({ reason, userId, now = new Date() }: { reason: string; userId: string; now?: Date }): void {
    if (this._status === PurchaseStatus.CANCELED) throw purchaseAlreadyCanceled();
    if (this.hasReceipts) throw purchaseHasReceipts();
    this._status = PurchaseStatus.CANCELED;
    this._cancelReason = reason;
    this._canceledAt = now;
    this._canceledById = userId;
  }
}
