import { describe, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { DashboardLayout } from '../DashboardLayout';
import { createTestQueryClient } from '@/test/render';
import { setViewport, VIEWPORTS } from '@/test/viewport';

function renderLayout(route = '/') {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<p>Conteúdo do dashboard</p>} />
            <Route path="/products" element={<p>Conteúdo de produtos</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardLayout em desktop (lg+)', () => {
  test('mantém o menu fixo e não mostra botão de menu', () => {
    setViewport(VIEWPORTS.laptop);
    renderLayout();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('sem matchMedia (padrão dos testes) é desktop', () => {
    renderLayout();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});

describe('DashboardLayout abaixo de lg (gaveta)', () => {
  test.each([VIEWPORTS.phone, VIEWPORTS.tablet])('em %ipx o menu começa escondido e há barra superior com o nome da tela', (width) => {
    setViewport(width);
    renderLayout('/products');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Abrir menu' });
    expect(button).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('banner')).toHaveTextContent('Produtos');
    expect(screen.getByText('Conteúdo de produtos')).toBeInTheDocument();
  });

  test('botão abre a gaveta, move o foco para dentro e trava a rolagem do fundo', async () => {
    setViewport(VIEWPORTS.phone);
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(drawer).getByRole('navigation')).toBeInTheDocument();
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('Escape fecha a gaveta, devolve o foco e libera a rolagem', async () => {
    setViewport(VIEWPORTS.phone);
    renderLayout();
    const opener = screen.getByRole('button', { name: 'Abrir menu' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  test('toque no fundo escurecido fecha; toque dentro do menu não', async () => {
    setViewport(VIEWPORTS.phone);
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await userEvent.click(screen.getByRole('navigation'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('o botão Fechar menu fecha a gaveta', async () => {
    setViewport(VIEWPORTS.phone);
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('navegar por um item fecha a gaveta e mostra a nova tela', async () => {
    setViewport(VIEWPORTS.phone);
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await userEvent.click(screen.getByRole('link', { name: 'Produtos' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Conteúdo de produtos')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Produtos');
  });

  test('foco preso: Tab no último volta ao primeiro e Shift+Tab no primeiro vai ao último', async () => {
    setViewport(VIEWPORTS.phone);
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const drawer = screen.getByRole('dialog');
    const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    await userEvent.tab();
    expect(first).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  test('crescer a tela para lg troca a gaveta pelo menu fixo', async () => {
    setViewport(VIEWPORTS.phone);
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    setViewport(VIEWPORTS.desktop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
