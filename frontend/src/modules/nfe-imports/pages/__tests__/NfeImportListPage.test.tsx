import { describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { NfeImportListPage } from '../NfeImportListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import nfeImportList from '@/test/fixtures/nfe/nfeImportList.json';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/nfe-imports" element={<NfeImportListPage />} />
      <Route path="/nfe-imports/:id" element={<div>Revisão da nota</div>} />
      <Route path="/purchases/:id" element={<div>Detalhe do pedido</div>} />
    </Routes>,
    { route: '/nfe-imports' },
  );
}

const xml = () => new File(['<NFe/>'], 'nota.xml', { type: 'text/xml' });

describe('NfeImportListPage', () => {
  test('lista rascunhos com número/série, fornecedor, total e ação Revisar', async () => {
    renderPage();

    expect(await screen.findByText('12345/1')).toBeInTheDocument();
    expect(screen.getByText('Distribuidora Exemplo Ltda')).toBeInTheDocument();
    expect(screen.getByText('R$ 397,09')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', `/nfe-imports/${nfeImportList.data[0].id}`);
  });

  test('importação confirmada tem link Ver pedido e filtro de status é enviado', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API_URL}/nfe-imports`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({ ...nfeImportList, data: [{ ...nfeImportList.data[0], status: 'CONFIRMED', purchaseId: 'pc-9' }] });
      }),
    );
    renderPage();

    expect(await screen.findByRole('link', { name: 'Ver pedido' })).toHaveAttribute('href', '/purchases/pc-9');
    // A nota confirmada abre o detalhe (onde o ADMIN pode desfazer a importação).
    expect(screen.getByRole('link', { name: 'Ver nota' })).toHaveAttribute('href', `/nfe-imports/${nfeImportList.data[0].id}`);
    expect(screen.getByRole('option', { name: 'Desfeita' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'CONFIRMED');
    await waitFor(() => expect(urls.some((u) => u.includes('status=CONFIRMED'))).toBe(true));
  });

  test('enviar XML navega para a revisão', async () => {
    let contentType: string | null = null;
    server.use(
      http.post(`${API_URL}/nfe-imports`, async ({ request }) => {
        contentType = request.headers.get('content-type');
        const form = await request.formData();
        expect((form.get('file') as File).name).toBe('nota.xml');
        return HttpResponse.json({ data: { id: 'imp-7' } }, { status: 201 });
      }),
    );
    renderPage();

    const input = screen.getByLabelText('Enviar XML');
    expect(input).toHaveAttribute('accept', '.xml,text/xml,application/xml');
    await userEvent.upload(input, xml());

    expect(await screen.findByText('Revisão da nota')).toBeInTheDocument();
    expect(contentType).toContain('multipart/form-data');
  });

  test('409 NFE_ALREADY_IMPORTED mostra a mensagem uma vez e link para o pedido', async () => {
    server.use(
      http.post(`${API_URL}/nfe-imports`, () =>
        HttpResponse.json({ message: 'Esta nota já foi importada.', code: 'NFE_ALREADY_IMPORTED', details: { purchaseId: 'pc-5', importId: 'imp-5' } }, { status: 409 }),
      ),
    );
    renderPage();
    await userEvent.upload(screen.getByLabelText('Enviar XML'), xml());

    expect(await screen.findAllByText('Esta nota já foi importada.')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Ver pedido' })).toHaveAttribute('href', '/purchases/pc-5');
  });

  test('erro de arquivo inválido mostra a mensagem do backend uma vez', async () => {
    server.use(http.post(`${API_URL}/nfe-imports`, () => HttpResponse.json({ message: 'Envie o arquivo XML da NF-e.', code: 'UNSUPPORTED_FILE_TYPE' }, { status: 400 })));
    renderPage();
    await userEvent.upload(screen.getByLabelText('Enviar XML'), xml());

    expect(await screen.findAllByText('Envie o arquivo XML da NF-e.')).toHaveLength(1);
  });

  test('422 NFE_NOT_ACCEPTED mostra o motivo da recusa da nota', async () => {
    const message = 'A nota é destinada a outro CNPJ (11.222.333/0001-81).';
    server.use(http.post(`${API_URL}/nfe-imports`, () => HttpResponse.json({ message, code: 'NFE_NOT_ACCEPTED' }, { status: 422 })));
    renderPage();
    await userEvent.upload(screen.getByLabelText('Enviar XML'), xml());

    expect(await screen.findAllByText(message)).toHaveLength(1);
  });

  test('descartar rascunho pede confirmação e chama DELETE', async () => {
    let deleted: string | undefined;
    server.use(
      http.delete(`${API_URL}/nfe-imports/:id`, ({ params }) => {
        deleted = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Descartar' }));
    expect(deleted).toBeUndefined();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Descartar' }));

    await waitFor(() => expect(deleted).toBe(nfeImportList.data[0].id));
  });
});
