import { type RefObject, useEffect, useRef } from 'react';

export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs in opening order: only the last one (topmost) reacts to Escape and Tab.
const stack: symbol[] = [];
let scrollLocks = 0;
let originalOverflow = '';

interface Options {
  open: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  /** Called on Escape when this is the topmost dialog and escape is allowed. */
  onEscape?: () => void;
  /** Whether Escape may close (false while submitting). */
  escapeEnabled?: boolean;
  /** Returns the element to focus initially; falls back to the first focusable. */
  getInitialFocus?: () => HTMLElement | null | undefined;
}

/** Shared dialog accessibility: initial focus, focus trap, Escape (topmost only), focus restore, scroll lock. */
export function useDialogBehavior({ open, dialogRef, onEscape, escapeEnabled = true, getInitialFocus }: Options) {
  const latest = useRef({ onEscape, escapeEnabled, getInitialFocus });
  latest.current = { onEscape, escapeEnabled, getInitialFocus };

  useEffect(() => {
    if (!open) return;

    const token = Symbol('dialog');
    stack.push(token);
    const isTop = () => stack[stack.length - 1] === token;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    const getFocusable = () => (dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);

    // Respect children that already took focus (e.g. autoFocus).
    if (dialog && !dialog.contains(document.activeElement)) {
      (latest.current.getInitialFocus?.() ?? getFocusable()[0] ?? dialog).focus();
    }

    function handleTab(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !dialog || !isTop()) return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === firstEl || !dialog.contains(active))) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && (active === lastEl || !dialog.contains(active))) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    // Always registered (even while Escape is blocked) so a blocked top dialog still shields the ones below.
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !isTop()) return;
      if (latest.current.escapeEnabled) latest.current.onEscape?.();
    }

    document.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEscape);

    if (scrollLocks++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEscape);
      const index = stack.indexOf(token);
      if (index >= 0) stack.splice(index, 1);
      if (--scrollLocks === 0) document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, dialogRef]);
}
