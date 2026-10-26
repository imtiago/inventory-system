import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FilterPanel } from '../FilterPanel';
import { setViewport, VIEWPORTS } from '@/test/viewport';

function renderPanel(activeCount: number) {
  render(
    <FilterPanel activeCount={activeCount}>
      <label>
        Status
        <input />
      </label>
    </FilterPanel>,
  );
}

describe('FilterPanel', () => {
  test('a partir de md os filtros ficam sempre visíveis, sem botão', () => {
    setViewport(VIEWPORTS.tablet);
    renderPanel(2);
    expect(screen.queryByRole('button', { name: /Filtros/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeVisible();
  });

  test('abaixo de md começam recolhidos e o botão abre e fecha', async () => {
    setViewport(VIEWPORTS.phone);
    renderPanel(0);
    const button = screen.getByRole('button', { name: 'Filtros' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Status')).not.toBeVisible();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Status')).toBeVisible();
    await userEvent.click(button);
    expect(screen.getByLabelText('Status')).not.toBeVisible();
  });

  test('mostra quantos filtros estão ativos no botão', () => {
    setViewport(VIEWPORTS.phone);
    renderPanel(3);
    expect(screen.getByRole('button', { name: 'Filtros (3)' })).toBeInTheDocument();
  });

  test('o botão tem alvo de toque de 44px', () => {
    setViewport(VIEWPORTS.phone);
    renderPanel(0);
    expect(screen.getByRole('button', { name: 'Filtros' })).toHaveClass('min-h-11');
  });
});
