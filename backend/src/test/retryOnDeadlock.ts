import { Prisma } from "@prisma/client";

/**
 * Erro transitório de concorrência entre arquivos de teste paralelos no mesmo banco:
 * deadlock (40P01), falha de serialização em REPEATABLE READ (40001) ou o P2034 do Prisma
 * ("Transaction failed due to a write conflict or a deadlock").
 */
export function isRetryableConcurrencyError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  const text = error instanceof Error ? `${(error as { code?: string }).code ?? ""} ${error.message}` : String(error);
  return /40P01|40001|deadlock detected|could not serialize access|write conflict or a deadlock/i.test(text);
}

/**
 * Só para semear/isolar dados de TESTE: repete `work` (que precisa ser repetível, ex.: uma
 * transação desfeita no fim) quando o banco aborta por deadlock/serialização. Não use em
 * código de produção: lá o erro vira 409 CONCURRENT_UPDATE de propósito.
 */
export async function retryOnDeadlock<T>(work: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts || !isRetryableConcurrencyError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * attempt + Math.floor(Math.random() * 30)));
    }
  }
}
