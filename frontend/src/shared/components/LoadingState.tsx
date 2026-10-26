import { LoaderCircle } from 'lucide-react';

interface LoadingStateProps {
  /** Texto exibido e anunciado, ex.: "Carregando vendas...". */
  label: string;
  /** Bloco pequeno dentro de uma tela (lotes, variantes); o padrão ocupa a área toda. */
  compact?: boolean;
}

/** Indicador de carregamento padrão (B9): spinner + texto, anunciado como status. */
export function LoadingState({ label, compact = false }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-2 text-sm text-muted ${compact ? 'p-6' : 'min-h-48'}`}>
      <LoaderCircle size={compact ? 16 : 20} aria-hidden="true" className="animate-spin" />
      {label}
    </div>
  );
}
