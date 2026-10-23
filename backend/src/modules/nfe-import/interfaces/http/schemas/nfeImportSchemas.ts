import { z } from "zod";
import { toCents } from "@shared/domain/money";
import { dateOnlySchema } from "@shared/interfaces/http/schemas/dateOnlySchema";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { createProductSchema } from "@catalog/interfaces/http/schemas/productSchemas";
import { blankTo, salePriceSchema } from "@catalog/interfaces/http/schemas/createVariantSchema";
import { createSupplierBodySchema } from "@purchases/interfaces/http/schemas/supplierSchemas";
import { NFE_IMPORT_STATUSES } from "@nfe-import/domain/NfeImportStatus";

export const nfeImportIdParamsSchema = z.object({
  id: z.string().uuid("Identificador inválido."),
});

export const listNfeImportsSchema = paginationSchema.extend({
  status: z.enum(NFE_IMPORT_STATUSES, { error: "Status inválido." }).optional(),
});

/** Unidades por embalagem: inteiro ≥ 1 (padrão 1). */
const unitsPerPackageSchema = z
  .number({ error: "Unidades por embalagem deve ser um número." })
  .int("Unidades por embalagem deve ser inteiro.")
  .min(1, "Unidades por embalagem deve ser no mínimo 1.")
  .max(100_000, "Unidades por embalagem excede o máximo permitido.")
  .optional()
  .default(1);

const variantIdSchema = z.string({ error: "Informe a variante." }).uuid("Variante inválida.");

const linkSchema = z.object({ productVariantId: variantIdSchema, unitsPerPackage: unitsPerPackageSchema });

const createItemSchema = z
  .object({
    productId: z.string().uuid("Produto inválido.").optional(),
    newProduct: createProductSchema.optional(),
    variantName: z
      .string({ error: "Informe o nome da variante." })
      .trim()
      .min(1, "Informe o nome da variante.")
      .max(120, "O nome da variante deve ter no máximo 120 caracteres."),
    // Ausente → código de barras da nota; vazio/null → sem código de barras.
    barcode: z.preprocess(blankTo(null), z.string().max(60, "Código de barras muito longo.").nullable().optional()),
    salePrice: salePriceSchema,
    unitsPerPackage: unitsPerPackageSchema,
  })
  .refine((c) => (c.productId === undefined) !== (c.newProduct === undefined), {
    message: "Informe o produto existente ou os dados do produto novo.",
    path: ["productId"],
  });

const itemSchema = z
  .object({
    index: z.number({ error: "Informe o item da nota." }).int("Item inválido.").min(1, "Item inválido."),
    link: linkSchema.optional(),
    create: createItemSchema.optional(),
  })
  .refine((i) => (i.link === undefined) !== (i.create === undefined), {
    message: "Escolha vincular a uma variante ou criar.",
    path: ["link"],
  });

const supplierSchema = z.union(
  [
    z.object({ id: z.string().uuid("Fornecedor inválido.") }).strict(),
    z.object({ create: createSupplierBodySchema.omit({ document: true }) }).strict(),
  ],
  { error: "Informe o fornecedor existente ou os dados para cadastrá-lo." },
);

const hasAtMostTwoDecimals = (v: number) => Number.isInteger(Number((v * 100).toPrecision(15)));

const installmentSchema = z.object({
  dueDate: dateOnlySchema,
  amount: z
    .number({ error: "O valor da parcela deve ser um número." })
    .positive("O valor da parcela deve ser maior que zero.")
    .max(9_999_999_999, "O valor da parcela excede o máximo permitido.")
    .refine(hasAtMostTwoDecimals, "O valor da parcela deve ter no máximo 2 casas decimais."),
});

export const confirmNfeImportBodySchema = z
  .object(
    {
      supplier: supplierSchema,
      items: z
        .array(itemSchema, { error: "Informe os itens da nota." })
        .min(1, "Informe os itens da nota.")
        .max(990, "A nota pode ter no máximo 990 itens."),
      installments: z
        .array(installmentSchema, { error: "Parcelas inválidas." })
        .min(1, "Informe ao menos uma parcela.")
        .max(120, "No máximo 120 parcelas.")
        .optional(),
      receive: z.boolean({ error: "Informe se deve dar entrada no estoque." }),
    },
    { error: "Dados inválidos." },
  )
  .superRefine((data, ctx) => {
    const seen = new Set<number>();
    data.items.forEach((item, i) => {
      if (seen.has(item.index)) ctx.addIssue({ code: "custom", message: "Item da nota repetido.", path: ["items", i, "index"] });
      seen.add(item.index);
    });
  })
  .transform((data) => ({
    supplier:
      "id" in data.supplier
        ? { id: data.supplier.id }
        : {
            create: {
              name: data.supplier.create.name,
              email: data.supplier.create.email ?? null,
              phone: data.supplier.create.phone ?? null,
            },
          },
    items: data.items.map((item) =>
      item.link
        ? { index: item.index, link: item.link }
        : {
            index: item.index,
            create: {
              ...item.create!,
              newProduct: item.create!.newProduct
                ? { ...item.create!.newProduct, description: item.create!.newProduct.description ?? null }
                : undefined,
            },
          },
    ),
    installments: data.installments?.map((p) => ({ dueDate: p.dueDate, amountCents: toCents(p.amount) })),
    receive: data.receive,
  }));
