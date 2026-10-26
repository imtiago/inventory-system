/**
 * Busca literal para o `contains` do Prisma. Ele não escapa os curingas do LIKE, então
 * `%`, `_` e `\` do usuário são escapados aqui (o escape padrão do LIKE no Postgres é a barra
 * invertida). Use em toda busca por texto digitado: produto, cliente, fornecedor, usuário…
 */
export const escapeLike = (term: string): string => term.replace(/[\\%_]/g, "\\$&");

/** Filtro `contains` literal e sem diferenciar maiúsculas de minúsculas. */
export const containsLiteral = (term: string) => ({
  contains: escapeLike(term),
  mode: "insensitive" as const,
});
