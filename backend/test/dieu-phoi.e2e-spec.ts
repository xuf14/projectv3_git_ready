import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, MAT_KHAU, ngayISO } from './helpers';

// ============================================================================
//  ĐIỀU PHỐI BỆNH NHÂN VÀO KHOA PHÒNG — ba điểm kiểm soát:
//    1. Lễ tân tiếp đón (check-in) → phiếu điều phối tự sinh, trạng thái cho_duyet
//    2. Quản lý duyệt khoa + chỉ định bác sĩ → bệnh nhân sang hàng chờ bác sĩ ĐÓ
//    3. Lễ tân xác nhận đã đưa tới phòng → da_chuyen_phong
//  Kiểm tra kèm: phân quyền từng bước, bác sĩ phải thuộc khoa vừa duyệt, không
//  chuyển phòng khi chưa chỉ định, và phạm vi dữ liệu của bác sĩ.
// ============================================================================
describe('Điều phối bệnh nhân vào khoa phòng', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bsSan: string;
  let bsIvf: string;
  let admin: string;
  let quanLy: string;
  let bsSanId: number;
  let bsIvfId: number;
  let khoaSanId: number;
  let khoaIvfId: number;

  const checkin = (lichId: number) =>
    request(http).post(`/api/reception/checkin/${lichId}`).set('Authorization', `Bearer ${leTan}`).send({});
  const dsDieuPhoi = (qs: string, token: string) =>
    request(http).get(`/api/dieu-phoi${qs}`).set('Authorization', `Bearer ${token}`);
  const chiDinh = (id: number, body: any, token = quanLy) =>
    request(http).post(`/api/dieu-phoi/${id}/chi-dinh`).set('Authorization', `Bearer ${token}`).send(body);
  const chuyenPhong = (id: number, body: any, token = leTan) =>
    request(http).post(`/api/dieu-phoi/${id}/chuyen-phong`).set('Authorization', `Bearer ${token}`).send(body);
  const hangChoBacSi = (token: string) =>
    request(http).get('/api/queue').set('Authorization', `Bearer ${token}`);

  // Một bệnh nhân mới: đặt lịch với bác sĩ Khoa Sản rồi lễ tân tiếp đón
  const tiepDon = async (ten: string, gio: string) => {
    const bn = await taoBenhNhan(ds, ten);
    const lich = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
      .send({ ho_so_id: bn.id, bac_si_id: bsSanId, ngay: ngayISO(0), gio });
    expect(lich.status).toBe(201);
    const ci = await checkin(lich.body.id);
    expect(ci.status).toBe(201);
    const ds1 = await dsDieuPhoi('?trang_thai=tat_ca', quanLy);
    const phieu = ds1.body.find((d: any) => d.lich_hen && d.lich_hen.id === lich.body.id);
    expect(phieu).toBeDefined();
    return { bn, lichId: lich.body.id as number, dieuPhoiId: phieu.id as number };
  };

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    bsSanId = nen.bsSan.id;
    bsIvfId = nen.bsIvf.id;
    khoaSanId = nen.khoaSan.id;
    khoaIvfId = nen.khoaIvf.id;
    leTan = await dangNhap(http, 'letan@test.vn');
    bsSan = await dangNhap(http, 'bssan@test.vn');
    bsIvf = await dangNhap(http, 'bsivf@test.vn');
    admin = await dangNhap(http, 'admin@test.vn');

    const tao = await request(http).post('/api/admin/users').set('Authorization', `Bearer ${admin}`)
      .send({ vai_tro: 'quan_ly', ho_ten: 'Quản lý Điều phối', email: 'ql-dieuphoi@test.vn', mat_khau: MAT_KHAU });
    expect(tao.status).toBe(201);
    quanLy = await dangNhap(http, 'ql-dieuphoi@test.vn');
  });
  afterAll(async () => { await app.close(); });

  it('lễ tân tiếp đón thì phiếu điều phối tự sinh ở trạng thái chờ duyệt', async () => {
    const { dieuPhoiId } = await tiepDon('BN điều phối 1', '08:00');
    const r = await request(http).get(`/api/dieu-phoi/${dieuPhoiId}`).set('Authorization', `Bearer ${quanLy}`);
    expect(r.status).toBe(200);
    expect(r.body.trang_thai).toBe('cho_duyet');
    expect(r.body.benh_nhan.ho_ten).toBe('BN điều phối 1');
    // Khoa đặt lịch là gợi ý ban đầu, chưa có bác sĩ được chỉ định
    expect(r.body.khoa.id).toBe(khoaSanId);
    expect(r.body.bac_si).toBeNull();
    expect(r.body.thoi_gian_tiep_don).toBeTruthy();
    expect(r.body.thoi_gian_chi_dinh).toBeNull();
  });

  it('check-in lại không sinh phiếu điều phối thứ hai', async () => {
    const { lichId } = await tiepDon('BN điều phối 2', '08:15');
    expect((await checkin(lichId)).status).toBe(201);
    const r = await dsDieuPhoi('?trang_thai=tat_ca', quanLy);
    const cua = r.body.filter((d: any) => d.lich_hen && d.lich_hen.id === lichId);
    expect(cua).toHaveLength(1);
  });

  it('chỉ quản lý mới được duyệt khoa và chỉ định bác sĩ', async () => {
    const { dieuPhoiId } = await tiepDon('BN điều phối 3', '08:30');
    const body = { khoa_id: khoaSanId, bac_si_id: bsSanId };
    expect([401, 403]).toContain((await chiDinh(dieuPhoiId, body, leTan)).status);
    expect([401, 403]).toContain((await chiDinh(dieuPhoiId, body, bsSan)).status);
    expect((await chiDinh(dieuPhoiId, body, quanLy)).status).toBe(201);
  });

  it('bác sĩ phải thuộc đúng khoa vừa duyệt', async () => {
    const { dieuPhoiId } = await tiepDon('BN điều phối 4', '08:45');
    const sai = await chiDinh(dieuPhoiId, { khoa_id: khoaSanId, bac_si_id: bsIvfId });
    expect(sai.status).toBe(400);
    expect(sai.body.message).toContain('không thuộc');
    expect((await chiDinh(dieuPhoiId, { khoa_id: khoaSanId })).status).toBe(400);
  });

  it('chỉ định của quản lý đổi hàng chờ của bác sĩ', async () => {
    const { dieuPhoiId, bn } = await tiepDon('BN điều phối 5', '09:00');

    // Đặt lịch với bác sĩ Khoa Sản nên ban đầu nằm ở hàng chờ của bác sĩ đó
    const truocSan = await hangChoBacSi(bsSan);
    expect(truocSan.body.some((q: any) => q.ho_so && q.ho_so.id === bn.id)).toBe(true);

    // Quản lý chuyển sang Khoa IVF, chỉ định bác sĩ IVF
    const r = await chiDinh(dieuPhoiId, { khoa_id: khoaIvfId, bac_si_id: bsIvfId, ghi_chu: 'Ưu tiên khám trước' });
    expect(r.status).toBe(201);
    expect(r.body.trang_thai).toBe('da_chi_dinh');
    expect(r.body.khoa.id).toBe(khoaIvfId);
    expect(r.body.bac_si.id).toBe(bsIvfId);
    expect(r.body.ghi_chu).toBe('Ưu tiên khám trước');

    // Bệnh nhân rời hàng chờ bác sĩ Sản, sang hàng chờ bác sĩ IVF
    const sauSan = await hangChoBacSi(bsSan);
    expect(sauSan.body.some((q: any) => q.ho_so && q.ho_so.id === bn.id)).toBe(false);
    const sauIvf = await hangChoBacSi(bsIvf);
    const dong = sauIvf.body.find((q: any) => q.ho_so && q.ho_so.id === bn.id);
    expect(dong).toBeDefined();
    expect(dong.dieu_phoi.trang_thai).toBe('da_chi_dinh');
    expect(dong.bac_si_phu_trach.id).toBe(bsIvfId);
  });

  it('chưa chỉ định thì lễ tân không xác nhận chuyển phòng được', async () => {
    const { dieuPhoiId } = await tiepDon('BN điều phối 6', '09:15');
    const r = await chuyenPhong(dieuPhoiId, { phong: 'Phòng 204' });
    expect(r.status).toBe(409);
  });

  it('lễ tân xác nhận tới phòng — và chỉ lễ tân làm được việc này', async () => {
    const { dieuPhoiId, bn } = await tiepDon('BN điều phối 7', '09:30');
    expect((await chiDinh(dieuPhoiId, { khoa_id: khoaSanId, bac_si_id: bsSanId })).status).toBe(201);

    expect([401, 403]).toContain((await chuyenPhong(dieuPhoiId, { phong: 'P1' }, quanLy)).status);
    expect((await chuyenPhong(dieuPhoiId, {})).status).toBe(400); // thiếu phòng

    const r = await chuyenPhong(dieuPhoiId, { phong: 'Phòng 204 - Tầng 2' });
    expect(r.status).toBe(201);
    expect(r.body.trang_thai).toBe('da_chuyen_phong');
    expect(r.body.phong).toBe('Phòng 204 - Tầng 2');
    expect(r.body.thoi_gian_chuyen_phong).toBeTruthy();
    expect(r.body.nguoi_chuyen_phong.ho_ten).toBe('Lễ tân Test');

    // Bác sĩ thấy nhãn đã tới phòng trong hàng chờ
    const hc = await hangChoBacSi(bsSan);
    const dong = hc.body.find((q: any) => q.ho_so && q.ho_so.id === bn.id);
    expect(dong.dieu_phoi.trang_thai).toBe('da_chuyen_phong');
    expect(dong.dieu_phoi.phong).toBe('Phòng 204 - Tầng 2');

    // Đã tới phòng thì không xác nhận lại, cũng không đổi chỉ định được nữa
    expect((await chuyenPhong(dieuPhoiId, { phong: 'Phòng khác' })).status).toBe(409);
    expect((await chiDinh(dieuPhoiId, { khoa_id: khoaIvfId, bac_si_id: bsIvfId })).status).toBe(409);
  });

  it('quản lý hoãn phiếu thì phải kèm lý do và lễ tân không chuyển phòng được', async () => {
    const { dieuPhoiId } = await tiepDon('BN điều phối 8', '09:45');
    const thieu = await request(http).post(`/api/dieu-phoi/${dieuPhoiId}/tu-choi`)
      .set('Authorization', `Bearer ${quanLy}`).send({});
    expect(thieu.status).toBe(400);

    const r = await request(http).post(`/api/dieu-phoi/${dieuPhoiId}/tu-choi`)
      .set('Authorization', `Bearer ${quanLy}`).send({ ly_do_tu_choi: 'Người bệnh xin về, hẹn lại chiều' });
    expect(r.status).toBe(201);
    expect(r.body.trang_thai).toBe('tu_choi');
    expect((await chuyenPhong(dieuPhoiId, { phong: 'P9' })).status).toBe(409);
  });

  it('bác sĩ chỉ thấy phiếu điều phối được chỉ định cho mình', async () => {
    const { dieuPhoiId } = await tiepDon('BN điều phối 9', '10:00');
    expect((await chiDinh(dieuPhoiId, { khoa_id: khoaIvfId, bac_si_id: bsIvfId })).status).toBe(201);

    const cuaIvf = await dsDieuPhoi('?trang_thai=tat_ca', bsIvf);
    expect(cuaIvf.status).toBe(200);
    expect(cuaIvf.body.every((d: any) => d.bac_si && d.bac_si.id === bsIvfId)).toBe(true);
    expect(cuaIvf.body.some((d: any) => d.id === dieuPhoiId)).toBe(true);

    const cuaSan = await dsDieuPhoi('?trang_thai=tat_ca', bsSan);
    expect(cuaSan.body.some((d: any) => d.id === dieuPhoiId)).toBe(false);
  });

  it('trạng thái lọc không hợp lệ bị từ chối', async () => {
    expect((await dsDieuPhoi('?trang_thai=linh_tinh', quanLy)).status).toBe(400);
  });
});
