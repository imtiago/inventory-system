import { lazy, Suspense } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChunkErrorBoundary } from '../ChunkErrorBoundary';

afterEach(() => vi.restoreAllMocks());

const failing = (message: string) => lazy<() => React.JSX.Element>(() => Promise.reject(new TypeError(message)));
const Outdated = failing('Failed to fetch dynamically imported module: http://x/assets/Sales-abc.js');
const Crashing = failing('boom');

function Failing({ Broken }: { Broken: ReturnType<typeof failing> }) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<p>Carregando página...</p>}>
        <Broken />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

describe('ChunkErrorBoundary', () => {
  test('falha ao baixar um chunk mostra "Nova versão disponível" e recarrega ao clicar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    render(<Failing Broken={Outdated} />);

    expect(await screen.findByText(/Nova versão disponível/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  test('outro erro de renderização não é confundido com versão nova', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Failing Broken={Crashing} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/Nova versão disponível/)).not.toBeInTheDocument();
  });
});
