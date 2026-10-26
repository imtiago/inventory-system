import { describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';

import { PageHeader } from '../PageHeader';
import { renderWithProviders } from '@/test/render';

describe('PageHeader', () => {
  test('mostra o título como h1', () => {
    renderWithProviders(<PageHeader title="Produtos" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Produtos' })).toBeInTheDocument();
  });

  test('título vazio (assistente em modal) não gera h1 vazio', () => {
    renderWithProviders(<PageHeader title="" description="Cadastre o produto." />);
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText('Cadastre o produto.')).toBeInTheDocument();
  });
});
