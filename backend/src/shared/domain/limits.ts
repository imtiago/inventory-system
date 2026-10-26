// Tetos de entrada compartilhados: valores acima estourariam colunas do banco
// (DECIMAL(12,2), INT) e virariam 500. Validar antes (Zod e use cases).

/** Teto das colunas DECIMAL(12,2), em centavos (9.999.999.999,99). */
export const MAX_AMOUNT_CENTS = 999_999_999_999;

/** Teto das colunas DECIMAL(12,2), em reais. */
export const MAX_AMOUNT = MAX_AMOUNT_CENTS / 100;

/** Quantidade máxima (em unidades) por item/operação de estoque, compra ou venda. */
export const MAX_QUANTITY = 1_000_000;

/** Itens por venda: cada item baixa estoque com trava dentro de uma única transação. */
export const MAX_SALE_ITEMS = 200;

/** Valor unitário máximo (preço/custo unitário, desconto/frete/imposto de um item). */
export const MAX_UNIT_VALUE = 1_000_000;
