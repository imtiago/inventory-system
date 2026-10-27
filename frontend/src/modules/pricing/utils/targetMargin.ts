import { formatPercentInput, parsePercentToBps, percentTextError } from '@/shared/utils/percent';

export const TARGET_MARGIN_LABEL = 'Margem desejada (%)';

/** Percentual da API (35.5) -> bps (3550); ausente/null = sem margem. */
export function percentToBps(percent: number | null | undefined): number | null {
  return percent === null || percent === undefined ? null : Math.round(percent * 100);
}

/** Texto salvo (bps) -> texto do campo. */
export function marginBpsToText(bps: number | null | undefined): string {
  return bps === null || bps === undefined ? '' : formatPercentInput(bps / 100);
}

/** Validação do campo (vazio é válido). */
export function validateTargetMargin(text: string | undefined): string | true {
  return percentTextError(text ?? '', { allowEmpty: true }) ?? true;
}

/**
 * O que enviar no formulário: nada se a pessoa não pode ou não mexeu no campo (não reenvia margem alheia),
 * `null` se esvaziou, bps se digitou.
 */
export function marginChange(allowed: boolean, dirty: boolean, text: string | undefined): { targetMarginBps?: number | null } {
  if (!allowed || !dirty) return {};
  const parsed = parsePercentToBps(text ?? '');

  return { targetMarginBps: parsed.kind === 'ok' ? parsed.bps : null };
}
