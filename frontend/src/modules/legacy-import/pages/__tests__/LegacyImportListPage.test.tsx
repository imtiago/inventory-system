import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { LegacyImportListPage } from '../LegacyImportListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { resetViewport, setViewport } from '@/test/viewport';
import legacyBatches from '@/test/fixtures/legacy-import/legacyBatches.json';
import legacyBatch from '@/test/fixtures/legacy-import/legacyBatch.json';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/finance/legacy-imports" element={<LegacyImportListPage />} />
      <Route path="/finance/legacy-imports/quick" element={<div>Tela de lançamento rápido</div>} />
      <Route path="/finance/legacy-imports/:id" element={<div>Revisão do lote</div>} />
    </Routes>,
    { route: '/finance/legacy-imports' },
  );
}

const csv = () => new File(['nome;valor_total\nMaria;10,00\n'], 'caderno.csv', { type: 'text/csv' });

let createObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  server.use(http.get(`${API_URL}/legacy-imports`, () => HttpResponse.json(legacyBatches)));
  createObjectURL = vi.fn(() => 'blob:fake');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
});

afterEach(() => resetViewport());

describe('LegacyImportListPage', () => {
  test('mostra as etapas na ordem e os formatos aceitos', async () => {
    renderPage();

    const steps = within(screen.getByRole('list', { name: 'Etapas da migração' })).getAllByRole('listitem');
    expect(steps.map((s) => s.querySelector('[data-step-title]')?.textContent)).toEqual(['Baixar modelo', 'Enviar planilha ou lançamento rápido', 'Revisar', 'Confirmar']);
    expect(screen.getByText(/separador ";" ou ","/)).toBeInTheDocument();
    expect(screen.getByText(/dd\/mm\/aaaa/)).toBeInTheDocument();
    expect(await screen.findByText('caderno.csv')).toBeInTheDocument();
  });

  test('lista os lotes com situação, resumo, autor e link para revisar', async () => {
    renderPage();

    expect(await screen.findByText('caderno.csv')).toBeInTheDocument();
    const table = screen.getByRole('table');
    const badge = within(table).getByText('Rascunho');
    expect(badge).toHaveAttribute('data-status', 'DRAFT');
    expect(within(table).getByText('3 linhas · 2 novos · 1 existente')).toBeInTheDocument();
    expect(within(table).getByText('R$ 1.150,50')).toBeInTheDocument();
    expect(within(table).getByText(/Administrador/)).toBeInTheDocument();
    expect(within(table).getByText('3 avisos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', `/finance/legacy-imports/${legacyBatches.data[0].id}`);
  });

  test('no celular a lista vira cartões', async () => {
    setViewport(375, { pointer: 'coarse' });
    renderPage();

    expect(await screen.findByText('caderno.csv')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('Baixar modelo baixa o CSV do servidor', async () => {
    let requested = false;
    server.use(
      http.get(`${API_URL}/legacy-imports/template.csv`, () => {
        requested = true;
        return new HttpResponse('nome;celular\r\n', { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="modelo-caderninho.csv"' } });
      }),
    );
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Baixar modelo' }));
    await waitFor(() => expect(requested).toBe(true));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  });

  test('enviar planilha CSV abre a revisão do lote criado', async () => {
    let fileName: string | undefined;
    server.use(
      http.post(`${API_URL}/legacy-imports/csv`, async ({ request }) => {
        const form = await request.formData();
        fileName = (form.get('file') as File).name;
        return HttpResponse.json(legacyBatch, { status: 201 });
      }),
    );
    renderPage();

    const input = screen.getByLabelText('Enviar planilha');
    expect(input).toHaveAttribute('accept', '.csv,text/csv');
    await userEvent.upload(input, csv());

    expect(await screen.findByText('Revisão do lote')).toBeInTheDocument();
    expect(fileName).toBe('caderno.csv');
  });

  test('erro no envio mostra a mensagem do servidor', async () => {
    server.use(http.post(`${API_URL}/legacy-imports/csv`, () => HttpResponse.json({ message: 'Coluna obrigatória ausente: valor_total', code: 'VALIDATION_ERROR', errors: [] }, { status: 400 })));
    renderPage();

    await userEvent.upload(screen.getByLabelText('Enviar planilha'), csv());

    expect(await screen.findByRole('alert')).toHaveTextContent('Coluna obrigatória ausente: valor_total');
  });

  test('Lançamento rápido abre a tela de lançamento', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('link', { name: 'Lançamento rápido' }));

    expect(await screen.findByText('Tela de lançamento rápido')).toBeInTheDocument();
  });

  test('excluir rascunho pede confirmação e chama DELETE', async () => {
    let deleted: string | undefined;
    server.use(
      http.delete(`${API_URL}/legacy-imports/:id`, ({ params }) => {
        deleted = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    expect(deleted).toBeUndefined();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(deleted).toBe(legacyBatches.data[0].id));
  });
});
