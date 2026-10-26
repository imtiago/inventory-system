import { IAdjustInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes, InternalErrorCodes, InternalInvariantError, NotFoundError } from "@shared/domain/errors";

export class AdjustInventoryUseCase extends TransactionalUseCase<
  IAdjustInventoryInput,
  StockMovement | null
> {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly inventoryLotRepository: IInventoryLotRepository,
    private readonly stockMovementRepository: IStockMovementRepository,
    private readonly inventoryBoxStockRepository: Pick<
      IInventoryBoxStockRepository,
      "reconcileBoxAllocations"
    >,
    transactionManager: TransactionManager,
    /** Código legível do pedido de compra (origem PURCHASE); null → usa o id curto. */
    private readonly resolvePurchaseCode: (purchaseId: string) => Promise<string | null> = async () => null,
  ) {
    super(transactionManager);
  }

  protected async handle(
    request: IAdjustInventoryInput,
  ): Promise<StockMovement | null> {
    // Trava a linha da variante antes de ler saldo/lotes (sem criar inventário).
    const inventory = await this.inventoryRepository.lockExistingByProductVariantId(
      request.productVariantId,
    );
    if (!inventory) {
      throw new NotFoundError("Estoque não encontrado.", ErrorCodes.INVENTORY_NOT_FOUND);
    }

    const previousQuantity = inventory.quantity;
    const previousReserved = inventory.reservedQuantity;
    const counted = request.countedQuantity;

    // Contar abaixo do reservado cortaria reservas de pedidos sem rastro: recusa.
    if (counted >= 0 && counted < previousReserved) {
      throw new ConflictError(
        `Há ${previousReserved} unidade(s) reservada(s) para: ${await this.describeReservations(inventory)}. Libere as reservas antes de ajustar abaixo disso.`,
        ErrorCodes.ADJUST_BELOW_RESERVED,
      );
    }
    const difference = counted - previousQuantity;

    // Valida a contagem (não negativa) antes de qualquer gravação.
    inventory.adjust(counted);
    if (difference === 0) {
      return null;
    }

    const notes = this.withReserved(request.notes, previousReserved);
    const newMovement = (lotId: string, quantity: number, previous: number, current: number) =>
      new StockMovement({
        inventoryId: inventory.id,
        inventoryLotId: lotId,
        productVariantId: inventory.productVariantId,
        type: StockMovementType.ADJUSTMENT,
        origin: StockMovementOrigin.INVENTORY,
        quantity,
        previousQuantity: previous,
        currentQuantity: current,
        averageCost: inventory.averageCost,
        userId: request.userId,
        notes,
      });

    if (difference > 0) {
      const lot = new InventoryLot({
        inventoryId: inventory.id,
        productVariantId: inventory.productVariantId,
        sourceType: InventoryLotSource.MANUAL,
        initialQuantity: difference,
        unitCost: inventory.averageCost,
      });
      await this.inventoryRepository.update(inventory);
      await this.inventoryLotRepository.create(lot);
      const movement = newMovement(lot.id, difference, previousQuantity, inventory.quantity);
      await this.stockMovementRepository.create(movement);
      return movement;
    }

    const lots = await this.inventoryLotRepository.findAvailableByInventory(inventory.id);
    const touched: { lot: InventoryLot; quantity: number }[] = [];
    let remaining = -difference;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, lot.remainingQuantity);
      lot.consume(quantity);
      touched.push({ lot, quantity });
      remaining -= quantity;
    }
    if (remaining > 0) {
      throw new InternalInvariantError("Os lotes do estoque estão inconsistentes.", InternalErrorCodes.INVENTORY_LOTS_INCONSISTENT);
    }
    await this.inventoryRepository.update(inventory);
    for (const { lot } of touched) {
      await this.inventoryLotRepository.update(lot);
    }
    // Saldo dos lotes caiu: alocações em caixas não podem passar dele.
    await this.inventoryBoxStockRepository.reconcileBoxAllocations(touched.map(({ lot }) => lot.id));

    // Uma movimentação por lote tocado, com saldos encadeados (igual à saída de venda).
    const movements: StockMovement[] = [];
    let balance = previousQuantity;
    for (const { lot, quantity } of touched) {
      const movement = newMovement(lot.id, quantity, balance, balance - quantity);
      balance -= quantity;
      await this.stockMovementRepository.create(movement);
      movements.push(movement);
    }
    if (movements.length === 1) return movements[0];

    // A resposta HTTP é uma só: resumo do ajuste (não gravado), com o id da primeira movimentação.
    return new StockMovement({
      id: movements[0].id,
      inventoryId: inventory.id,
      inventoryLotId: null,
      productVariantId: inventory.productVariantId,
      type: StockMovementType.ADJUSTMENT,
      origin: StockMovementOrigin.INVENTORY,
      quantity: -difference,
      previousQuantity,
      currentQuantity: inventory.quantity,
      averageCost: inventory.averageCost,
      userId: request.userId,
      notes,
      createdAt: movements[0].createdAt,
    });
  }

  /** O ajuste não altera o reservado; ele fica registrado nas notas da movimentação. */
  private withReserved(notes: string | undefined, reserved: number): string | undefined {
    if (reserved <= 0) return notes;
    return notes ? `${notes} (reservado: ${reserved})` : `Reservado: ${reserved}`;
  }

  private async documentLabel(key: string): Promise<string> {
    const [origin, originId] = key.split("|");
    if (!originId) return key;
    const short = originId.slice(0, 8).toUpperCase();
    if (origin === StockMovementOrigin.SALE) return `Venda #${short}`;
    if (origin === StockMovementOrigin.PURCHASE) {
      const code = await this.resolvePurchaseCode(originId);
      return code ? `Pedido ${code}` : `${origin} ${short}`;
    }
    return `${origin} ${short}`;
  }

  /** Documentos com reserva em aberto: Σ RESERVE − Σ RELEASE por origem + originId. */
  private async describeReservations(inventory: Inventory): Promise<string> {
    const movements = await this.stockMovementRepository.findByProductVariantId(
      inventory.productVariantId,
    );
    const open = new Map<string, number>();
    let identified = 0;
    for (const m of movements) {
      if (m.inventoryId !== inventory.id) continue;
      const sign =
        m.type === StockMovementType.RESERVE ? 1 : m.type === StockMovementType.RELEASE ? -1 : 0;
      if (sign === 0) continue;
      const key = m.originId ? `${m.origin}|${m.originId}` : "documento não identificado";
      open.set(key, (open.get(key) ?? 0) + sign * m.quantity);
    }
    const labels: string[] = [];
    for (const [key, qty] of open) {
      if (qty <= 0) continue;
      labels.push(`${await this.documentLabel(key)} (${qty})`);
      identified += qty;
    }
    // Reserva sem movimentação correspondente (dados antigos): não some da mensagem.
    if (identified < inventory.reservedQuantity) {
      labels.push(`documento não identificado (${inventory.reservedQuantity - identified})`);
    }
    return labels.join(", ");
  }
}
