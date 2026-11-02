import { CheckCircle2, CircleAlert, Link2, UserPlus } from 'lucide-react';

import { hasMissingLinkedCustomer, hasPendingSimilar, type LegacyRow, type UpdateLegacyRowInput } from '../types';

interface Props {
  row: LegacyRow;
  /** Linhas do lote por id (para "mesma pessoa da linha N"). */
  rowsById: Map<string, LegacyRow>;
  disabled?: boolean;
  onChange: (input: UpdateLegacyRowInput) => void;
}

const choiceClass =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-input bg-surface px-3 py-2 text-left text-sm text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Quem é o cliente da linha: vínculo (automático por nome igual ou escolhido), mesma pessoa de outra linha,
 * cliente novo — e, com nome parecido pendente, as opções "É a mesma pessoa: …" / "Criar novo" / "Ignorar linha".
 */
export function SimilarNameChooser({ row, rowsById, disabled = false, onChange }: Props) {
  const action = row.customerAction;
  const pending = hasPendingSimilar(row);

  const suggestionLabel = (suggestion: LegacyRow['suggestions'][number]) => {
    if (suggestion.rowId) {
      const target = rowsById.get(suggestion.rowId);
      return `É a mesma pessoa: ${suggestion.name}${target ? ` (linha ${target.line})` : ''}`;
    }
    return `É a mesma pessoa: ${suggestion.name}`;
  };

  const choose = (suggestion: LegacyRow['suggestions'][number]) =>
    onChange({ customerAction: suggestion.customerId ? { kind: 'LINK', customerId: suggestion.customerId } : { kind: 'SAME_AS_ROW', rowId: suggestion.rowId as string } });

  const newButton = (
    <button type="button" className={choiceClass} disabled={disabled} onClick={() => onChange({ customerAction: { kind: 'NEW' } })}>
      <UserPlus size={16} aria-hidden="true" />
      Criar novo
    </button>
  );

  if (action.kind === 'LINK' && hasMissingLinkedCustomer(row)) {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>Cliente vinculado foi excluído</span>
        </p>
        <div className="flex flex-wrap gap-2">{newButton}</div>
      </div>
    );
  }

  if (action.kind === 'LINK') {
    const linked = row.suggestions.find((s) => s.customerId === action.customerId);
    // Vínculo automático = nome idêntico ao da linha; o nome do cadastro vem da sugestão quando há.
    const name = linked?.name ?? (row.autoLinked ? row.data.name : null);
    const text = row.autoLinked ? `Vinculado automaticamente a ${name} — confira` : name ? `Vinculado a ${name}` : 'Vinculado a um cliente cadastrado';

    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-1.5 text-sm text-info">
          <Link2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{text}</span>
        </p>
        <div className="flex flex-wrap gap-2">{newButton}</div>
      </div>
    );
  }

  if (action.kind === 'SAME_AS_ROW') {
    const target = rowsById.get(action.rowId);

    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-1.5 text-sm text-info">
          <Link2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{target ? `Mesma pessoa da linha ${target.line} (${target.data.name})` : 'Mesma pessoa de outra linha'}</span>
        </p>
        <div className="flex flex-wrap gap-2">{newButton}</div>
      </div>
    );
  }

  if (pending) {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-warning">Nome parecido: é a mesma pessoa?</legend>
        <div className="flex flex-wrap gap-2">
          {row.suggestions.map((suggestion) => (
            <button key={suggestion.customerId ?? suggestion.rowId} type="button" className={choiceClass} disabled={disabled} onClick={() => choose(suggestion)}>
              <Link2 size={16} aria-hidden="true" />
              {suggestionLabel(suggestion)}
            </button>
          ))}
          {newButton}
          <button type="button" className={choiceClass} disabled={disabled} onClick={() => onChange({ ignored: true })}>
            Ignorar linha
          </button>
        </div>
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-1.5 text-sm text-muted">
        <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{action.confirmedNew && row.suggestions.length > 0 ? 'Cliente novo (você confirmou que é outra pessoa)' : 'Cliente novo'}</span>
      </p>
      {action.confirmedNew && row.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {row.suggestions.map((suggestion) => (
            <button key={suggestion.customerId ?? suggestion.rowId} type="button" className={choiceClass} disabled={disabled} onClick={() => choose(suggestion)}>
              <Link2 size={16} aria-hidden="true" />
              {suggestionLabel(suggestion)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
