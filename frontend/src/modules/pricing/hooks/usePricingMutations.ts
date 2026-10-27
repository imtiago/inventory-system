import { handleMutationError } from '@/shared/utils/mutation';
import { queryKeys } from '@/shared/react-query/keys';
import { useCrudMutation } from '@/shared/react-query/useCrudMutation';

import { createExpense, deleteExpense, savePricingSettings, setTargetMargin, updateExpense } from '../services/pricingService';
import type { SaveExpenseInput, SaveSettingsInput, TargetMarginLevel } from '../types';

// Configuração, despesas e margens mudam o preço sugerido: a lista de revisão e a composição de cada variante.
// O lucro estimado (relatório e cartão do painel) também usa as despesas e o custo: invalida junto.
const PROFIT_KEYS = [['reports', 'profit'], queryKeys.dashboard] as const;
const PRICING_KEYS = [queryKeys.pricingSettings, queryKeys.priceReviews, ['pricing', 'variants'], ...PROFIT_KEYS] as const;

export function useSavePricingSettings() {
  return useCrudMutation({
    mutationFn: (input: SaveSettingsInput) => savePricingSettings(input),
    invalidateKeys: PRICING_KEYS,
    successMessage: 'Configurações salvas.',
    silentError: true,
  });
}

export function useCreateExpense() {
  return useCrudMutation({
    mutationFn: (input: SaveExpenseInput) => createExpense(input),
    invalidateKeys: PRICING_KEYS,
    successMessage: 'Despesa adicionada.',
    silentError: true,
  });
}

export function useUpdateExpense() {
  return useCrudMutation({
    mutationFn: ({ id, input }: { id: string; input: SaveExpenseInput }) => updateExpense(id, input),
    invalidateKeys: PRICING_KEYS,
    successMessage: 'Despesa atualizada.',
    silentError: true,
  });
}

export function useDeleteExpense() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteExpense(id),
    invalidateKeys: PRICING_KEYS,
    successMessage: 'Despesa excluída.',
    errorMessage: 'Erro ao excluir despesa.',
  });
}

export function useSetTargetMargin() {
  return useCrudMutation({
    mutationFn: ({ level, id, percent }: { level: TargetMarginLevel; id: string; percent: number | null }) => setTargetMargin(level, id, percent),
    invalidateKeys: [queryKeys.priceReviews, ['pricing', 'variants'], ...PROFIT_KEYS],
    silentError: true,
  });
}

/**
 * Grava a margem desejada depois que o cadastro principal foi salvo. `bps` undefined = não mexeu (nada a fazer).
 * Falha vira aviso (o cadastro já existe; repetir tudo duplicaria), nunca exceção.
 */
export function useApplyTargetMargin() {
  const { mutateAsync } = useSetTargetMargin();

  return async function applyTargetMargin(level: TargetMarginLevel, id: string, bps: number | null | undefined) {
    if (bps === undefined) return;

    try {
      await mutateAsync({ level, id, percent: bps === null ? null : bps / 100 });
    } catch (error) {
      handleMutationError(error, 'Salvo, mas não foi possível gravar a margem desejada. Edite e tente de novo.');
    }
  };
}
