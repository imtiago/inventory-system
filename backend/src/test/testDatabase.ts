export function databaseName(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL de banco inválida.");
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
}

export function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** Recusa qualquer banco cujo nome não termine em `_test`. */
export function assertTestDatabase(url: string | undefined): string {
  if (!url) throw new Error("URL do banco de testes não definida (TEST_DATABASE_URL).");
  const name = databaseName(url);
  if (!name.endsWith("_test")) {
    throw new Error(
      `Abortado: o banco "${name}" não termina em "_test". Os testes apagam dados e só podem rodar em um banco de testes.`,
    );
  }
  return url;
}

/** Escolhe a URL de testes: TEST_DATABASE_URL, ou DATABASE_URL quando CI=true. */
export function resolveTestDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const url = env.TEST_DATABASE_URL || (env.CI === "true" ? env.DATABASE_URL : undefined);
  return assertTestDatabase(url);
}
