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

  test('keeps focus on a child with autoFocus', () => {
    render(
      <Modal open onClose={() => {}} title="T">
        <input aria-label="busca" autoFocus />
      </Modal>,
    );
    expect(screen.getByLabelText('busca')).toHaveFocus();
  });

  test('prefers first body focusable over header close button', () => {
    render(
      <Modal open onClose={() => {}} title="T">
        <button>Corpo</button>
      </Modal>,
    );
    expect(screen.getByText('Corpo')).toHaveFocus();
  });
});

describe('Modal accessibility (wave 2)', () => {
  test('ids are unique across two dialogs and labelled by the title', () => {
    render(
      <>
        <Modal open onClose={() => {}} title="Um" description="d1"><button>a</button></Modal>
        <Modal open onClose={() => {}} title="Dois" description="d2"><button>b</button></Modal>
      </>,
    );
    const [one, two] = screen.getAllByRole('dialog');
    expect(one.getAttribute('aria-labelledby')).not.toBe(two.getAttribute('aria-labelledby'));
    expect(screen.getByRole('dialog', { name: 'Um' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Dois' })).toBeInTheDocument();
  });

  test('body scroll is locked while open and released after the last dialog closes', () => {
    document.body.style.overflow = '';
    const first = render(<Modal open onClose={() => {}} title="A"><button>a</button></Modal>);
    const second = render(<Modal open onClose={() => {}} title="B"><button>b</button></Modal>);
    expect(document.body.style.overflow).toBe('hidden');
    first.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    second.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  test('stacked dialogs: Escape closes only the topmost', async () => {
    function Stack() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(true);
      return (
        <>
          <Modal open={outer} onClose={() => setOuter(false)} title="Fora"><button>fora</button></Modal>
          <Modal open={inner} onClose={() => setInner(false)} title="Dentro"><button>dentro</button></Modal>
        </>
      );
    }
    render(<Stack />);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Dentro' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Fora' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('stacked dialogs: Tab is trapped in the topmost only', async () => {
    render(
      <>
        <Modal open onClose={() => {}} title="Fora"><button>fora</button></Modal>
        <Modal open onClose={() => {}} title="Dentro"><button>dentro</button></Modal>
      </>,
    );
    screen.getByText('dentro').focus();
    await userEvent.tab();
    expect(screen.getByRole('dialog', { name: 'Dentro' }).contains(document.activeElement)).toBe(true);
  });
});
