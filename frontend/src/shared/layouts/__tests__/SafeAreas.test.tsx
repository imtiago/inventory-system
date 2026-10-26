import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { DashboardLayout } from '../DashboardLayout';
import { createTestQueryClient } from '@/test/render';
import { setViewport, VIEWPORTS } from '@/test/viewport';

function renderLayout() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<p>Conteúdo</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('áreas seguras (viewport-fit=cover)', () => {
  test('barra superior, área rolável e gaveta respeitam os insets', async () => {
    setViewport(VIEWPORTS.phone);
    const { container } = renderLayout();

    const header = container.querySelector('header')!;
    expect(header.className).toContain('env(safe-area-inset-top)');
    expect(header.className).toContain('env(safe-area-inset-left)');
    expect(header.className).toContain('env(safe-area-inset-right)');
    expect(container.querySelector('main')!.className).toContain('env(safe-area-inset-bottom)');

    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const aside = screen.getByRole('dialog').querySelector('aside')!;
    expect(aside.className).toContain('env(safe-area-inset-bottom)');
    expect(aside.className).toContain('env(safe-area-inset-left)');
  });

  test('o menu usa o nome Estoque', () => {
    setViewport(VIEWPORTS.laptop);
    renderLayout();
    expect(screen.getByText('Estoque', { selector: 'aside > div' })).toBeInTheDocument();
    expect(screen.queryByText('Inventory System')).not.toBeInTheDocument();
  });

  test('index.html declara mobile-web-app-capable', () => {
    const html = readFileSync(resolve(__dirname, '../../../../index.html'), 'utf8');
    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes" />');
  });
});
