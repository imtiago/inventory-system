import type { FastifyBaseLogger } from "fastify";

export type ClosableApp = {
  close: () => PromiseLike<unknown>;
  log: Pick<FastifyBaseLogger, "info" | "error">;
};

export type GracefulShutdownOptions = {
  timeoutMs: number;
  exit: (code: number) => void;
  /** Fonte dos sinais; padrão `process`. */
  signals?: Pick<NodeJS.Process, "on">;
};

/**
 * Instala SIGTERM/SIGINT: para de aceitar conexões, espera as requisições em
 * andamento (`app.close()`) e sai com 0; se travar além de `timeoutMs`, sai com 1.
 */
export function installGracefulShutdown(
  app: ClosableApp,
  options: GracefulShutdownOptions,
): (signal: string) => Promise<void> {
  const { timeoutMs, exit, signals = process } = options;
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`${signal} recebido: encerrando...`);
    const timer = setTimeout(() => {
      app.log.error(`Encerramento excedeu ${timeoutMs} ms; saindo à força.`);
      exit(1);
    }, timeoutMs);
    try {
      await app.close();
      clearTimeout(timer);
      exit(0);
    } catch (err) {
      clearTimeout(timer);
      app.log.error(err);
      exit(1);
    }
  };

  signals.on("SIGTERM", () => void shutdown("SIGTERM"));
  signals.on("SIGINT", () => void shutdown("SIGINT"));
  return shutdown;
}
