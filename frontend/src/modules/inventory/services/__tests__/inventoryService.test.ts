import { describe, expect, test } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import inventory from '@/test/fixtures/inventory/inventory.json';
import inventoryLot from '@/test/fixtures/inventory/inventoryLot.json';
import inventoryLotList from '@/test/fixtures/inventory/inventoryLotList.json';
import inventoryBoxList from '@/test/fixtures/inventory/inventoryBoxList.json';
import {
  addLotToBox,
  createInventoryBox,
  createInventoryLot,
  getInventoryById,
  getInventoryByVariant,
  getInventoryLots,
  listInventoryBoxes,
} from '../inventoryService';

describe('inventoryService', () => {
  test('getInventoryById retorna data do envelope', async () => {
    const result = await getInventoryById(inventory.data.id);
    expect(result).toEqual(inventory.data);
  });

  test('getInventoryByVariant 404 → null; 500 → lança', async () => {
    server.use(
      http.get(`${API_URL}/inventory/variants/missing`, () =>
        HttpResponse.json({ message: 'Estoque não encontrado.', code: 'INVENTORY_NOT_FOUND' }, { status: 404 }),
      ),
      http.get(`${API_URL}/inventory/variants/broken`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    expect(await getInventoryByVariant('missing')).toBeNull();
    server.use(
      http.get(`${API_URL}/inventory/variants/nort`, () =>
        HttpResponse.json({ message: 'Rota não encontrada.', code: 'ROUTE_NOT_FOUND' }, { status: 404 }),
      ),
    );
    await expect(getInventoryByVariant('nort')).rejects.toThrow();
    await expect(getInventoryByVariant('broken')).rejects.toThrow();
    expect(await getInventoryByVariant(inventory.data.productVariantId)).toEqual(inventory.data);
  });

  test('getInventoryLots envia page/limit e retorna Paginated<InventoryLot>', async () => {
    let query: Record<string, string> = {};
    server.use(
      http.get(`${API_URL}/inventory/variants/:variantId/lots`, ({ request }) => {
        query = Object.fromEntries(new URL(request.url).searchParams);
        return HttpResponse.json(inventoryLotList);
      }),
    );

    const result = await getInventoryLots('v1', { page: 2, limit: 5 });

    expect(query).toEqual({ page: '2', limit: '5' });
    expect(result).toEqual(inventoryLotList);
  });

  test('createInventoryLot envia datas em ISO', async () => {
    let body: { expirationDate: string; manufacturingDate: string } | undefined;
    server.use(
      http.post(`${API_URL}/inventory/lots`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json(inventoryLot, { status: 201 });
      }),
    );

    const result = await createInventoryLot({
      productVariantId: 'v1',
      batchNumber: 'L1',
      quantity: 3,
      unitCost: 10,
      expirationDate: new Date('2028-09-15T00:00:00.000Z'),
      manufacturingDate: '2026-09-15',
    }, 'key-12345678');

    expect(body?.expirationDate).toBe('2028-09-15T00:00:00.000Z');
    expect(body?.manufacturingDate).toBe('2026-09-15T00:00:00.000Z');
    expect(result).toEqual(inventoryLot.data);
  });

  test('listInventoryBoxes envia search', async () => {
    let search: string | null = null;
    server.use(
      http.get(`${API_URL}/inventory/boxes`, ({ request }) => {
        search = new URL(request.url).searchParams.get('search');
        return HttpResponse.json(inventoryBoxList);
      }),
    );

    const result = await listInventoryBoxes('B0001');

    expect(search).toBe('B0001');
    expect(result).toEqual(inventoryBoxList);
  });

  test('createInventoryBox e addLotToBox retornam data', async () => {
    const box = await createInventoryBox("box-key-12345");
    expect(box.code).toBe('B000123');

    const item = await addLotToBox(box.id, { inventoryLotId: 'lot-1', quantity: 4 }, 'key-12345678');
    expect(item).toMatchObject({ boxId: box.id, inventoryLotId: 'lot-1', quantity: 4 });
  });
});
