import { http, HttpResponse } from 'msw';
import customerCredit from '../fixtures/credit/customerCredit.json';
import creditLimitRequests from '../fixtures/credit/creditLimitRequests.json';
import creditLimitRequestCount from '../fixtures/credit/creditLimitRequestCount.json';
import { API_URL } from './inventory';

// Ficha de crédito do cliente: a página de detalhes sempre a consulta.
export const creditHandlers = [
  http.get(`${API_URL}/customers/:id/credit`, () => HttpResponse.json(customerCredit)),
  http.get(`${API_URL}/credit/limit-requests/count`, () => HttpResponse.json(creditLimitRequestCount)),
  http.get(`${API_URL}/credit/limit-requests`, () => HttpResponse.json(creditLimitRequests)),
];
