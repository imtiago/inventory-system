import { Component, type ErrorInfo, type ReactNode } from 'react';

// Messages of a failed dynamic import across browsers (Chromium, Firefox, Safari) and Vite's preload helper.
const CHUNK_ERROR = /dynamically imported module|importing a module script failed|unable to preload|loading chunk|chunkloaderror|error loading dynamically/i;

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return CHUNK_ERROR.test(`${error.name} ${error.message}`) || isChunkLoadError(error.cause);
}

interface Props {
  children: ReactNode;
  /** Changing it (e.g. the pathname) clears a previous error so other routes keep working. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lazy-load failures of a route. After a new deploy the old hashed chunks are gone, so the
 * dynamic import rejects: instead of a blank screen the user is told to reload to get the new version.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ChunkErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const outdated = isChunkLoadError(error);

    return (
      <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">{outdated ? 'Nova versão disponível' : 'Algo deu errado ao exibir esta página.'}</p>
        <p className="text-muted">{outdated ? 'O sistema foi atualizado. Recarregue a página para continuar.' : 'Recarregue a página para tentar novamente.'}</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-primary px-5 py-2 text-primary-foreground hover:bg-primary-hover">
          Recarregar
        </button>
      </div>
    );
  }
}
