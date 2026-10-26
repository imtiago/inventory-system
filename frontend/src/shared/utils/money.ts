const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Reais (decimal, até 2 casas) -> centavos inteiros. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatCents(cents: number): string {
  return formatCurrency(fromCents(cents));
}

export const MONEY_DECIMALS_MESSAGE = 'Use no máximo 2 casas decimais';
export const MONEY_INVALID_MESSAGE = 'Valor inválido';
export const MONEY_NEGATIVE_MESSAGE = 'O valor não pode ser negativo';
export const MONEY_REQUIRED_MESSAGE = 'Informe um valor';

type ParsedMoney = { kind: 'ok'; cents: number } | { kind: 'empty' } | { kind: 'invalid' } | { kind: 'decimals' };

// Com vírgula: "." só pode ser separador de milhar (grupos de 3 dígitos, primeiro grupo 1-3 dígitos sem zero à esquerda).
const WITH_COMMA = /^(?:[1-9]\d{0,2}(?:\.\d{3})+|\d*),(\d*)$/;
const THOUSANDS_ONLY = /^[1-9]\d{0,2}(?:\.\d{3})+$/;
const DOT_DECIMAL = /^\d+\.(\d{1,2})$/;

/**
 * Interpreta dinheiro digitado no formato brasileiro: "," é o decimal e "." é o milhar ("1.234,56", "1.000", "12,5").
 *
 * Decisão sobre o ponto SEM vírgula (as telas preenchem com vírgula, mas no celular muita gente digita ponto):
 * - ponto seguido de exatamente 3 dígitos é milhar ("1.000" = R$ 1.000,00, nunca R$ 1,00);
 * - ponto seguido de 1 ou 2 dígitos é decimal ("39.9" = 39,90; "12.50" = 12,50);
 * - qualquer outra posição do ponto ("1.2345", "0.500", "1..000") é inválida ou excede 2 casas.
 * Com vírgula, o ponto só vale como milhar, então "1.23,4" é inválido.
 */
function parseMoney(text: string): ParsedMoney & { negative?: boolean } {
  let body = text.replace(/R\$/gi, '').replace(/\s/g, '');
  if (body === '') return { kind: 'empty' };
  const negative = body.startsWith('-');
  if (negative) body = body.slice(1);
  if (body === '') return { kind: 'invalid' };

  let integer: string;
  let decimals = '';

  if (/^\d+$/.test(body)) {
    integer = body;
  } else if (body.includes(',')) {
    const match = WITH_COMMA.exec(body);
    if (!match || (match[0] === ',' )) return { kind: 'invalid' };
    [integer, decimals] = [body.slice(0, body.indexOf(',')).replace(/\./g, ''), match[1]];
  } else if (THOUSANDS_ONLY.test(body)) {
    integer = body.replace(/\./g, '');
  } else if (DOT_DECIMAL.test(body)) {
    const [whole, frac] = body.split('.');
    [integer, decimals] = [whole, frac];
  } else if (/^\d+\.\d{4,}$/.test(body)) {
    return { kind: 'decimals' };
  } else {
    return { kind: 'invalid' };
  }

  if (decimals.length > 2) return { kind: 'decimals' };
  const magnitude = Number(integer || '0') * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(magnitude)) return { kind: 'invalid' };

  return { kind: 'ok', cents: negative ? -magnitude : magnitude };
}

/** Texto digitado -> centavos inteiros; null quando vazio, inválido ou com mais de 2 casas decimais. */
export function parseMoneyToCents(text: string): number | null {
  const parsed = parseMoney(text);

  return parsed.kind === 'ok' ? parsed.cents : null;
}

/**
 * Mensagem de validação para o texto digitado, ou null quando válido.
 * Vazio: erro de obrigatório, a menos que `allowEmpty`. Negativo: erro, a menos que `allowNegative`.
 */
export function moneyTextError(text: string, options: { allowEmpty?: boolean; allowNegative?: boolean } = {}): string | null {
  const parsed = parseMoney(text);

  switch (parsed.kind) {
    case 'empty':
      return options.allowEmpty ? null : MONEY_REQUIRED_MESSAGE;
    case 'invalid':
      return MONEY_INVALID_MESSAGE;
    case 'decimals':
      return MONEY_DECIMALS_MESSAGE;
    default:
      return parsed.cents < 0 && !options.allowNegative ? MONEY_NEGATIVE_MESSAGE : null;
  }
}

const inputFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Reais -> texto para preencher um campo de dinheiro, em pt-BR e sem "R$" ("39,90", "1.234,56"). */
export function formatMoneyInput(value: number): string {
  return inputFormatter.format(value);
}
