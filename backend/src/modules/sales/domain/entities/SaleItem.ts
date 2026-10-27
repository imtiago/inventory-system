import { BusinessRuleError, ErrorCodes, InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import type { Cost4 } from "@shared/domain/cost4";
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
  // custo médio da variante no momento da venda (null = venda anterior ao registro)
  private _unitCost4: Cost4 | null;

  constructor(props: {
    id?: string;
    variantId: string;
    variantName: string;
    variantCode: string;
    barcode?: string | null;
    quantity: number;
    unitPriceCents: number;
    unitCost4?: Cost4 | null;
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
    if (props.unitCost4 != null && (!Number.isSafeInteger(props.unitCost4) || props.unitCost4 < 0)) {
      throw new InternalInvariantError("Unit cost must be a non-negative integer (cost4).", InternalErrorCodes.SALE_ITEM_INVALID);
    }

    this._unitPriceCents = props.unitPriceCents;
    this._unitCost4 = props.unitCost4 ?? null;
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

  get unitCost4(): Cost4 | null {
    return this._unitCost4;
  }

  /** Registra o custo médio lido ao baixar o estoque. */
  recordUnitCost4(cost: Cost4): void {
    if (!Number.isSafeInteger(cost) || cost < 0) {
      throw new InternalInvariantError("Unit cost must be a non-negative integer (cost4).", InternalErrorCodes.SALE_ITEM_INVALID);
    }
    this._unitCost4 = cost;
  }

  get totalCents(): number {
    return this._quantity * this._unitPriceCents;
  }
}
