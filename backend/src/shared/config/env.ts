import "dotenv/config";

export type Env = { JWT_SECRET: string };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const JWT_SECRET = source.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET não definido.");
  }
  return { JWT_SECRET };
}

export const env: Env = loadEnv();
