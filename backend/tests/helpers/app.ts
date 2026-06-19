import request from 'supertest';
import { createApp } from '../../src/app';

export function getTestApp() {
  return createApp();
}

export function api(app: ReturnType<typeof createApp>) {
  return request(app);
}

export async function loginSuperAdmin(app: ReturnType<typeof createApp>) {
  const res = await api(app)
    .post('/api/admin/login')
    .send({ email: 'admin@hurixdigital.com', password: 'HurixAdmin@2026' });
  return res.body.token as string;
}
