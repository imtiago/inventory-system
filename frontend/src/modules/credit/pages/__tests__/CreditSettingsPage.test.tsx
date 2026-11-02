import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import { resetViewport, setViewport } from '@/test/viewport';
import settingsFixture from '@/test/fixtures/credit/creditSettings.json';
import profilesFixture from '@/test/fixtures/credit/creditProfiles.json';
import profileFixture from '@/test/fixtures/credit/creditProfile.json';

import { CreditSettingsPage } from '../CreditSettingsPage';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function useBackend(settings: object = settingsFixture) {
  server.use(
    http.get(`${API_URL}/credit/settings`, () => HttpResponse.json(settings)),
    http.get(`${API_URL}/credit/profiles`, () => HttpResponse.json(profilesFixture)),
  );
}

describe('CreditSettingsPage', () => {
  it('shows the activation switch off with the warning', async () => {
    useBackend();
    renderWithProviders(<CreditSettingsPage />);

    const toggle = await screen.findByRole('switch', { name: 'Crediário ativo' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Confira os valores antes de ativar')).toBeInTheDocument();
  });

  it('activates and sends only the flag', async () => {
    useBackend();
    let body: object | undefined;
    server.use(
      http.put(`${API_URL}/credit/settings`, async ({ request }) => {
        body = (await request.json()) as object;
        return HttpResponse.json({ data: { ...settingsFixture.data, crediarioEnabled: true } });
      }),
    );
    renderWithProviders(<CreditSettingsPage />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Crediário ativo' }));

    await waitFor(() => expect(body).toEqual({ crediarioEnabled: true }));
  });

  it('shows STORE_SETTINGS_MISSING with the hint', async () => {
    useBackend();
    server.use(
      http.put(`${API_URL}/credit/settings`, () =>
        HttpResponse.json({ code: 'STORE_SETTINGS_MISSING', message: 'Os dados da loja estão incompletos.' }, { status: 422 }),
      ),
    );
    renderWithProviders(<CreditSettingsPage />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Crediário ativo' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Os dados da loja estão incompletos.');
    expect(within(alert).getByText('Preencha os dados da loja')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Crediário ativo' })).toHaveAttribute('aria-checked', 'false');
  });

  it('shows CREDIT_APPROVER_MISSING', async () => {
    useBackend();
    server.use(
      http.put(`${API_URL}/credit/settings`, () =>
        HttpResponse.json({ code: 'CREDIT_APPROVER_MISSING', message: 'Marque ao menos um usuário ativo como aprovador de crédito.' }, { status: 422 }),
      ),
    );
    renderWithProviders(<CreditSettingsPage />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Crediário ativo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Marque ao menos um usuário ativo como aprovador de crédito.');
  });

  it('renders the bands, the last one as "acima"', async () => {
    useBackend();
    renderWithProviders(<CreditSettingsPage />);

    const bands = await screen.findByRole('group', { name: 'Faixas de valor' });
    expect(within(bands).getByLabelText('Faixa 1: até (R$)')).toHaveValue('150,00');
    expect(within(bands).getByLabelText('Faixa 5: máximo de parcelas')).toHaveValue('10');
    expect(within(bands).getByText('acima de R$ 1.000,00')).toBeInTheDocument();
    expect(within(bands).queryByLabelText('Faixa 5: até (R$)')).not.toBeInTheDocument();
  });

  it('adds a band before the open one and removes another', async () => {
    useBackend();
    renderWithProviders(<CreditSettingsPage />);
    const bands = await screen.findByRole('group', { name: 'Faixas de valor' });

    await userEvent.click(within(bands).getByRole('button', { name: 'Adicionar faixa' }));
    expect(within(bands).getByLabelText('Faixa 5: até (R$)')).toBeInTheDocument();
    expect(within(bands).getByLabelText('Faixa 6: máximo de parcelas')).toBeInTheDocument();
    expect(within(bands).queryByLabelText('Faixa 6: até (R$)')).not.toBeInTheDocument();

    await userEvent.click(within(bands).getByRole('button', { name: 'Remover faixa 1' }));
    expect(within(bands).getByLabelText('Faixa 1: até (R$)')).toHaveValue('300,00');
  });

  it('cannot remove the only band', async () => {
    useBackend({ data: { ...settingsFixture.data, rules: { ...settingsFixture.data.rules, bands: [{ upTo: null, maxInstallments: 3 }] } } });
    renderWithProviders(<CreditSettingsPage />);
    const bands = await screen.findByRole('group', { name: 'Faixas de valor' });

    expect(within(bands).queryByRole('button', { name: /Remover faixa/ })).not.toBeInTheDocument();
  });

  it('saves the rules in reais and percent', async () => {
    useBackend();
    let body: { rules: Record<string, unknown> } | undefined;
    server.use(
      http.put(`${API_URL}/credit/settings`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json(settingsFixture);
      }),
    );
    renderWithProviders(<CreditSettingsPage />);

    const rate = await screen.findByLabelText('Taxa mensal (%)');
    expect(rate).toHaveValue('3,99');
    await userEvent.clear(rate);
    await userEvent.type(rate, '4,5');
    const first = screen.getByLabelText('Faixa 1: até (R$)');
    await userEvent.clear(first);
    await userEvent.type(first, '200');
    await userEvent.type(screen.getByLabelText('Dia fixo de vencimento'), '15');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar regras' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body?.rules).toMatchObject({
      monthlyRatePercent: 4.5,
      minInstallment: 30,
      interestFreeInstallments: 2,
      defaultDueDay: 15,
      finePercent: 2,
      monthlyInterestPercent: 1,
      graceDays: 3,
      overdueBlockDays: 10,
      bands: [
        { upTo: 200, maxInstallments: 2 },
        { upTo: 300, maxInstallments: 3 },
        { upTo: 600, maxInstallments: 5 },
        { upTo: 1000, maxInstallments: 8 },
        { upTo: null, maxInstallments: 10 },
      ],
      autoApproval: { profiles: ['GOOD', 'EXCELLENT'], maxDaysLate: 5, minPaidInstallments: 6, maxIncreasePercent: 50 },
    });
    expect((body?.rules.review as { weights: { dayLate: number } }).weights.dayLate).toBe(-1);
  });

  it('blocks a fine above 2% in the UI', async () => {
    useBackend();
    let called = false;
    server.use(
      http.put(`${API_URL}/credit/settings`, () => {
        called = true;
        return HttpResponse.json(settingsFixture);
      }),
    );
    renderWithProviders(<CreditSettingsPage />);

    const fine = await screen.findByLabelText('Multa por atraso (%)');
    await userEvent.clear(fine);
    await userEvent.type(fine, '2,5');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar regras' }));

    expect(await screen.findByText('A multa não pode passar de 2%')).toBeInTheDocument();
    expect(fine).toHaveAttribute('aria-invalid', 'true');
    expect(fine).toHaveAccessibleDescription(expect.stringContaining('A multa não pode passar de 2%'));
    expect(called).toBe(false);
  });

  it('requires ascending band ceilings', async () => {
    useBackend();
    renderWithProviders(<CreditSettingsPage />);
    const second = await screen.findByLabelText('Faixa 2: até (R$)');
    await userEvent.clear(second);
    await userEvent.type(second, '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar regras' }));

    expect(await screen.findByText('Use um valor maior que o da faixa anterior')).toBeInTheDocument();
  });

  it('shows the server fine error (FINE_ABOVE_LEGAL_LIMIT)', async () => {
    useBackend();
    server.use(
      http.put(`${API_URL}/credit/settings`, () => HttpResponse.json({ code: 'FINE_ABOVE_LEGAL_LIMIT', message: 'A multa por atraso não pode passar de 2%.' }, { status: 422 })),
    );
    renderWithProviders(<CreditSettingsPage />);
    await screen.findByLabelText('Taxa mensal (%)');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar regras' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A multa por atraso não pode passar de 2%.');
  });

  it('edits and saves a profile', async () => {
    useBackend();
    let sent: { code: string; body: object } | undefined;
    server.use(
      http.put(`${API_URL}/credit/profiles/:code`, async ({ request, params }) => {
        sent = { code: String(params.code), body: (await request.json()) as object };
        return HttpResponse.json(profileFixture);
      }),
    );
    renderWithProviders(<CreditSettingsPage />);

    const limit = await screen.findByLabelText('Novo: Limite inicial (R$)');
    expect(limit).toHaveValue('300,00');
    await userEvent.clear(limit);
    await userEvent.type(limit, '350');
    await userEvent.clear(screen.getByLabelText('Novo: Entrada mínima (%)'));
    await userEvent.type(screen.getByLabelText('Novo: Entrada mínima (%)'), '25');
    await userEvent.clear(screen.getByLabelText('Novo: Máximo de parcelas'));
    await userEvent.type(screen.getByLabelText('Novo: Máximo de parcelas'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil Novo' }));

    await waitFor(() => expect(sent).toBeDefined());
    expect(sent).toEqual({ code: 'NEW', body: { initialLimit: 350, minDownPaymentPercent: 25, maxInstallments: 4 } });
  });

  it('shows profiles on mobile', async () => {
    setViewport(375, { pointer: 'coarse' });
    useBackend();
    renderWithProviders(<CreditSettingsPage />);

    expect(await screen.findByLabelText('Excelente: Limite inicial (R$)')).toHaveValue('5.000,00');
    resetViewport();
  });
});
