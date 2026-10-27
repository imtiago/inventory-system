const formatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const PERCENT_DECIMALS_MESSAGE = 'Use no máximo 2 casas decimais';
export const PERCENT_INVALID_MESSAGE = 'Percentual inválido';
export const PERCENT_REQUIRED_MESSAGE = 'Informe um percentual';
export const PERCENT_MAX_MESSAGE = 'O percentual deve ser menor que 100%';

export type ParsedPercent = { kind: 'ok'; bps: number } | { kind: 'empty' } | { kind: 'invalid' } | { kind: 'decimals' };

/**
 * Percentual digitado -> basis points (30% = 3000). "," é o decimal; "." também vale como decimal
 * (percentuais não têm milhar). "%" e espaços são ignorados. Mais de 2 casas = erro, nunca arredonda.
 */
export function parsePercentToBps(text: string): ParsedPercent {
  const body = text.replace(/%/g, '').replace(/\s/g, '');
  if (body === '') return { kind: 'empty' };

  const match = /^(\d*)(?:[.,](\d*))?$/.exec(body);
  if (!match || (match[1] === '' && !match[2])) return { kind: 'invalid' };

  const [, integer, decimals = ''] = match;
  if (decimals.length > 2) return { kind: 'decimals' };

  const bps = Number(integer || '0') * 100 + Number(decimals.padEnd(2, '0'));

  return Number.isSafeInteger(bps) ? { kind: 'ok', bps } : { kind: 'invalid' };
}

/** Texto -> bps; null quando vazio, inválido ou com mais de 2 casas. */
export function percentTextToBps(text: string): number | null {
  const parsed = parsePercentToBps(text);

  return parsed.kind === 'ok' ? parsed.bps : null;
}

/** Mensagem de validação (percentual de 0 até menos de 100%), ou null quando válido. */
export function percentTextError(text: string, options: { allowEmpty?: boolean } = {}): string | null {
  const parsed = parsePercentToBps(text);

  switch (parsed.kind) {
    case 'empty':
      return options.allowEmpty ? null : PERCENT_REQUIRED_MESSAGE;
    case 'invalid':
      return PERCENT_INVALID_MESSAGE;
    case 'decimals':
      return PERCENT_DECIMALS_MESSAGE;
    default:
      return parsed.bps >= 10000 ? PERCENT_MAX_MESSAGE : null;
  }
}

/** bps -> "3,99%". */
export function formatBps(bps: number): string {
  return `${formatter.format(bps / 100)}%`;
}

/** Percentual da API (ex.: 3.99) -> texto para preencher um campo, sem "%" ("3,99"). */
export function formatPercentInput(percent: number): string {
  return formatter.format(percent);
}

/** bps -> percentual da API (399 -> 3.99). */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}
