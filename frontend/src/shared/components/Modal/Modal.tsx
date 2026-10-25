import { type ReactNode, useId, useRef } from 'react';

import { FOCUSABLE, useDialogBehavior } from './useDialogBehavior';

interface ModalProps {
  open: boolean;
  onClose: () => void;

  children: ReactNode;

  title?: string;
  description?: string;

  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';

  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;

  showCloseButton?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export function Modal({ open, onClose, children, title, description, size = 'md', closeOnOverlayClick = true, closeOnEscape = true, showCloseButton = true }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const titleId = useId();
  const descriptionId = useId();

  // Prefer the body over the header when picking the initial focus.
  useDialogBehavior({
    open,
    dialogRef,
    onEscape: onClose,
    escapeEnabled: closeOnEscape,
    getInitialFocus: () => bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE),
  });

  if (!open) {
    return null;
  }

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!closeOnOverlayClick) {
      return;
    }

    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={handleOverlayClick}
      role="dialog"
      ref={dialogRef}
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className={`relative flex max-h-[90vh] w-full ${sizeClasses[size]} flex-col overflow-hidden rounded-xl bg-white shadow-2xl`}>
        {(title || description || showCloseButton) && (
          <div className="flex shrink-0 items-start justify-between border-b px-6 py-4">
            <div className="pr-8">
              {title && (
                <h2 id={titleId} className="text-xl font-semibold text-gray-900">
                  {title}
                </h2>
              )}

              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-gray-500">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Fechar modal">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
