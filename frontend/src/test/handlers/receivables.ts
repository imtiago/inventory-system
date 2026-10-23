import { http, HttpResponse } from 'msw';
import receivableList from '../fixtures/finance/receivableList.json';
import receivableDetail from '../fixtures/finance/receivableDetail.json';
import { API_URL } from './inventory';

// Fixtures already include the API envelope.
export const receivablesHandlers = [
  http.get(`${API_URL}/receivables`, () => HttpResponse.json(receivableList)),
  http.get(`${API_URL}/receivables/:id`, () => HttpResponse.json(receivableDetail)),
];
