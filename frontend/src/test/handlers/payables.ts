import { http, HttpResponse } from 'msw';
import payableList from '../fixtures/finance/payableList.json';
import payableDetail from '../fixtures/finance/payableDetail.json';
import { API_URL } from './inventory';

// Fixtures already include the API envelope.
export const payablesHandlers = [
  http.get(`${API_URL}/payables`, () => HttpResponse.json(payableList)),
  http.get(`${API_URL}/payables/:id`, () => HttpResponse.json(payableDetail)),
];
