import { http, HttpResponse } from 'msw';
import dashboard from '../fixtures/dashboard/dashboard.json';
import { API_URL } from './inventory';

export const dashboardHandlers = [http.get(`${API_URL}/dashboard`, () => HttpResponse.json(dashboard))];
