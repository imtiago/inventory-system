import { http, HttpResponse } from 'msw';
import saleDetail from '../fixtures/sales/saleDetail.json';
import saleList from '../fixtures/sales/saleList.json';
import cancelRequests from '../fixtures/sales/cancelRequests.json';
import cancelRequestCount from '../fixtures/sales/cancelRequestCount.json';
import { API_URL } from './inventory';

// Fixtures already include the API envelope: { data } / { data, pagination }.
export const salesHandlers = [
  http.get(`${API_URL}/sales`, () => HttpResponse.json(saleList)),
  // Fixed paths before `/sales/:id`.
  http.get(`${API_URL}/sales/cancel-requests/count`, () => HttpResponse.json(cancelRequestCount)),
  http.get(`${API_URL}/sales/cancel-requests`, () => HttpResponse.json(cancelRequests)),
  http.get(`${API_URL}/sales/:id`, () => HttpResponse.json(saleDetail)),
  http.post(`${API_URL}/sales`, () => HttpResponse.json(saleDetail, { status: 201 })),
  http.post(`${API_URL}/sales/:id/cancel`, () =>
    HttpResponse.json({ data: { ...saleDetail.data, status: 'CANCELED' } }),
  ),
];
