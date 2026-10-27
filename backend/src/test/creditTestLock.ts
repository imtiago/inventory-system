import { prisma } from "@shared/prisma";

/**
 * Configurações e perfis de crédito são globais (linha única / 4 linhas) e os arquivos de teste rodam em
 * paralelo no mesmo banco. Quem altera essas linhas — ou afirma valores que dependem delas (limite inicial
 * de cliente novo, carência) — segura este lock (advisory de transação, chave só dos testes) o arquivo todo.
 */
export async function acquireCreditTestLock(): Promise<() => Promise<void>> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let acquired!: () => void;
  let failed!: (e: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => ((acquired = resolve), (failed = reject)));
  const tx = prisma
    .$transaction(
      async (db) => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('credit_settings_test'))`;
        acquired();
        await held;
      },
      { timeout: 600_000, maxWait: 600_000 },
    )
    .catch(failed);
  await ready;
  return async () => {
    release();
    await tx;
  };
}
