import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';

import { Modal } from '../Modal/Modal';
import { ConfirmDialog } from '../ConfirmDialog';
import { Autocomplete } from '../form/Autocomplete';
import { Sidebar } from '@/components/Sidebar';

/** A rolagem de um overlay não pode "vazar" para a página de trás (iOS/Android): overscroll-contain em todo scroller. */
describe('overlays contêm a rolagem encadeada', () => {
  test('corpo do Modal', () => {
    render(
      <Modal open onClose={() => {}} title="Título">
        <p>Conteúdo</p>
      </Modal>,
    );
    expect(screen.getByText('Conteúdo').parentElement?.className).toContain('overscroll-contain');
  });

  test('ConfirmDialog', () => {
    render(<ConfirmDialog open title="Excluir" description="Tem certeza?" onConfirm={() => {}} onCancel={() => {}} />);
    const scroller = screen.getByText('Tem certeza?').closest('.overflow-y-auto');
    expect(scroller?.className).toContain('overscroll-contain');
  });

  test('lista de opções do Autocomplete', async () => {
    render(<Autocomplete options={[{ id: '1', name: 'Alfa' }]} value={null} onChange={() => {}} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.name} label="Marca" />);
    await userEvent.click(screen.getByLabelText('Marca'));
    expect(screen.getByRole('listbox').className).toContain('overscroll-contain');
  });

  test('navegação lateral (gaveta no celular)', () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByRole('navigation', { name: 'Menu principal' }).className).toContain('overscroll-contain');
  });
});
