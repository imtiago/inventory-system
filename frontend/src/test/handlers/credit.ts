import { http, HttpResponse } from 'msw';
import customerCredit from '../fixtures/credit/customerCredit.json';
import { API_URL } from './inventory';

// Ficha de crédito do cliente: a página de detalhes sempre a consulta.
export const creditHandlers = [http.get(`${API_URL}/customers/:id/credit`, () => HttpResponse.json(customerCredit))];
