import { useCallback, useRef } from 'react';

/**
 * Wraps a submit handler so a second call made while the first is still running is ignored
 * (double click / double Enter). Complements `formState.isSubmitting`, which only disables the button
 * after React has re-rendered.
 */
export function useSingleSubmit() {
  const running = useRef(false);

  return useCallback(<TArgs extends unknown[]>(handler: (...args: TArgs) => Promise<void>) => {
    return async (...args: TArgs): Promise<void> => {
      if (running.current) return;

      running.current = true;

      try {
        await handler(...args);
      } finally {
        running.current = false;
      }
    };
  }, []);
}
