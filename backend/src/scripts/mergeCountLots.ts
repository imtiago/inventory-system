// src/scripts/mergeCountLots.ts
// Une os lotes de contagem de 1 unidade criados pelo assistente de inventário
// inicial (um lote por leitura, antes da onda 5 §4) em um lote por variante e caixa.
// Uso:
//   npm run merge-count-lots               # simulação (padrão): só mostra o que uniria
//   npm run merge-count-lots -- --dry-run  # idem
//   npm run merge-count-lots -- --apply    # grava a união
//
// "Lote de contagem" (como o RegisterScannedProduct os criava): sourceType MANUAL,
// sem batchNumber, sem sourceId nem purchaseItemId, initialQuantity 1, alocado em
// uma única caixa e com uma movimentação IN de origem INVENTORY. Lotes de compra,
// NF-e, devolução, com lote informado ou entradas manuais comuns nunca entram.
//
// Grupo = mesma variante + mesma caixa + mesmas datas de validade/fabricação.
// O sobrevivente é o lote "aberto" CONT-<caixa>-<variante> se já existir (e tiver
// as mesmas datas); senão o mais antigo do grupo, que passa a ser o lote aberto.
// A união preserva: Σ saldo e Σ inicial, Σ alocação por caixa (a alocação do
// sobrevivente recebe a soma e as dos demais saem), o custo (média ponderada pela
// quantidade inicial, 2 casas) e o histórico (as movimentações dos lotes unidos
// passam a apontar para o sobrevivente). Os lotes unidos são apagados.
// Trava na mesma ordem das saídas: inventário (variante) → lotes (por id) →
// alocações. Idempotente: depois da união não sobra lote de contagem para unir.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";

export interface MergeGroup {
  productVariantId: string;
  boxId: string;
  boxCode: string;
  survivorId: string;
  mergedIds: string[];
  /** Σ do saldo (remainingQuantity) do grupo, já incluindo o sobrevivente. */
  quantity: number;
  unitCost: number;
  batchNumber: string | null;
}

export interface MergeCountLotsResult {
  apply: boolean;
  groups: MergeGroup[];
}

export interface MergeCountLotsOptions {
  /** false (padrão) = simulação, nada é gravado. */
  apply: boolean;
  /** Restringe a estas variantes (testes); sem isso, varre todas. */
  variantIds?: readonly string[];
  log?: (line: string) => void;
}

interface CandidateRow {
  id: string;
  productVariantId: string;
  boxId: string;
  boxCode: string;
  variantCode: string;
  createdAt: Date;
  expirationDate: Date | null;
  manufacturingDate: Date | null;
}

const USAGE = "Uso: npm run merge-count-lots [-- --dry-run | --apply]";

export function parseMergeCountLotsArgs(argv: readonly string[]): { apply: boolean } {
  const unknown = argv.filter((a) => a !== "--apply" && a !== "--dry-run");
  if (unknown.length > 0) throw new Error(`Argumento desconhecido: ${unknown.join(" ")}. ${USAGE}`);
  if (argv.includes("--apply") && argv.includes("--dry-run")) {
    throw new Error(`Use --apply ou --dry-run, não os dois. ${USAGE}`);
  }
  return { apply: argv.includes("--apply") };
}

const openBatchNumber = (boxCode: string, variantCode: string) => `CONT-${boxCode}-${variantCode}`;
const dayOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "-");

async function findCandidates(variantIds?: readonly string[]): Promise<CandidateRow[]> {
  if (variantIds && variantIds.length === 0) return [];
  const filter = variantIds
    ? Prisma.sql`AND l."productVariantId" IN (${Prisma.join([...variantIds])})`
    : Prisma.empty;
  return prisma.$queryRaw<CandidateRow[]>`
    SELECT l."id", l."productVariantId", bs."boxId", b."code" AS "boxCode", v."code" AS "variantCode",
           l."createdAt", l."expirationDate", l."manufacturingDate"
      FROM "InventoryLot" l
      JOIN "InventoryBoxStock" bs ON bs."inventoryLotId" = l."id"
      JOIN "InventoryBox" b ON b."id" = bs."boxId"
      JOIN "ProductVariant" v ON v."id" = l."productVariantId"
     WHERE l."sourceType" = 'MANUAL'
       AND l."batchNumber" IS NULL
       AND l."sourceId" IS NULL
       AND l."purchaseItemId" IS NULL
       AND l."initialQuantity" = 1
       AND (SELECT COUNT(*) FROM "InventoryBoxStock" x WHERE x."inventoryLotId" = l."id") = 1
       AND EXISTS (SELECT 1 FROM "StockMovement" m
                    WHERE m."inventoryLotId" = l."id" AND m."type" = 'IN' AND m."origin" = 'INVENTORY')
       ${filter}
     ORDER BY l."productVariantId", bs."boxId", l."createdAt", l."id"`;
}

interface PlannedGroup {
  productVariantId: string;
  boxId: string;
  boxCode: string;
  variantCode: string;
  /** Lotes legados, do mais antigo para o mais novo. */
  legacyIds: string[];
  /** Lote aberto já existente (criado pelo fluxo novo) com as mesmas datas, se houver. */
  openLotId: string | null;
}

async function planGroups(variantIds?: readonly string[]): Promise<PlannedGroup[]> {
  const byKey = new Map<string, CandidateRow[]>();
  for (const row of await findCandidates(variantIds)) {
    const key = [row.productVariantId, row.boxId, dayOf(row.expirationDate), dayOf(row.manufacturingDate)].join("|");
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  const groups: PlannedGroup[] = [];
  for (const rows of byKey.values()) {
    const first = rows[0];
    const open = await prisma.inventoryLot.findFirst({
      where: {
        productVariantId: first.productVariantId,
        batchNumber: openBatchNumber(first.boxCode, first.variantCode),
        sourceType: "MANUAL",
        boxStocks: { some: { boxId: first.boxId } },
      },
      select: { id: true, expirationDate: true, manufacturingDate: true },
    });
    const sameDates =
      open &&
      dayOf(open.expirationDate) === dayOf(first.expirationDate) &&
      dayOf(open.manufacturingDate) === dayOf(first.manufacturingDate);
    const openLotId = sameDates ? open.id : null;
    if (rows.length + (openLotId ? 1 : 0) < 2) continue;
    groups.push({
      productVariantId: first.productVariantId,
      boxId: first.boxId,
      boxCode: first.boxCode,
      variantCode: first.variantCode,
      legacyIds: rows.map((r) => r.id),
      openLotId,
    });
  }
  return groups;
}

/**
 * Lê o estado atual dos lotes do grupo e calcula a união. Em apply roda sob as
 * travas; em simulação é só leitura. Retorna null se o grupo mudou e não vale mais.
 */
async function mergeGroup(group: PlannedGroup, apply: boolean): Promise<MergeGroup | null> {
  const db = getDb();
  const ids = [...(group.openLotId ? [group.openLotId] : []), ...group.legacyIds];
  if (apply) {
    await db.$queryRaw`SELECT "id" FROM "InventoryLot" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
  }
  const lots = await db.inventoryLot.findMany({
    where: { id: { in: ids } },
    include: { boxStocks: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const legacy = lots.filter((l) => group.legacyIds.includes(l.id));
  const open = lots.find((l) => l.id === group.openLotId) ?? null;
  const stillValid =
    legacy.length === group.legacyIds.length &&
    legacy.every((l) => l.batchNumber === null && l.initialQuantity === 1 && l.boxStocks.length === 1 && l.boxStocks[0].boxId === group.boxId);
  if (!stillValid || legacy.length + (open ? 1 : 0) < 2) return null;

  const survivor = open ?? legacy[0];
  const merged = lots.filter((l) => l.id !== survivor.id);
  const batchTaken = await db.inventoryLot.findFirst({
    where: {
      productVariantId: group.productVariantId,
      batchNumber: openBatchNumber(group.boxCode, group.variantCode),
    },
    select: { id: true },
  });
  const batchNumber = survivor.batchNumber ?? (batchTaken ? null : openBatchNumber(group.boxCode, group.variantCode));

  const initialQuantity = lots.reduce((s, l) => s + l.initialQuantity, 0);
  const remainingQuantity = lots.reduce((s, l) => s + l.remainingQuantity, 0);
  const unitCost =
    Math.round((lots.reduce((s, l) => s + l.initialQuantity * Number(l.unitCost), 0) / initialQuantity) * 100) / 100;
  const boxQuantity = lots.reduce((s, l) => s + (l.boxStocks.find((b) => b.boxId === group.boxId)?.quantity ?? 0), 0);

  if (apply) {
    const mergedIds = merged.map((l) => l.id);
    await db.stockMovement.updateMany({ where: { inventoryLotId: { in: mergedIds } }, data: { inventoryLotId: survivor.id } });
    await db.inventoryBoxStock.deleteMany({ where: { inventoryLotId: { in: mergedIds } } });
    await db.inventoryLot.deleteMany({ where: { id: { in: mergedIds } } });
    await db.inventoryLot.update({
      where: { id: survivor.id },
      data: { initialQuantity, remainingQuantity, unitCost, batchNumber },
    });
    await db.inventoryBoxStock.upsert({
      where: { inventoryLotId_boxId: { inventoryLotId: survivor.id, boxId: group.boxId } },
      update: { quantity: boxQuantity },
      create: { inventoryLotId: survivor.id, boxId: group.boxId, quantity: boxQuantity },
    });
  }

  return {
    productVariantId: group.productVariantId,
    boxId: group.boxId,
    boxCode: group.boxCode,
    survivorId: survivor.id,
    mergedIds: merged.map((l) => l.id),
    quantity: remainingQuantity,
    unitCost,
    batchNumber,
  };
}

export async function mergeCountLots(options: MergeCountLotsOptions): Promise<MergeCountLotsResult> {
  const log = options.log ?? ((line: string) => console.log(line));
  const mode = options.apply ? "apply" : "dry-run";
  log(
    options.apply
      ? "merge-count-lots (apply): unindo lotes de contagem."
      : "merge-count-lots (dry-run): nada será gravado; use --apply para unir.",
  );

  const planned = await planGroups(options.variantIds);
  if (planned.length === 0) {
    log("Nenhum lote de contagem para unir.");
    return { apply: options.apply, groups: [] };
  }

  const transactions = new PrismaTransactionManager();
  const inventories = new PrismaInventoryRepository();
  const groups: MergeGroup[] = [];
  for (const group of planned) {
    const result = options.apply
      ? await transactions.execute(async () => {
          // Mesma ordem das saídas: inventário (variante) → lotes → alocações.
          await inventories.lockExistingByProductVariantId(group.productVariantId);
          return mergeGroup(group, true);
        })
      : await mergeGroup(group, false);
    if (!result) {
      log(`[${mode}] Grupo da variante ${group.productVariantId}, caixa ${group.boxCode}: mudou desde a varredura; ignorado.`);
      continue;
    }
    log(
      `[${mode}] Variante ${result.productVariantId}, caixa ${result.boxCode} (${result.boxId}): ` +
        `${result.mergedIds.length + 1} lotes → ${result.survivorId} ` +
        `(saldo ${result.quantity}, custo ${result.unitCost}, lote ${result.batchNumber ?? "sem número"}); ` +
        `${options.apply ? "apagados" : "a apagar"}: ${result.mergedIds.join(", ")}`,
    );
    groups.push(result);
  }

  const lotCount = groups.reduce((s, g) => s + g.mergedIds.length, 0);
  log(`[${mode}] ${groups.length} grupo(s); ${lotCount} lote(s) ${options.apply ? "unido(s)" : "a unir"}.`);
  return { apply: options.apply, groups };
}

async function main(): Promise<void> {
  try {
    const { apply } = parseMergeCountLotsArgs(process.argv.slice(2));
    await mergeCountLots({ apply });
  } catch (error) {
    console.error(`Falha ao unir lotes de contagem: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
