import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Modal } from '../Modal';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Titulo">
        <button>Primeiro</button>
        <button>Ultimo</button>
      </Modal>
    </>
  );
}

describe('Modal focus management', () => {
  test('moves focus into the dialog on open', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Abrir'));
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  test('Tab from last wraps to first and Shift+Tab from first wraps to last', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Abrir'));
    screen.getByText('Ultimo').focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Fechar modal' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByText('Ultimo')).toHaveFocus();
  });

  test('Esc closes and restores focus to the opener', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Abrir'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Abrir')).toHaveFocus();
  });
});
