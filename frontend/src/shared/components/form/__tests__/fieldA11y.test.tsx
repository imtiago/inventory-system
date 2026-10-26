import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FieldError } from '../FieldError';
import { fieldA11y } from '../fieldA11y';
import { SupplierForm } from '@/modules/suppliers/components/SupplierForm';
import { VariantForm } from '@/modules/products/components/VariantForm';
import { ChangePasswordModal } from '@/modules/auth/components/ChangePasswordModal';
import { renderWithProviders } from '@/test/render';

/** O campo tem aria-invalid e o aria-describedby aponta para um elemento que contém a mensagem. */
function expectDescribedError(field: HTMLElement, message: string) {
  expect(field).toHaveAttribute('aria-invalid', 'true');
  const targetId = field.getAttribute('aria-describedby');
  expect(targetId).toBeTruthy();
  expect(document.getElementById(targetId as string)).toHaveTextContent(message);
}

describe('FieldError / fieldA11y', () => {
  test('sem erro não marca o campo nem renderiza mensagem', () => {
    render(
      <div>
        <input aria-label="Nome" {...fieldA11y('nome', undefined)} />
        <FieldError id="nome" message={undefined} />
      </div>,
    );
    const input = screen.getByLabelText('Nome');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(document.getElementById('nome-error')).toBeNull();
  });

  test('com erro liga o campo à mensagem', () => {
    render(
      <div>
        <input aria-label="Nome" {...fieldA11y('nome', 'Obrigatório.')} />
        <FieldError id="nome" message="Obrigatório." />
      </div>,
    );
    expectDescribedError(screen.getByLabelText('Nome'), 'Obrigatório.');
  });
});

describe('erros de campo acessíveis nos formulários', () => {
  test('fornecedor: nome vazio', async () => {
    renderWithProviders(<SupplierForm onSubmit={vi.fn()} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /salvar|cadastrar|criar/i }));
    const name = screen.getByLabelText(/Nome/);
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(document.getElementById(name.getAttribute('aria-describedby') as string)?.textContent).toBeTruthy();
  });

  test('variante: preço inválido', async () => {
    renderWithProviders(<VariantForm title="Nova" submitLabel="Salvar" onSubmit={vi.fn()} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText('Preço de venda (R$)'), '1,999');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Use no máximo 2 casas decimais');
    expectDescribedError(screen.getByLabelText('Preço de venda (R$)'), 'Use no máximo 2 casas decimais');
  });

  test('troca de senha: todos os campos com erro', async () => {
    renderWithProviders(<ChangePasswordModal open onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Alterar senha' }));
    await screen.findByText('Informe a senha atual.');
    expectDescribedError(screen.getByLabelText('Senha atual'), 'Informe a senha atual.');
    const next = screen.getByLabelText('Nova senha');
    expect(next).toHaveAttribute('aria-invalid', 'true');
    expect(next.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByLabelText('Confirmar nova senha')).toHaveAttribute('aria-invalid', 'true');
  });
});
