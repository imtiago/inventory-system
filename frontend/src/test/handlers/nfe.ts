import { http, HttpResponse } from 'msw';
import nfeImport from '../fixtures/nfe/nfeImport.json';
import nfeImportList from '../fixtures/nfe/nfeImportList.json';
import { API_URL } from './inventory';

// Fixtures already include the API envelope: { data } / { data, pagination }.
export const nfeHandlers = [
  http.get(`${API_URL}/nfe-imports`, () => HttpResponse.json(nfeImportList)),
  http.get(`${API_URL}/nfe-imports/:id`, () => HttpResponse.json(nfeImport)),
  http.post(`${API_URL}/nfe-imports`, () => HttpResponse.json(nfeImport, { status: 201 })),
  http.delete(`${API_URL}/nfe-imports/:id`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_URL}/nfe-imports/:id/confirm`, () => HttpResponse.json({ data: { importId: nfeImport.data.id, purchaseId: 'pc-1' } }, { status: 201 })),
];
