import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { Sidebar } from '../Sidebar';
import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import { createTestQueryClient } from '@/test/render';
import { setViewport, VIEWPORTS } from '@/test/viewport';
import { useThemeStore } from '@/shared/store/theme';
import { THEME_STORAGE_KEY } from '@/shared/theme/theme';

function wrap(ui: React.ReactNode) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Seletor de tema no menu', () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    useThemeStore.setState({ preference: 'system' });
  });
  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  test('fica no rodapé junto de "Alterar senha", com Claro, Escuro e Seguir o sistema', () => {
    render(wrap(<Sidebar />));
    const group = screen.getByRole('radiogroup', { name: 'Tema' });
    const options = within(group).getAllByRole('radio');
    expect(options.map((o) => o.getAttribute('aria-label') ?? (o as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['Claro', 'Escuro', 'Seguir o sistema']);
    expect(within(group).getByRole('radio', { name: 'Seguir o sistema' })).toBeChecked();

    // mesmo bloco do rodapé que "Alterar senha"
    const footer = screen.getByRole('button', { name: /Alterar senha/ }).parentElement!;
    expect(footer).toContainElement(group);
  });

  test('escolher Escuro aplica e grava a preferência', async () => {
    const user = userEvent.setup();
    render(wrap(<Sidebar />));
    await user.click(screen.getByRole('radio', { name: 'Escuro' }));

    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('radio', { name: 'Claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  test('também aparece na gaveta do celular', async () => {
    const user = userEvent.setup();
    setViewport(VIEWPORTS.phone);
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<p>Início</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(drawer).getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument();
  });
});
