import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Modal } from '../Modal';
import { Autocomplete } from '@/shared/components/form/Autocomplete';

function Busy() {
  const [open, setOpen] = useState(true);
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Titulo" busy>
      <button>Dentro</button>
    </Modal>
  );
}

describe('Modal busy', () => {
  test('Escape, backdrop click and X do not close while busy', async () => {
    render(<Busy />);
    await userEvent.keyboard('{Escape}');
    await userEvent.pointer([{ keys: '[MouseLeft>]', target: screen.getByRole('dialog') }, { keys: '[/MouseLeft]' }]);
    const close = screen.queryByRole('button', { name: 'Fechar modal' });
    if (close) await userEvent.click(close);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

function WithAutocomplete() {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState<string | null>(null);
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Titulo">
      <Autocomplete
        ariaLabel="Marca"
        options={['Nike', 'Adidas']}
        value={value}
        onChange={(v) => setValue(v)}
        getOptionValue={(o) => o}
        getOptionLabel={(o) => o}
      />
    </Modal>
  );
}

describe('Autocomplete inside Modal', () => {
  test('Escape closes the open list first and keeps the modal; a second Escape closes the modal', async () => {
    render(<WithAutocomplete />);
    const input = screen.getByRole('combobox', { name: 'Marca' });
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
