import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { PurchaseItem } from "./PurchaseItem";
import { PurchaseOrigin } from "../enums/PurchaseOrigin";
import { PurchaseStatus } from "../enums/PurchaseStatus";
import {
  purchaseAlreadyCanceled,
  purchaseAlreadyReceived,
  purchaseCanceled,
  purchaseHasReceipts,
  purchaseItemNotFound,
  purchaseTotalZero,
  receiptExceedsRemaining,
} from "../errors/purchaseErrors";

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

export interface PurchaseReceiptLine {
  purchaseItemId: string;
  quantity: number;
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
 * PENDING; recebimentos movem para PARTIALLY_RECEIVED/RECEIVED.
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

  /**
   * Estorno da importação de NF-e: o estoque recebido já saiu e o contas a pagar foi cancelado
   * (quem chama garante). Transição explícita, separada de `cancel` (que continua recusando pedido
   * com recebimento): zera o recebido de cada item e cancela com o motivo. Já cancelado → 409.
   */
  revertReceipts({ reason, userId, now = new Date() }: { reason: string; userId: string; now?: Date }): void {
    if (this._status === PurchaseStatus.CANCELED) throw purchaseAlreadyCanceled();
    for (const item of this._items) item.revertReceipt();
    this._status = PurchaseStatus.CANCELED;
    this._cancelReason = reason;
    this._canceledAt = now;
    this._canceledById = userId;
  }

  /**
   * Registra um recebimento: CANCELED → 409 PURCHASE_CANCELED; RECEIVED → 409
   * PURCHASE_ALREADY_RECEIVED; item de outro pedido → 404 PURCHASE_ITEM_NOT_FOUND;
   * quantidade > restante → 422 RECEIPT_EXCEEDS_REMAINING. Valida todas as linhas
   * antes de aplicar (erro não muda nada) e recalcula o status.
   */
  receive(lines: readonly PurchaseReceiptLine[]): void {
    if (this._status === PurchaseStatus.CANCELED) throw purchaseCanceled();
    if (this._status === PurchaseStatus.RECEIVED) throw purchaseAlreadyReceived();

    const ids = new Set(lines.map((l) => l.purchaseItemId));
    if (lines.length === 0 || ids.size !== lines.length) {
      throw new InternalInvariantError(
        "Recebimento exige itens distintos.",
        InternalErrorCodes.PURCHASE_ITEM_INVALID,
      );
    }

    const resolved = lines.map((line) => {
      const item = this._items.find((i) => i.id === line.purchaseItemId);
      if (!item) throw purchaseItemNotFound();
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
        throw new InternalInvariantError("Quantidade de recebimento inválida.", InternalErrorCodes.PURCHASE_ITEM_INVALID);
      }
      if (line.quantity > item.remainingQuantity) throw receiptExceedsRemaining();
      return { item, quantity: line.quantity };
    });

    for (const { item, quantity } of resolved) item.receive(quantity);

    this._status = this._items.every((i) => i.remainingQuantity === 0)
      ? PurchaseStatus.RECEIVED
      : PurchaseStatus.PARTIALLY_RECEIVED;
  }
}
