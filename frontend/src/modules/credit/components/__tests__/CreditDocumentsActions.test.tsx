import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import { resetViewport, setViewport } from '@/test/viewport';
import saleDetailCrediario from '@/test/fixtures/sales/saleDetailCrediario.json';
import type { ISaleDetail } from '@/modules/sales/types';

import { CreditDocumentsActions } from '../CreditDocumentsActions';

const sale = saleDetailCrediario.data as unknown as ISaleDetail;
const customerUrl = `${API_URL}/customers/${sale.customer.id}`;
const pdfUrl = `${API_URL}/sales/${sale.id}/carne.pdf`;

function useCustomerPhone(phone: string | null) {
  server.use(http.get(customerUrl, () => HttpResponse.json({ data: { id: sale.customer.id, name: sale.customer.name, code: 'C1', phone, email: null, address: null, document: null, createdAt: '2026-10-01T00:00:00.000Z' } })));
}

function usePdf(onRequest?: () => void) {
  server.use(
    http.get(pdfUrl, () => {
      onRequest?.();
      return new HttpResponse('%PDF-1.3 fake', { headers: { 'Content-Type': 'application/pdf' } });
    }),
  );
}

let createObjectURL: ReturnType<typeof vi.fn>;
let anchorClick: ReturnType<typeof vi.spyOn>;
const downloads: string[] = [];

beforeEach(() => {
  createObjectURL = vi.fn(() => 'blob:fake');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  downloads.length = 0;
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});

afterEach(() => {
  anchorClick.mockRestore();
  resetViewport();
});

describe('CreditDocumentsActions', () => {
  it('Carnê (PDF) baixa o arquivo da venda; WhatsApp abre wa.me com o resumo', async () => {
    useCustomerPhone('(11) 98888-7777');
    let requested = 0;
    usePdf(() => requested++);
    renderWithProviders(<CreditDocumentsActions sale={sale} />);

    const whats = await screen.findByRole('link', { name: 'Enviar pelo WhatsApp' });
    expect(whats.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);
    expect(decodeURIComponent(whats.getAttribute('href')!)).toContain('Total a prazo: R$ 316,97');
    expect(whats).toHaveAttribute('target', '_blank');
    expect(whats).toHaveAttribute('rel', expect.stringContaining('noopener'));

    await userEvent.click(screen.getByRole('button', { name: 'Carnê (PDF)' }));
    await waitFor(() => expect(downloads).toEqual(['carne-5E8A1C3F.pdf']));
    expect(requested).toBe(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('cliente sem celular válido: WhatsApp desabilitado com o motivo', async () => {
    useCustomerPhone('(11) 3333-4444');
    renderWithProviders(<CreditDocumentsActions sale={sale} />);

    const button = await screen.findByRole('button', { name: /Enviar pelo WhatsApp/ });
    await waitFor(() => expect(button).toBeDisabled());
    expect(await screen.findByText('Cliente sem celular')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Enviar pelo WhatsApp' })).not.toBeInTheDocument();
  });

  it('sem dados da loja: mostra a mensagem da API em alerta', async () => {
    useCustomerPhone(null);
    server.use(http.get(pdfUrl, () => HttpResponse.json({ code: 'STORE_SETTINGS_MISSING', message: 'Preencha os dados da loja antes de emitir o carnê.' }, { status: 422 })));
    renderWithProviders(<CreditDocumentsActions sale={sale} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Carnê (PDF)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Preencha os dados da loja antes de emitir o carnê.');
    expect(downloads).toEqual([]);
  });

  it('no celular (toque): gera o PDF e mostra "Baixar PDF" para o clique do usuário', async () => {
    setViewport(375, { pointer: 'coarse' });
    useCustomerPhone('11988887777');
    usePdf();
    renderWithProviders(<CreditDocumentsActions sale={sale} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Carnê (PDF)' }));
    const download = await screen.findByRole('button', { name: 'Baixar PDF' });
    expect(downloads).toEqual([]);
    await userEvent.click(download);
    expect(downloads).toEqual(['carne-5E8A1C3F.pdf']);
  });

  it('não aparece em venda que não é crediário nem em venda cancelada', () => {
    const plain = renderWithProviders(<CreditDocumentsActions sale={{ ...sale, financing: null, paymentCondition: 'CASH' }} />);
    expect(plain.container).toBeEmptyDOMElement();
    plain.unmount();

    const canceled = renderWithProviders(<CreditDocumentsActions sale={{ ...sale, status: 'CANCELED' }} />);
    expect(canceled.container).toBeEmptyDOMElement();
  });
});
