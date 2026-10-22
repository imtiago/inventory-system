import { http, HttpResponse } from 'msw';
import inventory from '../fixtures/inventory/inventory.json';
import inventoryLot from '../fixtures/inventory/inventoryLot.json';
import inventoryBox from '../fixtures/inventory/inventoryBox.json';
import inventoryList from '../fixtures/inventory/inventoryList.json';
import inventoryLotList from '../fixtures/inventory/inventoryLotList.json';
import inventoryBoxList from '../fixtures/inventory/inventoryBoxList.json';

export const API_URL: string = import.meta.env.VITE_API_URL;

// Fixtures already include the API envelope: { data } / { data, pagination }.
export const inventoryHandlers = [
  http.get(`${API_URL}/inventory`, () => HttpResponse.json(inventoryList)),
  http.get(`${API_URL}/inventory/boxes`, () => HttpResponse.json(inventoryBoxList)),
  http.post(`${API_URL}/inventory/boxes`, () => HttpResponse.json(inventoryBox, { status: 201 })),
  http.post(`${API_URL}/inventory/boxes/:boxId/items`, async ({ request, params }) => {
    const body = (await request.json()) as { inventoryLotId: string; quantity: number };
    return HttpResponse.json(
      { data: { id: 'item-1', boxId: params.boxId, ...body } },
      { status: 201 },
    );
  }),
  http.post(`${API_URL}/inventory/lots`, () => HttpResponse.json(inventoryLot, { status: 201 })),
  http.get(`${API_URL}/inventory/variants/:variantId/lots`, () => HttpResponse.json(inventoryLotList)),
  http.get(`${API_URL}/inventory/variants/:variantId`, () => HttpResponse.json(inventory)),
  http.get(`${API_URL}/inventory/:id`, () => HttpResponse.json(inventory)),
];
