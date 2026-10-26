import { describe, expect, test } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SaleListPage } from '../SaleListPage';
import { renderWithProviders } from '@/test/render';
import { setViewport, VIEWPORTS } from '@/test/viewport';

describe('SaleListPage: botão Filtros no celular', () => {
  test('o período padrão do mês não conta como filtro; só o que difere dos padrões', async () => {
    setViewport(VIEWPORTS.phone);
    renderWithProviders(<SaleListPage />);

    const button = await screen.findByRole('button', { name: 'Filtros' });
    await userEvent.click(button);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PENDING');
    expect(screen.getByRole('button', { name: 'Filtros (1)' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2020-01-01' } });
    expect(screen.getByRole('button', { name: 'Filtros (2)' })).toBeInTheDocument();
  });

  test('o aviso de período inválido continua visível com o painel recolhido', async () => {
    setViewport(VIEWPORTS.phone);
    renderWithProviders(<SaleListPage />);

    const button = await screen.findByRole('button', { name: 'Filtros' });
    await userEvent.click(button);
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2999-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }));

    expect(screen.getByLabelText('De')).not.toBeVisible();
    expect(screen.getByRole('alert')).toBeVisible();
  });
});
