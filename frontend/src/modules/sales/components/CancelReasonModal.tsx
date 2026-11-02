import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { FieldError, fieldA11y } from '@/shared/components/form';
import { parseApiErrorSync } from '@/shared/services/parseApiError';

const REASON_MESSAGE = 'Informe o motivo (3 a 200 caracteres).';

interface Props {
  title: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  fallbackError: string;
  pending: boolean;
  /** Rejeita (lança) para o modal mostrar a mensagem da API; resolve para fechar. */
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
}

/** Modal com um campo de motivo (3 a 200 caracteres), usado ao pedir e ao recusar um cancelamento. */
export function CancelReasonModal({ title, description, submitLabel, pendingLabel, fallbackError, pending, onSubmit, onClose }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<{ reason: string }>({ defaultValues: { reason: '' } });

  function close() {
    if (pending) return;
    onClose();
  }

  async function submit({ reason }: { reason: string }) {
    clearErrors('root.server');

    try {
      await onSubmit(reason.trim());
      onClose();
    } catch (error) {
      setError('root.server', { type: 'server', message: parseApiErrorSync(error).message || fallbackError });
    }
  }

  const serverError = errors.root?.server?.message;

  return (
    <Modal open onClose={close} busy={pending} title={title} description={description} size="md">
      <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="cancel-reason" className="mb-2 block text-sm font-medium text-foreground">
            Motivo
          </label>
          <textarea
            id="cancel-reason"
            {...fieldA11y('cancel-reason', errors.reason?.message)}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm"
            {...register('reason', {
              validate: (value) => {
                const length = value.trim().length;
                return length >= 3 && length <= 200 ? true : REASON_MESSAGE;
              },
            })}
          />
          <FieldError id="cancel-reason" message={errors.reason?.message} />
        </div>

        {serverError && (
          <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="min-h-11 rounded-lg border border-border px-4 py-2 hover:bg-surface-muted disabled:opacity-50" onClick={close} disabled={pending}>
            Voltar
          </button>
          <button type="submit" className="min-h-11 rounded-lg bg-danger-solid px-4 py-2 text-danger-foreground hover:bg-danger-solid/90 disabled:opacity-50" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
