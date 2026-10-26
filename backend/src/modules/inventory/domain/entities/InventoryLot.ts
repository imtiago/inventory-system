import { roundCost } from "@shared/domain/money";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { InventoryLotSource } from "../enums/InventoryLotSource";
import { BusinessRuleError, ErrorCodes } from "@shared/domain/errors";

interface InventoryLotProps {
  id?: string;

  inventoryId: string;
  productVariantId: string;

  sourceType: InventoryLotSource;
  sourceId?: string | null;

  /** Item de pedido de compra que originou o lote (recebimento de compra). */
  purchaseItemId?: string | null;

  initialQuantity: number;
  remainingQuantity?: number;

  unitCost: number;

  /** Parte do unitCost vinda de frete/despesas/impostos, por unidade (4 casas). */
  acquisitionExtraCost?: number;

  batchNumber?: string | null;

  manufacturingDate?: Date | null;
  expirationDate?: Date | null;

  createdAt?: Date;
}

export class InventoryLot extends BaseEntity {
  private props: InventoryLotProps & { remainingQuantity: number };

  constructor(props: InventoryLotProps) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });

    this.props = {
      ...props,
      remainingQuantity: props.remainingQuantity ?? props.initialQuantity,
    };

    this.validate();
  }

  get inventoryId() {
    return this.props.inventoryId;
  }

  get productVariantId() {
    return this.props.productVariantId;
  }

  get sourceType() {
    return this.props.sourceType;
  }

  get sourceId() {
    return this.props.sourceId;
  }

  get purchaseItemId() {
    return this.props.purchaseItemId ?? null;
  }

  get initialQuantity() {
    return this.props.initialQuantity;
  }

  get remainingQuantity() {
    return this.props.remainingQuantity;
  }

  get unitCost() {
    return this.props.unitCost;
  }

  get acquisitionExtraCost() {
    return this.props.acquisitionExtraCost ?? 0;
  }

  get batchNumber() {
    return this.props.batchNumber;
  }

  get manufacturingDate() {
    return this.props.manufacturingDate;
  }

  get expirationDate() {
    return this.props.expirationDate;
  }

  /**
   * Soma uma entrada ao lote. Com `unitCost`, o custo do lote vira a média
   * ponderada pelo saldo (4 casas). Datas só são preenchidas se o lote não as tem.
   */
  public receive(
    quantity: number,
    entry: { unitCost?: number; acquisitionExtraCost?: number; expirationDate?: Date | null; manufacturingDate?: Date | null } = {},
  ): void {
    if (quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }

    if (entry.unitCost !== undefined) {
      const total = this.props.remainingQuantity + quantity;
      const weighted =
        (this.props.remainingQuantity * this.props.unitCost + quantity * entry.unitCost) / total;
      this.props.unitCost = roundCost(weighted);
      const extraWeighted =
        (this.props.remainingQuantity * this.acquisitionExtraCost + quantity * (entry.acquisitionExtraCost ?? 0)) / total;
      this.props.acquisitionExtraCost = roundCost(extraWeighted);
    }
    if (!this.props.expirationDate && entry.expirationDate) {
      this.props.expirationDate = entry.expirationDate;
    }
    if (!this.props.manufacturingDate && entry.manufacturingDate) {
      this.props.manufacturingDate = entry.manufacturingDate;
    }

    this.props.initialQuantity += quantity;
    this.props.remainingQuantity += quantity;
  }

  public consume(quantity: number): void {
    if (quantity <= 0) {
      throw new BusinessRuleError("Quantidade inválida.", ErrorCodes.INVALID_QUANTITY);
    }

    if (quantity > this.props.remainingQuantity) {
      throw new BusinessRuleError("Quantidade insuficiente no lote.", ErrorCodes.INSUFFICIENT_STOCK);
    }

    this.props.remainingQuantity -= quantity;
  }

  public restore(quantity: number): void {
    if (quantity <= 0) {
      throw new BusinessRuleError("Quantidade inválida.", ErrorCodes.INVALID_QUANTITY);
    }

    if (this.props.remainingQuantity + quantity > this.props.initialQuantity) {
      throw new BusinessRuleError("Quantidade de restauração inválida.", ErrorCodes.INVALID_QUANTITY);
    }

    this.props.remainingQuantity += quantity;
  }

  public isEmpty(): boolean {
    return this.props.remainingQuantity === 0;
  }

  public isExpired(reference = new Date()): boolean {
    if (!this.props.expirationDate) {
      return false;
    }

    return this.props.expirationDate < reference;
  }

  private validate() {
    if (this.props.initialQuantity <= 0) {
      throw new BusinessRuleError("Quantidade inválida.", ErrorCodes.INVALID_QUANTITY);
    }

    if (this.props.remainingQuantity < 0) {
      throw new BusinessRuleError("Quantidade restante inválida.", ErrorCodes.INVALID_QUANTITY);
    }

    if (this.props.remainingQuantity > this.props.initialQuantity) {
      throw new BusinessRuleError("A quantidade restante excede a quantidade inicial.", ErrorCodes.INVALID_QUANTITY);
    }

    if ((this.props.acquisitionExtraCost ?? 0) < 0) {
      throw new BusinessRuleError("Custo extra de aquisição inválido.", ErrorCodes.INVALID_UNIT_COST);
    }

    if (this.props.unitCost < 0) {
      throw new BusinessRuleError("Custo unitário inválido.", ErrorCodes.INVALID_UNIT_COST);
    }
  }
}
