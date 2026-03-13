// src/shared/types/fastify.d.ts
import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      sub: string;
      role: string;
    };
  }
}
