import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { divideCentsRoundHalfUp } from "@shared/domain/money";
import { invalidItemTotal } from "../errors/purchaseErrors";

export interface PurchaseItemProps {
  id?: string;
  productVariantId: string;
  quantity: number;
  /** Já recebido (Tarefa 3 incrementa via recebimento). */
  receivedQuantity?: number;
  unitPriceCents: number;
  discountCents?: number;
  freightCents?: number;
  taxCents?: number;
}

const isNonNegativeInt = (n: number) => Number.isSafeInteger(n) && n >= 0;

/**
 * Item do pedido, valores em centavos. total = quantidade × preço − desconto +
 * frete + imposto (≥ 0, senão 422 INVALID_ITEM_TOTAL); unitCost =
 * round-half-up(total / quantidade) — custo que entra no estoque.
 */
export class PurchaseItem extends BaseEntity {
  readonly productVariantId: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly discountCents: number;
  readonly freightCents: number;
  readonly taxCents: number;
  private _receivedQuantity: number;

  constructor(props: PurchaseItemProps) {
    super({ id: props.id });
    const discountCents = props.discountCents ?? 0;
    const freightCents = props.freightCents ?? 0;
    const taxCents = props.taxCents ?? 0;
    const receivedQuantity = props.receivedQuantity ?? 0;
    if (
      !Number.isSafeInteger(props.quantity) ||
      props.quantity < 1 ||
      !isNonNegativeInt(receivedQuantity) ||
      receivedQuantity > props.quantity ||
      ![props.unitPriceCents, discountCents, freightCents, taxCents].every(isNonNegativeInt)
    ) {
      throw new InternalInvariantError("Item de compra inválido.", InternalErrorCodes.PURCHASE_ITEM_INVALID);
    }
    this.productVariantId = props.productVariantId;
    this.quantity = props.quantity;
    this.unitPriceCents = props.unitPriceCents;
    this.discountCents = discountCents;
    this.freightCents = freightCents;
    this.taxCents = taxCents;
    this._receivedQuantity = receivedQuantity;

    if (this.totalCents < 0) throw invalidItemTotal();
  }

  get totalCents(): number {
    return this.quantity * this.unitPriceCents - this.discountCents + this.freightCents + this.taxCents;
  }

  get unitCostCents(): number {
    return divideCentsRoundHalfUp(this.totalCents, this.quantity);
  }

  get receivedQuantity(): number {
    return this._receivedQuantity;
  }

  get remainingQuantity(): number {
    return this.quantity - this._receivedQuantity;
  }

  /**
   * Soma `quantity` ao recebido. Só o agregado (Purchase.receive) chama, depois
   * de validar status e saldo; aqui apenas garante o invariante.
   */
  receive(quantity: number): void {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > this.remainingQuantity) {
      throw new InternalInvariantError("Recebimento de item inválido.", InternalErrorCodes.PURCHASE_ITEM_INVALID);
    }
    this._receivedQuantity += quantity;
  }

  /** Estorno de todo o recebido (importação de NF-e desfeita). Só o agregado chama. */
  revertReceipt(): void {
    this._receivedQuantity = 0;
  }
}
