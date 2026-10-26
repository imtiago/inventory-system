import "dotenv/config";
import { z } from "zod";
import { isValidCnpj, normalizeDocument } from "@shared/domain/document";

export type TrustProxy = true | number | string[];

export type Env = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  PORT: number;
  HOST: string;
  isProduction: boolean;
  /** Origens permitidas no CORS; `undefined` = sem lista (só permitido fora de produção). */
  CORS_ORIGINS: string[] | undefined;
  /** Valor para o `trustProxy` do Fastify; `undefined` = não confiar em proxy. */
  TRUST_PROXY: TrustProxy | undefined;
  /** Desliga o rate limit global. Ignorado em produção. */
  RATE_LIMIT_DISABLED: boolean;
  /** CNPJ da empresa (normalizado, sem máscara): destinatário exigido nas NF-e importadas. Obrigatório em produção. */
  COMPANY_CNPJ: string | undefined;
};

const MIN_PRODUCTION_SECRET = 32;

const csv = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const schema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.url({ error: "deve ser uma URL válida" }),
  JWT_SECRET: z.string({ error: "obrigatório" }).min(1, "obrigatório"),
  PORT: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? "3000" : v))
    .pipe(
      z
        .string()
        .regex(/^\d+$/, "deve ser um inteiro entre 1 e 65535")
        .transform(Number)
        .pipe(z.number().int().min(1, "deve ser um inteiro entre 1 e 65535").max(65535, "deve ser um inteiro entre 1 e 65535")),
    ),
  HOST: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  RATE_LIMIT_DISABLED: z.string().optional(),
  COMPANY_CNPJ: z.string().optional(),
});

function parseTrustProxy(raw: string | undefined): TrustProxy | undefined {
  const v = raw?.trim();
  if (!v || v.toLowerCase() === "false") return undefined;
  if (v.toLowerCase() === "true") return true;
  if (/^\d+$/.test(v)) return Number(v);
  return csv(v);
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  const problems: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`${issue.path.join(".") || "(env)"}: ${issue.message}`);
    }
  }
  const isProduction = source.NODE_ENV === "production";
  const data = parsed.success ? parsed.data : undefined;

  const corsOrigins = data?.CORS_ORIGINS ? csv(data.CORS_ORIGINS) : [];
  if (isProduction) {
    if (data && data.JWT_SECRET.length < MIN_PRODUCTION_SECRET) {
      problems.push(
        `JWT_SECRET: em produção deve ter ao menos ${MIN_PRODUCTION_SECRET} caracteres (gere com: openssl rand -base64 48)`,
      );
    }
    if (corsOrigins.length === 0) {
      problems.push("CORS_ORIGINS: obrigatório em produção (origens separadas por vírgula)");
    }
  }

  const companyRaw = data?.COMPANY_CNPJ?.trim() ?? "";
  if (companyRaw !== "") {
    if (!isValidCnpj(companyRaw)) problems.push("COMPANY_CNPJ: deve ser um CNPJ válido (numérico ou alfanumérico)");
  } else if (isProduction) {
    problems.push("COMPANY_CNPJ: obrigatório em produção (CNPJ da empresa, destinatário das NF-e)");
  }

  if (problems.length > 0 || !data) {
    throw new Error(
      `Variáveis de ambiente inválidas:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
  }

  return {
    DATABASE_URL: data.DATABASE_URL,
    JWT_SECRET: data.JWT_SECRET,
    PORT: data.PORT,
    HOST: data.HOST?.trim() || "0.0.0.0",
    isProduction,
    CORS_ORIGINS: corsOrigins.length > 0 ? corsOrigins : undefined,
    TRUST_PROXY: parseTrustProxy(data.TRUST_PROXY),
    COMPANY_CNPJ: companyRaw !== "" ? normalizeDocument(companyRaw) : undefined,
    RATE_LIMIT_DISABLED:
      !isProduction && ["1", "true"].includes((data.RATE_LIMIT_DISABLED ?? "").toLowerCase()),
  };
}

export const env: Env = loadEnv();
