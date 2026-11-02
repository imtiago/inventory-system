import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

const LEGACY_STEPS = [
  { title: 'Baixar modelo', description: 'Planilha com as colunas certas e dois exemplos.' },
  { title: 'Enviar planilha ou lançamento rápido', description: 'Preencha no Excel ou no Google Sheets e salve como CSV. Ou lance cliente por cliente, pelo celular.' },
  { title: 'Revisar', description: 'Corrija os avisos, decida os nomes parecidos e ignore o que não deve entrar.' },
  { title: 'Confirmar', description: 'Grava as dívidas sem multa nem juros. Dá para desfazer enquanto nenhuma receber pagamento.' },
] as const;

interface Props {
  /** Etapa atual (1–4); as anteriores aparecem como concluídas. Sem valor: só o roteiro. */
  current?: number;
  /** Etapa 4 concluída (lote confirmado ou desfeito). */
  finished?: boolean;
  /** Ações de cada etapa (índice 0–3), mostradas no roteiro completo. */
  actions?: (ReactNode | undefined)[];
  compact?: boolean;
}

/** Etapas da migração: 1 Baixar modelo → 2 Enviar planilha ou lançamento rápido → 3 Revisar → 4 Confirmar. */
export function LegacyImportSteps({ current, finished = false, actions, compact = false }: Props) {
  return (
    <ol aria-label="Etapas da migração" className={compact ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4'}>
      {LEGACY_STEPS.map((step, index) => {
        const number = index + 1;
        const done = current !== undefined && (number < current || (finished && number === current));
        const active = current === number;

        return (
          <li
            key={step.title}
            aria-current={active ? 'step' : undefined}
            className={`flex min-w-0 gap-3 rounded-xl border ${compact ? 'items-center p-2.5' : 'flex-col p-4'} ${active ? 'border-primary bg-primary/5' : 'border-border bg-surface'}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? 'bg-success-soft text-success' : active ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-muted'}`}
              >
                {done ? <Check size={16} /> : number}
              </span>
              <span className="sr-only">{`Etapa ${number}${done ? ', concluída' : active ? ', atual' : ''}: `}</span>
              <span data-step-title className={`min-w-0 font-medium text-foreground ${compact ? 'text-xs leading-tight sm:text-sm' : ''}`}>
                {step.title}
              </span>
            </div>
            {!compact && <p className="text-sm text-muted">{step.description}</p>}
            {!compact && actions?.[index] && <div className="mt-auto flex flex-wrap gap-2">{actions[index]}</div>}
          </li>
        );
      })}
    </ol>
  );
}
