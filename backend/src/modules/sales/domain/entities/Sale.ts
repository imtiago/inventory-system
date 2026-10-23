import { ConflictError, ErrorCodes } from "@shared/domain/errors";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { SaleStatus } from "../enums/SaleStatus";
import { SaleItem } from "./SaleItem";

export class Sale extends BaseEntity {
  private _customerId: string;
  private _sellerId: string | null;
  private _items: SaleItem[];
  private _totalAmountCents: number;
  private _status: SaleStatus;

  constructor(props: {
    id?: string;
    customerId: string;
    sellerId?: string | null;
    items: SaleItem[];
    status?: SaleStatus;
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });

    this._customerId = props.customerId;
    this._sellerId = props.sellerId ?? null;
    this._items = props.items;
    this._totalAmountCents = this._items.reduce((total, item) => total + item.totalCents, 0);
    this._status = props.status ?? SaleStatus.COMPLETED;
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
  get totalAmountCents() {
    return this._totalAmountCents;
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
