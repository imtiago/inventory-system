// src/scripts/creditReview.ts
// Revisão periódica do limite de crédito (spec §5): sobe/desce o perfil e suspende por atraso, aplicando
// direto (sem prévia) e registrando cada mudança no histórico da ficha. Uso:
//   npm run credit-review                 # mensal, via cron (fica DESLIGADO até a dona aprovar os pesos)
//   npm run credit-review -- --allow-test # só para banco *_test
// Idempotente no dia: quem já teve revisão automática hoje não é revisado de novo.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { databaseName } from "../test/testDatabase";
import { makeRunCreditReviewUseCase } from "@credit/infrastructure/factories/creditFactories";
import type { CreditReviewItem } from "@credit/application/useCases/RunCreditReviewUseCase";

const USAGE = "Uso: npm run credit-review [-- --allow-test]";

export function parseCreditReviewArgs(argv: readonly string[]): { allowTest: boolean } {
  const unknown = argv.filter((a) => a !== "--allow-test");
  if (unknown.length > 0) throw new Error(`Argumento desconhecido: ${unknown.join(" ")}. ${USAGE}`);
  return { allowTest: argv.includes("--allow-test") };
}

/** Mensagem de recusa (PT-BR) ou `null` se pode rodar. Banco `*_test` exige `--allow-test`. */
export function checkReviewDatabase(url: string | undefined, allowTest: boolean): string | null {
  if (!url) return "DATABASE_URL não definida.";
  let name: string;
  try {
    name = databaseName(url);
  } catch (error) {
    return (error as Error).message;
  }
  if (name.endsWith("_test") && !allowTest) {
    return `Recusado: "${name}" é um banco de testes. Use --allow-test se for mesmo o que você quer.`;
  }
  return null;
}

export function formatReviewSummary(items: readonly Pick<CreditReviewItem, "action">[]): string {
  const count = (a: CreditReviewItem["action"]) => items.filter((i) => i.action === a).length;
  return `${items.length} clientes revisados: ${count("UP")} subiram, ${count("DOWN")} desceram, ${count("SUSPEND")} suspensos`;
}

export interface RunCreditReviewOptions {
  /** Restringe a estes clientes (testes); sem isso, revisa todos. */
  customerIds?: string[];
  log?: (line: string) => void;
}

export async function runCreditReview(options: RunCreditReviewOptions = {}): Promise<CreditReviewItem[]> {
  const log = options.log ?? ((line: string) => console.log(line));
  const items = await makeRunCreditReviewUseCase().apply({
    today: todayInBusinessTz(),
    customerIds: options.customerIds,
    userId: null,
  });
  for (const i of items) log(`- ${i.customerName}: ${i.reason}`);
  log(formatReviewSummary(items));
  return items;
}

async function main(): Promise<void> {
  try {
    const { allowTest } = parseCreditReviewArgs(process.argv.slice(2));
    const refusal = checkReviewDatabase(process.env.DATABASE_URL, allowTest);
    if (refusal) throw new Error(refusal);
    await runCreditReview();
  } catch (error) {
    console.error(`Falha na revisão de crédito: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
