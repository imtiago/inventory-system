import { http, HttpResponse } from 'msw';
import priceReviewCount from '../fixtures/pricing/priceReviewCount.json';
import { API_URL } from './inventory';

export const pricingHandlers = [http.get(`${API_URL}/pricing/reviews/count`, () => HttpResponse.json(priceReviewCount))];
