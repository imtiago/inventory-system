import { useRequestSaleCancel } from '../hooks/useRequestSaleCancel';
import { CancelReasonModal } from './CancelReasonModal';

interface Props {
  saleId: string;
  onClose: () => void;
}

/** Vendedor pede o cancelamento da venda com um motivo; a dona/ADMIN decide. */
export function RequestCancelModal({ saleId, onClose }: Props) {
  const request = useRequestSaleCancel(saleId);

  return (
    <CancelReasonModal
      title="Pedir cancelamento"
      description="A venda continua valendo até um administrador aprovar o pedido."
      submitLabel="Enviar pedido"
      pendingLabel="Enviando..."
      fallbackError="Não foi possível enviar o pedido."
      pending={request.isPending}
      onSubmit={(reason) => request.mutateAsync(reason)}
      onClose={onClose}
    />
  );
}
