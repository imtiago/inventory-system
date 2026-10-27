import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import { resetViewport, setViewport } from '@/test/viewport';
import settingsFixture from '@/test/fixtures/pricing/pricingSettings.json';
import errorFixture from '@/test/fixtures/errors/businessRule.json';

import { PricingSettingsPage } from '../PricingSettingsPage';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const credit = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 0]));
const unconfigured = {
  data: { configured: false, defaultMarginPercent: 0, roundingStrategy: 'STORE_TABLE', alertThresholdPercent: 2, cardFees: { debitPercent: 0, creditPercent: credit }, expenses: [], expensesTotalPercent: 0 },
};

function useSettings(body: object) {
  server.use(http.get(`${API_URL}/pricing/settings`, () => HttpResponse.json(body)));
}

describe('PricingSettingsPage', () => {
  it('warns when pricing is not configured yet', async () => {
    useSettings(unconfigured);
    renderWithProviders(<PricingSettingsPage />);

    expect(await screen.findByText('Preencha as configurações para ver preços sugeridos')).toBeInTheDocument();
  });

  it('does not warn once configured and shows the saved values', async () => {
    useSettings(settingsFixture);
    renderWithProviders(<PricingSettingsPage />);

    expect(await screen.findByLabelText('Margem padrão (%)')).toHaveValue('30,00');
    expect(screen.queryByText('Preencha as configurações para ver preços sugeridos')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Crédito 12x (%)')).toHaveValue('12,90');
    expect(screen.getByText('Aluguel')).toBeInTheDocument();
  });

  it('saves the percentages as numbers', async () => {
    useSettings(unconfigured);
    let body: object | undefined;
    server.use(
      http.put(`${API_URL}/pricing/settings`, async ({ request }) => {
        body = (await request.json()) as object;
        return HttpResponse.json(settingsFixture);
      }),
    );
    renderWithProviders(<PricingSettingsPage />);

    const margin = await screen.findByLabelText('Margem padrão (%)');
    await userEvent.clear(margin);
    await userEvent.type(margin, '35,5');
    await userEvent.selectOptions(screen.getByLabelText('Estratégia de arredondamento'), 'END_99');
    await userEvent.clear(screen.getByLabelText('Débito (%)'));
    await userEvent.type(screen.getByLabelText('Débito (%)'), '1,99');
    await userEvent.clear(screen.getByLabelText('Crédito 3x (%)'));
    await userEvent.type(screen.getByLabelText('Crédito 3x (%)'), '5,5');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      defaultMarginPercent: 35.5,
      roundingStrategy: 'END_99',
      alertThresholdPercent: 2,
      cardFees: { debitPercent: 1.99, creditPercent: { '1': 0, '3': 5.5, '12': 0 } },
    });
  });

  it('blocks a percentage of 100 or more without calling the API', async () => {
    useSettings(unconfigured);
    let called = false;
    server.use(http.put(`${API_URL}/pricing/settings`, () => ((called = true), HttpResponse.json(settingsFixture))));
    renderWithProviders(<PricingSettingsPage />);

    const margin = await screen.findByLabelText('Margem padrão (%)');
    await userEvent.clear(margin);
    await userEvent.type(margin, '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));

    expect(await screen.findByText('O percentual deve ser menor que 100%')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('shows the sum rule (422) at the top of the form', async () => {
    useSettings(settingsFixture);
    server.use(
      http.put(`${API_URL}/pricing/settings`, () =>
        HttpResponse.json({ ...errorFixture, code: 'PRICING_PERCENT_SUM_TOO_HIGH', message: 'Despesas e margem somam 100% ou mais' }, { status: 422 }),
      ),
    );
    renderWithProviders(<PricingSettingsPage />);

    await screen.findByLabelText('Margem padrão (%)');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Despesas e margem somam 100% ou mais');
  });

  it('lays the 12 credit fees out in a grid, one column on phones', async () => {
    setViewport(375, { pointer: 'coarse' });
    useSettings(settingsFixture);
    renderWithProviders(<PricingSettingsPage />);

    const grid = await screen.findByTestId('credit-fees-grid');
    expect(within(grid).getAllByLabelText(/^Crédito \d+x \(%\)$/)).toHaveLength(12);
    expect(grid.className).toMatch(/\bgrid-cols-1\b/);
    expect(grid.className).toMatch(/\bsm:grid-cols-\d/);
    resetViewport();
  });

  it('expense helper computes 7,50% from R$ 1.500 / R$ 20.000 and fills the percent', async () => {
    useSettings(settingsFixture);
    let body: object | undefined;
    server.use(
      http.post(`${API_URL}/pricing/expenses`, async ({ request }) => {
        body = (await request.json()) as object;
        return HttpResponse.json({ data: { id: 'x', name: 'Internet', percent: 7.5, active: true, position: 1 } }, { status: 201 });
      }),
    );
    renderWithProviders(<PricingSettingsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Nova despesa' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Internet');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Calcular pelo valor mensal' }));
    await userEvent.type(within(dialog).getByLabelText('Valor mensal (R$)'), '1.500');
    await userEvent.type(within(dialog).getByLabelText('Faturamento mensal (R$)'), '20.000');

    expect(within(dialog).getByText('7,50%')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar este percentual' }));
    expect(within(dialog).getByLabelText('Percentual (%)')).toHaveValue('7,50');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(body).toEqual({ name: 'Internet', percent: 7.5, active: true }));
  });

  it('shows the sum rule inside the expense dialog and keeps it open', async () => {
    useSettings(settingsFixture);
    server.use(
      http.post(`${API_URL}/pricing/expenses`, () =>
        HttpResponse.json({ ...errorFixture, code: 'PRICING_PERCENT_SUM_TOO_HIGH', message: 'Despesas e margem somam 100% ou mais' }, { status: 422 }),
      ),
    );
    renderWithProviders(<PricingSettingsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Nova despesa' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Taxa');
    await userEvent.type(within(dialog).getByLabelText('Percentual (%)'), '80');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Despesas e margem somam 100% ou mais');
  });

  it('deletes an expense after confirming', async () => {
    useSettings(settingsFixture);
    let deleted = false;
    server.use(http.delete(`${API_URL}/pricing/expenses/:id`, () => ((deleted = true), new HttpResponse(null, { status: 204 }))));
    renderWithProviders(<PricingSettingsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Aluguel' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(deleted).toBe(true));
  });
});
