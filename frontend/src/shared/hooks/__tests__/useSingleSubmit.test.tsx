import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

import { useSingleSubmit } from '../useSingleSubmit';

let release: () => void = () => {};
let calls = 0;

function Form() {
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();
  const once = useSingleSubmit();
  const submit = handleSubmit(
    once(async () => {
      calls++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }),
  );

  return (
    <form onSubmit={submit}>
      <button type="submit" disabled={isSubmitting}>
        Salvar
      </button>
      <button type="button" onClick={() => void submit()}>
        Enviar de novo
      </button>
    </form>
  );
}

describe('useSingleSubmit', () => {
  test('segundo envio ignorado não reabilita o Salvar enquanto o primeiro está pendente', async () => {
    calls = 0;
    render(<Form />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Enviar de novo' }));
    await new Promise((r) => setTimeout(r, 20));

    expect(calls).toBe(1);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();

    release();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });
});
