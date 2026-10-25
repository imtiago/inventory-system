import { useCallback, useRef } from 'react';

/**
 * Wraps a submit handler so a second call made while the first is still running is ignored
 * (double click / double Enter). Complements `formState.isSubmitting`, which only disables the button
 * after React has re-rendered. The ignored call resolves together with the first one.
 */
export function useSingleSubmit() {
  const running = useRef<Promise<void> | null>(null);

  return useCallback(<TArgs extends unknown[]>(handler: (...args: TArgs) => Promise<void>) => {
    return (...args: TArgs): Promise<void> => {
      // The ignored call waits for the first one instead of resolving at once: otherwise react-hook-form
      // flips `isSubmitting` back to false (re-enabling "Salvar") while the first submit is still pending.
      if (running.current) return running.current;

      const current = (async () => {
        try {
          await handler(...args);
        } finally {
          running.current = null;
        }
      })();
      running.current = current;

      return current;
    };
  }, []);
}
