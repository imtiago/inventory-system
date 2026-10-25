import { createContext, useContext, useEffect } from 'react';

export const ModalBusyContext = createContext<((busy: boolean) => void) | null>(null);

/** Called by a form rendered inside a Modal: while `pending` is true the modal cannot be dismissed. */
export function useModalBusy(pending: boolean) {
  const setBusy = useContext(ModalBusyContext);

  useEffect(() => {
    if (!setBusy || !pending) return;
    setBusy(true);
    return () => setBusy(false);
  }, [setBusy, pending]);
}
