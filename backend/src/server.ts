import { env } from "./shared/config/env";
import { app } from "./app";
import { prisma } from "./shared/prisma";
import { installGracefulShutdown } from "./shared/http/gracefulShutdown";

// Só o processo do servidor desconecta o Prisma ao fechar (testes compartilham o client).
app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

installGracefulShutdown(app, { timeoutMs: 10_000, exit: (code) => process.exit(code) });

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
