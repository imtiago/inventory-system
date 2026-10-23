import { http, HttpResponse } from 'msw';
import saleDetail from '../fixtures/sales/saleDetail.json';
import saleList from '../fixtures/sales/saleList.json';
import { API_URL } from './inventory';

// Fixtures already include the API envelope: { data } / { data, pagination }.
export const salesHandlers = [
  http.get(`${API_URL}/sales`, () => HttpResponse.json(saleList)),
  http.get(`${API_URL}/sales/:id`, () => HttpResponse.json(saleDetail)),
  http.post(`${API_URL}/sales`, () => HttpResponse.json(saleDetail, { status: 201 })),
];
