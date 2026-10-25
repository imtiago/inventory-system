import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConfirmDialog } from '../ConfirmDialog';

function Harness({ loading = false, onConfirm = () => {} }: { loading?: boolean; onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <ConfirmDialog open={open} title="Excluir item" description="Tem certeza?" loading={loading} onConfirm={onConfirm} onCancel={() => setOpen(false)} />
    </>
  );
}

describe('ConfirmDialog accessibility', () => {
  test('initial focus on Cancelar, not on the destructive button', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Abrir'));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  test('focus is trapped inside the dialog', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Abrir'));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  test('Escape cancels and focus returns to the opener; body scroll is released', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Abrir'));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Abrir')).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  test('Escape does nothing while loading', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="T" description="d" loading onConfirm={() => {}} onCancel={onCancel} />);
    return userEvent.keyboard('{Escape}').then(() => expect(onCancel).not.toHaveBeenCalled());
  });

  test('dialog is labelled by its title', () => {
    render(<ConfirmDialog open title="Excluir item" description="d" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Excluir item' })).toBeInTheDocument();
  });
});
