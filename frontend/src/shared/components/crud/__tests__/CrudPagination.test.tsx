import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CrudPagination } from '../CrudPagination';
import { setViewport, VIEWPORTS } from '@/test/viewport';

function renderPagination(page = 2) {
  const onPrevious = vi.fn();
  const onNext = vi.fn();
  render(<CrudPagination page={page} totalPages={5} totalItems={42} onPrevious={onPrevious} onNext={onNext} />);
  return { onPrevious, onNext };
}

describe('CrudPagination', () => {
  test('a partir de sm mostra total, página X de Y e botões com texto', () => {
    setViewport(VIEWPORTS.tablet);
    renderPagination();
    expect(screen.getByText('Total: 42')).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeInTheDocument();
  });

  test('abaixo de sm só mostra Anterior/Próxima (aria-label) e a página atual', async () => {
    setViewport(VIEWPORTS.phone);
    const { onPrevious, onNext } = renderPagination();
    expect(screen.queryByText('Total: 42')).not.toBeInTheDocument();
    expect(screen.queryByText('Página 2 de 5')).not.toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('abaixo de sm os botões respeitam os limites e têm alvo de 44px', () => {
    setViewport(VIEWPORTS.phone);
    renderPagination(1);
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toHaveClass('min-h-11');
  });

  test('quebra linha quando falta espaço', () => {
    setViewport(VIEWPORTS.tablet);
    const { container } = render(<CrudPagination page={1} totalPages={1} totalItems={0} onPrevious={() => {}} onNext={() => {}} />);
    expect(container.firstElementChild).toHaveClass('flex-wrap');
  });
});
