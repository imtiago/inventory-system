import { http, HttpResponse } from 'msw';
import supplier from '../fixtures/purchases/supplier.json';
import supplierList from '../fixtures/purchases/supplierList.json';
import purchaseDetail from '../fixtures/purchases/purchaseDetail.json';
import purchaseList from '../fixtures/purchases/purchaseList.json';
import { API_URL } from './inventory';

// Fixtures already include the API envelope: { data } / { data, pagination }.
export const purchasesHandlers = [
  http.get(`${API_URL}/suppliers`, () => HttpResponse.json(supplierList)),
  http.get(`${API_URL}/suppliers/:id`, () => HttpResponse.json(supplier)),
  http.post(`${API_URL}/suppliers`, () => HttpResponse.json(supplier, { status: 201 })),
  http.patch(`${API_URL}/suppliers/:id`, () => HttpResponse.json(supplier)),
  http.delete(`${API_URL}/suppliers/:id`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_URL}/purchases`, () => HttpResponse.json(purchaseList)),
  http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json(purchaseDetail)),
  http.post(`${API_URL}/purchases`, () => HttpResponse.json(purchaseDetail, { status: 201 })),
  http.post(`${API_URL}/purchases/:id/receipts`, () => HttpResponse.json(purchaseDetail, { status: 201 })),
  http.post(`${API_URL}/purchases/:id/cancel`, () => HttpResponse.json({ data: { ...purchaseDetail.data, status: 'CANCELED' } })),
];
