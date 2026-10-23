import { http, HttpResponse } from 'msw';
import userList from '../fixtures/users/userList.json';
import user from '../fixtures/users/user.json';
import { API_URL } from './inventory';

// Fixtures already include the API envelope.
export const usersHandlers = [
  http.get(`${API_URL}/users`, ({ request }) => {
    const search = new URL(request.url).searchParams.get('search')?.toLowerCase();
    if (!search) return HttpResponse.json(userList);
    const data = userList.data.filter((u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
    return HttpResponse.json({ data, pagination: { ...userList.pagination, total: data.length } });
  }),
  http.get(`${API_URL}/users/:id`, () => HttpResponse.json(user)),
];
