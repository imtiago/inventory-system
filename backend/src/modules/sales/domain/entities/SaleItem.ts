import { BusinessRuleError, ErrorCodes, InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";

export class SaleItem extends BaseEntity {
  // referência
  private _variantId: string;

  // snapshot histórico da variante no momento da venda
  private _variantName: string;
  private _variantCode: string;
  private _barcode: string | null;

  // dados da venda (dinheiro em centavos inteiros)
  private _quantity: number;
  private _unitPriceCents: number;

  constructor(props: {
    id?: string;
    variantId: string;
    variantName: string;
    variantCode: string;
    barcode?: string | null;
    quantity: number;
    unitPriceCents: number;
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    if (!props.variantId.trim()) {
      throw new InternalInvariantError("Variant id is required.", InternalErrorCodes.SALE_ITEM_INVALID);
    }

    if (!props.variantName.trim()) {
      throw new InternalInvariantError("Variant name is required.", InternalErrorCodes.SALE_ITEM_INVALID);
    }

    if (!Number.isInteger(props.quantity) || props.quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }

    if (!Number.isInteger(props.unitPriceCents) || props.unitPriceCents < 0) {
      throw new InternalInvariantError("Unit price must be a non-negative integer in cents.", InternalErrorCodes.SALE_ITEM_INVALID);
    }

    this._variantId = props.variantId;
    this._variantName = props.variantName;
    this._variantCode = props.variantCode;
    this._barcode = props.barcode ?? null;
    this._quantity = props.quantity;
    this._unitPriceCents = props.unitPriceCents;
  }

  get variantId(): string {
    return this._variantId;
  }

  get variantName(): string {
    return this._variantName;
  }

  get variantCode(): string {
    return this._variantCode;
  }

  get barcode(): string | null {
    return this._barcode;
  }

  get quantity(): number {
    return this._quantity;
  }

  get unitPriceCents(): number {
    return this._unitPriceCents;
  }

  get totalCents(): number {
    return this._quantity * this._unitPriceCents;
  }
}
