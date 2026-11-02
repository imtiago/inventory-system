import { describe, expect, test, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { CreditOverrideModal } from '../CreditOverrideModal';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

function renderModal(props: Partial<Parameters<typeof CreditOverrideModal>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(<CreditOverrideModal open reasons={['LIMIT']} pending={false} error={null} onSubmit={onSubmit} onClose={onClose} {...props} />);
  return { onSubmit, onClose };
}

describe('CreditOverrideModal', () => {
  test('explica a exceção e lista quem pode aprovar (GET /credit/approvers)', async () => {
    renderModal({ reasons: ['LIMIT', 'OVERDUE'] });

    const dialog = screen.getByRole('dialog', { name: 'Autorização de crédito' });
    expect(within(dialog).getByText(/acima do disponível/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/parcela em atraso/i)).toBeInTheDocument();
    const select = await within(dialog).findByLabelText('Quem autoriza');
    expect(await within(select).findByRole('option', { name: 'Ana Aprovadora' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Tiago Oliveira' })).toBeInTheDocument();
  });

  test('senha do aprovador: type=password e autocomplete off', () => {
    renderModal();
    const password = screen.getByLabelText('Senha de quem autoriza');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'off');
  });

  test('valida aprovador, senha e motivo (3+ caracteres) antes de enviar', async () => {
    const { onSubmit } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar e registrar' }));

    expect(await screen.findByText('Escolha quem autoriza.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
    expect(screen.getByText('O motivo deve ter ao menos 3 caracteres.')).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('envia e-mail do aprovador, senha e motivo aparado', async () => {
    const { onSubmit } = renderModal();
    await userEvent.selectOptions(await screen.findByLabelText('Quem autoriza'), await screen.findByRole('option', { name: 'Ana Aprovadora' }));
    await userEvent.type(screen.getByLabelText('Senha de quem autoriza'), 'segredo');
    await userEvent.type(screen.getByLabelText('Motivo'), '  Cliente antiga  ');
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar e registrar' }));

    expect(onSubmit).toHaveBeenCalledWith({ approverEmail: 'ana@loja.com.br', approverPassword: 'segredo', reason: 'Cliente antiga' });
  });

  test('mostra o erro recebido (ex.: autorização recusada) e trava enquanto envia', () => {
    renderModal({ error: 'Autorização recusada.', pending: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Autorização recusada.');
    expect(screen.getByRole('button', { name: 'Autorizando...' })).toBeDisabled();
  });

  test('sem aprovadores cadastrados: aviso', async () => {
    server.use(http.get(`${API_URL}/credit/approvers`, () => HttpResponse.json({ data: [] })));
    renderModal();
    expect(await screen.findByText('Nenhum usuário pode aprovar crédito. Peça ao administrador para marcar um aprovador.')).toBeInTheDocument();
  });
});
