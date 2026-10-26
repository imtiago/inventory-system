// Formas das linhas lidas do banco que os mappers de leitura consomem. São estruturais
// (sem importar o Prisma na camada de aplicação): se o `include` ou o schema mudar, o
// repositório deixa de compilar em vez de devolver campo `undefined`.

/** Decimal do Prisma (ou número): só é lido via `Number(...)`. */
export type DecimalLike = { toString(): string } | number;

export interface InventoryRow {
  id: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  minimumStock: number;
  averageCost: DecimalLike;
  createdAt: Date;
}

export interface ProductVariantRow {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  productId: string;
  createdAt: Date;
}

/** O resumo só usa estes campos da variante. */
export type ProductVariantSummaryRow = Pick<ProductVariantRow, "id" | "code" | "name" | "barcode" | "productId">;

export interface InventoryLotRow {
  id: string;
  inventoryId: string;
  productVariantId: string;
  batchNumber: string | null;
  initialQuantity: number;
  remainingQuantity: number;
  unitCost: DecimalLike;
  acquisitionExtraCost: DecimalLike;
  sourceType: string;
  manufacturingDate: Date | null;
  expirationDate: Date | null;
  createdAt: Date;
  /** Só a quantidade de cada caixa (para `allocatedQuantity`). */
  boxStocks: { quantity: number }[];
}

export interface InventoryBoxRow {
  id: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryBoxStockRow {
  id: string;
  boxId: string;
  inventoryLotId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export type InventoryBoxStockWithLotRow = InventoryBoxStockRow & {
  inventoryLot: InventoryLotRow & { productVariant: ProductVariantSummaryRow };
};

export type InventoryBoxWithStocksRow = InventoryBoxRow & { stocks: InventoryBoxStockWithLotRow[] };

export interface StockMovementRow {
  id: string;
  inventoryId: string;
  productVariantId: string;
  quantity: number;
  type: string;
  origin: string;
  originId: string | null;
  userId: string | null;
  notes: string | null;
  createdAt: Date;
  inventory: InventoryRow;
  user: { id: string; name: string } | null;
  productVariant: ProductVariantRow;
}
