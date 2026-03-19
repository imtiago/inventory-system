import { FastifyInstance } from "fastify";

export async function responseInterceptor(app: FastifyInstance) {
  app.addHook("onSend", async (request, reply, payload) => {
    try {
      const parsed = JSON.parse(payload as string);

      // Se já estiver padronizado, não mexe
      if (parsed?.success !== undefined) {
        return payload;
      }

      return JSON.stringify({
        success: true,
        data: parsed,
        message: null,
      });
    } catch {
      return payload;
    }
  });
}
