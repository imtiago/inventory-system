import { FastifyReply } from "fastify";
import { ZodError } from "zod";

/** `"<path>: <mensagem>"` de cada issue, unidas por `"; "`. */
export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export function errorMessage(err: unknown): string {
  if (err instanceof ZodError) return formatZodError(err);
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Responde 400 com `{ message }` legível (issues Zod formatadas). */
export function sendBadRequest(reply: FastifyReply, err: unknown) {
  return reply.status(400).send({ message: errorMessage(err) });
}
