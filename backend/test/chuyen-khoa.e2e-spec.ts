import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';

// ============================================================================
//  CHUYỂN KHOA ĐIỀU TRỊ (trong phiếu điều trị) — hai điểm kiểm soát:
//    1. Bác sĩ điều trị hoặc lễ tân lập đề nghị: khoa đến + lý do
//    2. Bác sĩ CỦA KHOA ĐẾN tiếp nhận / từ chối; nơi lập được hủy
//  Kiểm tra kèm: khoa đến phải khác khoa đang điều trị, mỗi phiếu khám chỉ một
//  đề nghị đang chờ, không xử lý lại phiếu đã đóng, và phạm vi hàng chờ theo khoa.
// ============================================================================
describe('Chuyển khoa điều trị', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bsSan: string;
  let bsIvf: string;
  let admin: string;
  let bsSanId: number;
  let khoaSanId: number;
  let khoaIvfId: number;

  // Một bệnh nhân mới: lịch khám với bác sĩ Khoa Sản + phiếu khám gắn lịch đó,
  // nên khoa đang điều trị suy ra được là Khoa Sản.
  const phieuKhamMoi = async (ten: string, gio: string) => {
    const bn = await taoBenhNhan(ds, ten);
    const lich = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
      .send({ ho_so_id: bn.id, bac_si_id: bsSanId, ngay: ngayISO(0), gio });
    expect(lich.status).toBe(201);
    const pk = await request(http).post('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`)
      .send({ ten_bn: ten, ho_so_id: bn.id, lich_hen_id: lich.body.id, chan_doan_so_bo: 'Thai 30 tuần' });
    expect(pk.status).toBe(201);
    return pk.body.id as number;
  };

  const deNghi = (pkId: number, khoaDenId: number, body: any = {}, token = leTan) =>
    request(http).post('/api/treatment/chuyen-khoa').set('Authorization', `Bearer ${token}`)
      .send({ phieu_kham_id: pkId, khoa_den_id: khoaDenId, ly_do: 'Vượt khả năng chuyên môn', ...body });
  const tiepNhan = (id: number, token: string) =>
    request(http).post(`/api/treatment/chuyen-khoa/${id}/tiep-nhan`).set('Authorization', `Bearer ${token}`).send({});
  const ketThuc = (id: number, body: any, token: string) =>
    request(http).post(`/api/treatment/chuyen-khoa/${id}/ket-thuc`).set('Authorization', `Bearer ${token}`).send(body);
  const danhSach = (qs: string, token: string) =>
    request(http).get(`/api/treatment/chuyen-khoa${qs}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    bsSanId = nen.bsSan.id;
    khoaSanId = nen.khoaSan.id;
    khoaIvfId = nen.khoaIvf.id;
    leTan = await dangNhap(http, 'letan@test.vn');
    bsSan = await dangNhap(http, 'bssan@test.vn');
    bsIvf = await dangNhap(http, 'bsivf@test.vn');
    admin = await dangNhap(http, 'admin@test.vn');
  });
  afterAll(async () => { await app.close(); });

  it('từ chối khi chưa đăng nhập', async () => {
    const r = await request(http).post('/api/treatment/chuyen-khoa')
      .send({ phieu_kham_id: 1, khoa_den_id: khoaIvfId, ly_do: 'x' });
    expect([401, 403]).toContain(r.status);
  });

  it('lễ tân lập được đề nghị, khoa đi suy ra từ lần khám', async () => {
    const pkId = await phieuKhamMoi('BN chuyển khoa 1', '08:00');
    const r = await deNghi(pkId, khoaIvfId, { tinh_trang_nb: 'Tỉnh, sinh hiệu ổn' });
    expect(r.status).toBe(201);
    expect(r.body.trang_thai).toBe('cho_tiep_nhan');
    expect(r.body.khoa_di.id).toBe(khoaSanId);
    expect(r.body.khoa_den.id).toBe(khoaIvfId);
    expect(r.body.ma_phieu).toMatch(/^CK/);
  });

  it('không lập được đề nghị thứ hai khi còn phiếu đang chờ', async () => {
    const pkId = await phieuKhamMoi('BN chuyển khoa 2', '08:15');
    expect((await deNghi(pkId, khoaIvfId)).status).toBe(201);
    const r = await deNghi(pkId, khoaIvfId);
    expect(r.status).toBe(409);
  });

  it('không chuyển sang chính khoa đang điều trị', async () => {
    const pkId = await phieuKhamMoi('BN chuyển khoa 3', '08:30');
    const r = await deNghi(pkId, khoaSanId);
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('Khoa Sản');
  });

  it('phải ghi lý do chuyển khoa', async () => {
    const pkId = await phieuKhamMoi('BN chuyển khoa 4', '08:45');
    const r = await deNghi(pkId, khoaIvfId, { ly_do: '   ' });
    expect(r.status).toBe(400);
  });

  it('chỉ bác sĩ của khoa đến mới tiếp nhận được', async () => {
    const pkId = await phieuKhamMoi('BN chuyển khoa 5', '09:00');
    const ck = await deNghi(pkId, khoaIvfId);
    expect(ck.status).toBe(201);

    // Bác sĩ Khoa Sản không phải khoa tiếp nhận
    expect((await tiepNhan(ck.body.id, bsSan)).status).toBe(403);
    // Lễ tân không có quyền ký bàn giao chuyên môn
    expect([401, 403]).toContain((await tiepNhan(ck.body.id, leTan)).status);

    const ok = await tiepNhan(ck.body.id, bsIvf);
    expect(ok.status).toBe(201);
    expect(ok.body.trang_thai).toBe('da_tiep_nhan');
    expect(ok.body.nguoi_xu_ly.ho_ten).toBe('BS IVF Test');

    // Không xử lý lại phiếu đã đóng
    expect((await tiepNhan(ck.body.id, bsIvf)).status).toBe(409);

    // Sau khi tiếp nhận, khoa đang điều trị là khoa đến → chuyển ngược về được
    const lai = await deNghi(pkId, khoaSanId);
    expect(lai.status).toBe(201);
    expect(lai.body.khoa_di.id).toBe(khoaIvfId);
  });

  it('khoa đến từ chối phải kèm lý do và chỉ khoa đến được từ chối', async () => {
    const pkId = await phieuKhamMoi('BN chuyển khoa 6', '09:15');
    const ck = await deNghi(pkId, khoaIvfId);
    expect(ck.status).toBe(201);

    expect((await ketThuc(ck.body.id, { trang_thai: 'tu_choi' }, bsIvf)).status).toBe(400);
    expect((await ketThuc(ck.body.id, { trang_thai: 'tu_choi', ly_do_ket_thuc: 'Hết giường' }, bsSan)).status).toBe(403);
    expect((await ketThuc(ck.body.id, { trang_thai: 'da_tiep_nhan', ly_do_ket_thuc: 'x' }, bsIvf)).status).toBe(400);

    const r = await ketThuc(ck.body.id, { trang_thai: 'tu_choi', ly_do_ket_thuc: 'Hết giường bệnh' }, bsIvf);
    expect(r.status).toBe(201);
    expect(r.body.trang_thai).toBe('tu_choi');
    expect(r.body.ly_do_ket_thuc).toBe('Hết giường bệnh');

    // Phiếu đã đóng → lập lại đề nghị mới được
    expect((await deNghi(pkId, khoaIvfId)).status).toBe(201);
  });

  it('bác sĩ không phải người lập thì không hủy được phiếu', async () => {
    const pkId = await phieuKhamMoi('BN chuyển khoa 7', '09:30');
    const ck = await deNghi(pkId, khoaIvfId);
    expect(ck.status).toBe(201);

    expect((await ketThuc(ck.body.id, { trang_thai: 'da_huy', ly_do_ket_thuc: 'Nhầm' }, bsSan)).status).toBe(403);
    const r = await ketThuc(ck.body.id, { trang_thai: 'da_huy', ly_do_ket_thuc: 'Người bệnh không đồng ý' }, leTan);
    expect(r.status).toBe(201);
    expect(r.body.trang_thai).toBe('da_huy');
  });

  it('hàng chờ của bác sĩ chỉ gồm phiếu gửi đến khoa của mình', async () => {
    const pkId = await phieuKhamMoi('BN chuyển khoa 8', '09:45');
    const ck = await deNghi(pkId, khoaIvfId);
    expect(ck.status).toBe(201);

    const cuaIvf = await danhSach('', bsIvf);
    expect(cuaIvf.status).toBe(200);
    expect(cuaIvf.body.every((c: any) => c.khoa_den.id === khoaIvfId)).toBe(true);
    expect(cuaIvf.body.some((c: any) => c.id === ck.body.id)).toBe(true);

    // Bác sĩ Khoa Sản không thấy phiếu gửi sang Khoa IVF
    const cuaSan = await danhSach('', bsSan);
    expect(cuaSan.status).toBe(200);
    expect(cuaSan.body.some((c: any) => c.id === ck.body.id)).toBe(false);

    // Quản trị viên xem toàn bộ, lọc được theo khoa
    const cuaAdmin = await danhSach(`?khoa_id=${khoaIvfId}`, admin);
    expect(cuaAdmin.status).toBe(200);
    expect(cuaAdmin.body.some((c: any) => c.id === ck.body.id)).toBe(true);

    // Lọc theo phiếu khám trả về đủ lịch sử của phiếu đó
    const theoPhieu = await danhSach(`?phieu_kham_id=${pkId}`, leTan);
    expect(theoPhieu.status).toBe(200);
    expect(theoPhieu.body).toHaveLength(1);
    expect(theoPhieu.body[0].id).toBe(ck.body.id);
  });

  it('trạng thái lọc không hợp lệ bị từ chối', async () => {
    const r = await danhSach('?trang_thai=linh_tinh', admin);
    expect(r.status).toBe(400);
  });
});
