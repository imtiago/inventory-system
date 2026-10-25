// src/scripts/fixBoxStock.ts
// Corrige alocações em caixas acima do saldo do lote (dados anteriores à onda 1 §5).
// Uso:
//   npm run fix-box-stock               # dry-run (padrão): só mostra o que mudaria
//   npm run fix-box-stock -- --dry-run  # idem
//   npm run fix-box-stock -- --apply    # grava as correções
// Só reduz/apaga InventoryBoxStock de lotes com Σ alocado > saldo, abatendo das
// alocações mais antigas primeiro (mesma regra das saídas). Idempotente: uma
// segunda execução não encontra nada para corrigir.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaInventoryBoxStockRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxStockRepository";
import {
  BoxAllocationChange,
  planBoxAllocationReduction,
} from "@inventory/domain/services/boxAllocations";

export interface DivergentLot {
  inventoryLotId: string;
  productVariantId: string;
  remainingQuantity: number;
  allocatedQuantity: number;
}

export interface FixBoxStockResult {
  apply: boolean;
  lots: DivergentLot[];
  changes: BoxAllocationChange[];
}

export interface FixBoxStockOptions {
  /** false (padrão) = dry-run, nada é gravado. */
  apply: boolean;
  /** Restringe a estes lotes (testes); sem isso, varre todos. */
  lotIds?: readonly string[];
  log?: (line: string) => void;
}

const USAGE = "Uso: npm run fix-box-stock [-- --dry-run | --apply]";

export function parseFixBoxStockArgs(argv: readonly string[]): { apply: boolean } {
  const unknown = argv.filter((a) => a !== "--apply" && a !== "--dry-run");
  if (unknown.length > 0) throw new Error(`Argumento desconhecido: ${unknown.join(" ")}. ${USAGE}`);
  if (argv.includes("--apply") && argv.includes("--dry-run")) {
    throw new Error(`Use --apply ou --dry-run, não os dois. ${USAGE}`);
  }
  return { apply: argv.includes("--apply") };
}

async function findDivergentLots(lotIds?: readonly string[]): Promise<DivergentLot[]> {
  if (lotIds && lotIds.length === 0) return [];
  const filter = lotIds ? Prisma.sql`WHERE l."id" IN (${Prisma.join([...lotIds])})` : Prisma.empty;
  return prisma.$queryRaw<DivergentLot[]>`
    SELECT l."id" AS "inventoryLotId", l."productVariantId", l."remainingQuantity",
           SUM(bs."quantity")::int AS "allocatedQuantity"
      FROM "InventoryLot" l
      JOIN "InventoryBoxStock" bs ON bs."inventoryLotId" = l."id"
      ${filter}
     GROUP BY l."id"
    HAVING SUM(bs."quantity") > l."remainingQuantity"
     ORDER BY l."id"`;
}

/** Plano sem travas nem escrita (dry-run). */
async function planFor(lot: DivergentLot): Promise<BoxAllocationChange[]> {
  const allocations = await prisma.inventoryBoxStock.findMany({
    where: { inventoryLotId: lot.inventoryLotId },
    select: { id: true, inventoryLotId: true, boxId: true, quantity: true, createdAt: true },
  });
  return planBoxAllocationReduction(allocations, new Map([[lot.inventoryLotId, lot.remainingQuantity]]));
}

/** Correção com as mesmas travas das saídas: inventário → (lote) → alocações. */
async function applyFor(lot: DivergentLot): Promise<BoxAllocationChange[]> {
  const transactions = new PrismaTransactionManager();
  const inventories = new PrismaInventoryRepository();
  const boxStocks = new PrismaInventoryBoxStockRepository();
  return transactions.execute(async () => {
    await inventories.lockExistingByProductVariantId(lot.productVariantId);
    // Relê sob trava: o saldo/alocações podem ter mudado desde a varredura.
    return boxStocks.reconcileBoxAllocations([lot.inventoryLotId]);
  });
}

export async function fixBoxStock(options: FixBoxStockOptions): Promise<FixBoxStockResult> {
  const log = options.log ?? ((line: string) => console.log(line));
  const mode = options.apply ? "apply" : "dry-run";
  log(
    options.apply
      ? "fix-box-stock (apply): gravando correções."
      : "fix-box-stock (dry-run): nada será gravado; use --apply para corrigir.",
  );

  const lots = await findDivergentLots(options.lotIds);
  if (lots.length === 0) {
    log("Nenhuma alocação acima do saldo.");
    return { apply: options.apply, lots: [], changes: [] };
  }

  const changes: BoxAllocationChange[] = [];
  for (const lot of lots) {
    const lotChanges = options.apply ? await applyFor(lot) : await planFor(lot);
    const boxes = await prisma.inventoryBox.findMany({
      where: { id: { in: lotChanges.map((c) => c.boxId) } },
      select: { id: true, code: true },
    });
    const codeOf = new Map(boxes.map((b) => [b.id, b.code]));
    log(
      `[${mode}] Lote ${lot.inventoryLotId} (variante ${lot.productVariantId}): ` +
        `saldo ${lot.remainingQuantity}, alocado ${lot.allocatedQuantity}, ` +
        `excesso ${lot.allocatedQuantity - lot.remainingQuantity}`,
    );
    for (const c of lotChanges) {
      log(
        `[${mode}]   caixa ${codeOf.get(c.boxId) ?? "?"} (${c.boxId}): ${c.previousQuantity} → ${c.quantity}` +
          (c.quantity === 0 ? " (alocação apagada)" : ""),
      );
    }
    changes.push(...lotChanges);
  }

  log(
    `[${mode}] ${lots.length} lote(s) com alocação acima do saldo; ` +
      `${changes.length} alocação(ões) ${options.apply ? "ajustada(s)" : "a ajustar"}.`,
  );
  return { apply: options.apply, lots, changes };
}

async function main(): Promise<void> {
  try {
    const { apply } = parseFixBoxStockArgs(process.argv.slice(2));
    await fixBoxStock({ apply });
  } catch (error) {
    console.error(`Falha ao corrigir alocações em caixas: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
