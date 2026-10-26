// Proteção do seed (`prisma/seed.ts`): ele grava clientes fictícios, então só roda
// em banco de desenvolvimento vazio, ou com `--force` em banco que já tem dados.

export interface SeedGuardInput {
  nodeEnv: string | undefined;
  /** `--force` na linha de comando. */
  force: boolean;
  /** Já existe marca, categoria, cliente ou produto no banco. */
  hasData: boolean;
}

/** Devolve a mensagem de recusa (PT-BR) ou `null` se o seed pode rodar. */
export function checkSeedAllowed({ nodeEnv, force, hasData }: SeedGuardInput): string | null {
  if (nodeEnv === "production") {
    return "O seed não roda em produção (NODE_ENV=production): ele grava clientes fictícios.";
  }
  if (hasData && !force) {
    return "O banco já tem dados; o seed grava clientes fictícios. Use --force se for mesmo o que você quer.";
  }
  return null;
}
