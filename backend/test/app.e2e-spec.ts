import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API E2E - BV Phụ sản', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /api/departments trả về danh sách khoa', async () => {
    const res = await request(app.getHttpServer()).get('/api/departments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/auth/login đăng nhập bệnh nhân demo', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ tai_khoan: 'benhnhan@demo.vn', mat_khau: '123456' });
    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    token = res.body.access_token;
  });

  it('Login sai mật khẩu bị từ chối (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ tai_khoan: 'benhnhan@demo.vn', mat_khau: 'sai_mat_khau' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me cần JWT hợp lệ', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.vai_tro).toBe('benh_nhan');
  });

  it('RBAC: bệnh nhân không vào được /api/admin/reports', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });

  it('Chặn truy cập không có token', async () => {
    const res = await request(app.getHttpServer()).get('/api/appointments/me');
    expect(res.status).toBe(401);
  });
});
