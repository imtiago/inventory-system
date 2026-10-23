-- Marcas e categorias: nome único sem diferença de caixa.
-- Para cada tabela: (a) normaliza o nome (trim + espaços internos colapsados);
-- (b) mescla duplicatas por lower(name) — mantém a de menor createdAt (desempate
-- por id), repõe Product.brandId/categoryId para a mantida e apaga as demais;
-- (c) cria o índice único de expressão lower(name). O Prisma não modela índice
-- de expressão: ele existe só aqui (ver comentário no schema.prisma).

-- Brand ---------------------------------------------------------------------
UPDATE "Brand" SET "name" = regexp_replace(trim("name"), '\s+', ' ', 'g')
WHERE "name" <> regexp_replace(trim("name"), '\s+', ' ', 'g');

WITH ranked AS (
  SELECT "id",
         first_value("id") OVER (PARTITION BY lower("name") ORDER BY "createdAt", "id") AS "keepId"
  FROM "Brand"
)
UPDATE "Product" p
SET "brandId" = r."keepId"
FROM ranked r
WHERE p."brandId" = r."id" AND r."id" <> r."keepId";

WITH ranked AS (
  SELECT "id",
         first_value("id") OVER (PARTITION BY lower("name") ORDER BY "createdAt", "id") AS "keepId"
  FROM "Brand"
)
DELETE FROM "Brand" b
USING ranked r
WHERE b."id" = r."id" AND r."id" <> r."keepId";

CREATE UNIQUE INDEX "Brand_name_lower_key" ON "Brand" (lower("name"));

-- Category ------------------------------------------------------------------
UPDATE "Category" SET "name" = regexp_replace(trim("name"), '\s+', ' ', 'g')
WHERE "name" <> regexp_replace(trim("name"), '\s+', ' ', 'g');

WITH ranked AS (
  SELECT "id",
         first_value("id") OVER (PARTITION BY lower("name") ORDER BY "createdAt", "id") AS "keepId"
  FROM "Category"
)
UPDATE "Product" p
SET "categoryId" = r."keepId"
FROM ranked r
WHERE p."categoryId" = r."id" AND r."id" <> r."keepId";

WITH ranked AS (
  SELECT "id",
         first_value("id") OVER (PARTITION BY lower("name") ORDER BY "createdAt", "id") AS "keepId"
  FROM "Category"
)
DELETE FROM "Category" c
USING ranked r
WHERE c."id" = r."id" AND r."id" <> r."keepId";

CREATE UNIQUE INDEX "Category_name_lower_key" ON "Category" (lower("name"));
