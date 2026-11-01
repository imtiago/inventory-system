import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { FieldError, fieldA11y } from '@/shared/components/form';
import { LoadingState } from '@/shared/components/LoadingState';
import { queryKeys } from '@/shared/react-query/keys';

import { listCreditApprovers } from '../../services/saleService';
import type { CreditOverrideKind, ICreditOverrideInput } from '../../types';
import { CREDIARIO_BLOCK_MESSAGES } from '../../utils/checkout';
import { checkoutFieldClass, checkoutLabelClass } from './styles';

interface Props {
  open: boolean;
  /** Por que a venda precisa de autorização (limite e/ou atraso). */
  reasons: CreditOverrideKind[];
  /** Mensagem do servidor que abriu o modal (422), quando houver. */
  notice?: string | null;
  pending: boolean;
  /** Erro da última tentativa (ex.: 403 "Autorização recusada.", 429). */
  error: string | null;
  onSubmit: (input: ICreditOverrideInput) => void;
  onClose: () => void;
}

type Errors = Partial<Record<'approver' | 'password' | 'reason', string>>;

/**
 * Exceção na venda (acima do limite ou com atraso): quem pode aprovar crédito escolhe o próprio
 * nome, digita a própria senha e o motivo. Tudo fica gravado na venda.
 */
export function CreditOverrideModal({ open, onClose, pending, ...rest }: Props) {
  return (
    <Modal open={open} onClose={onClose} busy={pending} title="Autorização de crédito" description="Quem aprova crédito confirma com a própria senha." size="md">
      <OverrideForm onClose={onClose} pending={pending} {...rest} />
    </Modal>
  );
}

function OverrideForm({ reasons, notice, pending, error, onSubmit, onClose }: Omit<Props, 'open'>) {
  useModalBusy(pending);
  const approvers = useQuery({ queryKey: queryKeys.creditApprovers, queryFn: listCreditApprovers, staleTime: 60_000 });
  const [approverEmail, setApproverEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = reason.trim();
    const next: Errors = {};
    if (!approverEmail) next.approver = 'Escolha quem autoriza.';
    if (!password) next.password = 'Informe a senha.';
    if (trimmed.length < 3) next.reason = 'O motivo deve ter ao menos 3 caracteres.';
    else if (trimmed.length > 200) next.reason = 'O motivo deve ter no máximo 200 caracteres.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSubmit({ approverEmail, approverPassword: password, reason: trimmed });
  }

  const list = approvers.data ?? [];

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          {notice && <p className="font-medium">{notice}</p>}
          {reasons.map((kind) => (
            <p key={kind}>{CREDIARIO_BLOCK_MESSAGES[kind]}</p>
          ))}
        </div>
      </div>

      {approvers.isLoading ? (
        <LoadingState label="Carregando aprovadores..." />
      ) : approvers.isError ? (
        <p role="alert" className="text-sm text-danger">
          Não foi possível carregar quem pode aprovar.
        </p>
      ) : list.length === 0 ? (
        <p role="alert" className="text-sm text-danger">
          Nenhum usuário pode aprovar crédito. Peça ao administrador para marcar um aprovador.
        </p>
      ) : null}

      <div>
        <label htmlFor="override-approver" className={checkoutLabelClass}>
          Quem autoriza
        </label>
        <select id="override-approver" {...fieldA11y('override-approver', errors.approver)} className={checkoutFieldClass} value={approverEmail} disabled={pending} onChange={(event) => setApproverEmail(event.target.value)}>
          <option value="">Escolha…</option>
          {list.map((approver) => (
            <option key={approver.id} value={approver.email}>
              {approver.name}
            </option>
          ))}
        </select>
        <FieldError id="override-approver" message={errors.approver} />
      </div>

      <div>
        <label htmlFor="override-password" className={checkoutLabelClass}>
          Senha de quem autoriza
        </label>
        <input
          id="override-password"
          type="password"
          autoComplete="off"
          {...fieldA11y('override-password', errors.password)}
          className={checkoutFieldClass}
          value={password}
          disabled={pending}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FieldError id="override-password" message={errors.password} />
      </div>

      <div>
        <label htmlFor="override-reason" className={checkoutLabelClass}>
          Motivo
        </label>
        <textarea
          id="override-reason"
          rows={3}
          maxLength={200}
          {...fieldA11y('override-reason', errors.reason)}
          className={checkoutFieldClass}
          value={reason}
          disabled={pending}
          onChange={(event) => setReason(event.target.value)}
        />
        <FieldError id="override-reason" message={errors.reason} />
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="min-h-11 rounded-lg border border-border px-4 py-2 hover:bg-surface-muted disabled:opacity-50" onClick={onClose} disabled={pending}>
          Voltar
        </button>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50" disabled={pending}>
          {pending ? 'Autorizando...' : 'Autorizar e registrar'}
        </button>
      </div>
    </form>
  );
}
