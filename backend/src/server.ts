import { env } from "./shared/config/env";
import { app } from "./app";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`${signal} recebido: encerrando...`);
  const timer = setTimeout(() => {
    app.log.error("Encerramento excedeu 10 s; saindo à força.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();
  try {
    // Para de aceitar conexões e espera as requisições em andamento; o hook
    // onClose desconecta o Prisma.
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
