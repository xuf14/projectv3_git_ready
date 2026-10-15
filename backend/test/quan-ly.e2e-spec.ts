import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, MAT_KHAU, ngayISO } from './helpers';

// ============================================================================
//  CỔNG QUẢN LÝ — vai trò quan_ly chỉ GIÁM SÁT.
//  Kiểm tra: quản trị viên tạo được tài khoản quản lý · quản lý xem được tổng
//  quan nhưng KHÔNG chạm được nghiệp vụ hay quản trị · lễ tân/bác sĩ không xem
//  được · số liệu theo khoa và theo kỳ (ngày/tuần/tháng) đúng với dữ liệu thật.
// ============================================================================
describe('Cổng quản lý — giám sát hoạt động và doanh thu theo khoa', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bacSi: string;
  let admin: string;
  let quanLy: string;
  let bsSanId: number;
  let khoaSanId: number;
  let khoaIvfId: number;
  const homNay = ngayISO(0);

  const tongQuan = (qs: string, token: string) =>
    request(http).get(`/api/quan-ly/tong-quan${qs}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    bsSanId = nen.bsSan.id;
    khoaSanId = nen.khoaSan.id;
    khoaIvfId = nen.khoaIvf.id;
    leTan = await dangNhap(http, 'letan@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');
    admin = await dangNhap(http, 'admin@test.vn');

    // Quản trị viên tạo tài khoản quản lý qua API thật
    const tao = await request(http).post('/api/admin/users').set('Authorization', `Bearer ${admin}`)
      .send({ vai_tro: 'quan_ly', ho_ten: 'Ban Giám đốc Test', email: 'quanly@test.vn', mat_khau: MAT_KHAU });
    expect(tao.status).toBe(201);
    expect(tao.body.vai_tro).toBe('quan_ly');
    quanLy = await dangNhap(http, 'quanly@test.vn');

    // --- Dữ liệu thật trong ngày: 2 lần khám ở Khoa Sản, 1 đã khám ---
    const bn1 = await taoBenhNhan(ds, 'BN quản lý 1');
    const bn2 = await taoBenhNhan(ds, 'BN quản lý 2');
    const datLich = async (hoSoId: number, gio: string) => {
      const r = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
        .send({ ho_so_id: hoSoId, bac_si_id: bsSanId, ngay: homNay, gio });
      expect(r.status).toBe(201);
      return r.body.id as number;
    };
    const lich1 = await datLich(bn1.id, '08:00');
    await datLich(bn2.id, '08:30');
    const kl = await request(http).post(`/api/encounters/${lich1}/conclusion`).set('Authorization', `Bearer ${bacSi}`)
      .send({ chan_doan_chinh: 'Thai 30 tuần', huong_xu_tri: 've_nha' });
    expect(kl.status).toBe(201);

    // --- Viện phí: phiếu y lệnh gắn phiếu khám của lần khám Khoa Sản, thu 150.000đ ---
    const pk = await request(http).post('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`)
      .send({ ten_bn: bn1.ho_ten, ho_so_id: bn1.id, lich_hen_id: lich1 });
    expect(pk.status).toBe(201);
    const yl = await request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)
      .send({
        phieu_kham_id: pk.body.id, da_nop: 150000,
        chi_tiet: [{ loai: 'dich_vu', ten: 'Siêu âm thai', so_luong: 1, don_gia: 200000 }],
      });
    expect(yl.status).toBe(201);
  });
  afterAll(async () => { await app.close(); });

  it('từ chối khi chưa đăng nhập', async () => {
    const r = await request(http).get('/api/quan-ly/tong-quan');
    expect([401, 403]).toContain(r.status);
  });

  it('lễ tân và bác sĩ không xem được tổng quan quản lý', async () => {
    expect([401, 403]).toContain((await tongQuan('', leTan)).status);
    expect([401, 403]).toContain((await tongQuan('', bacSi)).status);
  });

  it('quản lý chỉ giám sát: không chạm được nghiệp vụ và quản trị', async () => {
    const lapPhieu = await request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${quanLy}`)
      .send({ chi_tiet: [{ loai: 'dich_vu', ten: 'X', so_luong: 1, don_gia: 1000 }] });
    expect([401, 403]).toContain(lapPhieu.status);

    const dsNguoiDung = await request(http).get('/api/admin/users').set('Authorization', `Bearer ${quanLy}`);
    expect([401, 403]).toContain(dsNguoiDung.status);

    const hoSo = await request(http).get('/api/patients').set('Authorization', `Bearer ${quanLy}`);
    expect([401, 403]).toContain(hoSo.status);
  });

  it('kỳ và mốc thời gian sai bị từ chối', async () => {
    expect((await tongQuan('?ky=quy', quanLy)).status).toBe(400);
    expect((await tongQuan('?ky=ngay&moc=01-01-2026', quanLy)).status).toBe(400);
  });

  it('kỳ ngày: số liệu tổng và theo khoa khớp dữ liệu đã tạo', async () => {
    const r = await tongQuan(`?ky=ngay&moc=${homNay}`, quanLy);
    expect(r.status).toBe(200);
    expect(r.body.ky).toBe('ngay');
    expect(r.body.tu).toBe(homNay);
    expect(r.body.den).toBe(homNay);

    const t = r.body.tong;
    expect(t.luot_dat).toBe(2);
    expect(t.da_kham).toBe(1);
    expect(t.so_benh_nhan).toBe(2);
    expect(t.ty_le_den_kham).toBe(50);
    expect(t.doanh_thu_vien_phi).toBe(150000);
    expect(t.tong_doanh_thu).toBe(t.doanh_thu_dich_vu + t.doanh_thu_vien_phi);
    // Phiếu y lệnh 200.000đ mới nộp 150.000đ
    expect(t.vien_phi_con_thieu).toBe(50000);

    // Mọi khoa trong danh mục đều có mặt, kể cả khoa không phát sinh
    const khoa = r.body.theo_khoa;
    expect(khoa.map((k: any) => k.id).sort()).toEqual([khoaSanId, khoaIvfId].sort());
    const san = khoa.find((k: any) => k.id === khoaSanId);
    const ivf = khoa.find((k: any) => k.id === khoaIvfId);
    expect(san.luot_dat).toBe(2);
    expect(san.da_kham).toBe(1);
    expect(san.doanh_thu_vien_phi).toBe(150000);
    expect(san.tong_doanh_thu).toBe(san.doanh_thu_dich_vu + san.doanh_thu_vien_phi);
    expect(ivf.luot_dat).toBe(0);
    expect(ivf.tong_doanh_thu).toBe(0);
    expect(ivf.ty_le_den_kham).toBe(0);

    // Tổng theo khoa + phần chưa phân bổ phải bằng tổng toàn viện
    const congKhoa = khoa.reduce((s: number, k: any) => s + k.tong_doanh_thu, 0);
    expect(congKhoa + t.chua_phan_bo).toBe(t.tong_doanh_thu);
  });

  // Đây chính là lỗi đã gặp trên dữ liệu thật: phiếu khám không gắn lần khám thì
  // chuỗi lan_thu_tien_y_lenh → y_lenh → phieu_kham → lich_hen → khoa bị đứt.
  // Tiền vẫn phải vào tổng toàn viện và hiện ở mục chua_phan_bo, không được biến mất.
  it('phiếu khám không gắn lần khám: tiền rơi vào "chưa quy được về khoa"', async () => {
    const truoc = (await tongQuan(`?ky=ngay&moc=${homNay}`, quanLy)).body.tong;

    const bn = await taoBenhNhan(ds, 'BN không gắn lần khám');
    const pk = await request(http).post('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`)
      .send({ ten_bn: bn.ho_ten, ho_so_id: bn.id }); // cố ý KHÔNG truyền lich_hen_id
    expect(pk.status).toBe(201);
    const yl = await request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)
      .send({
        phieu_kham_id: pk.body.id, da_nop: 80000,
        chi_tiet: [{ loai: 'dich_vu', ten: 'Xét nghiệm máu', so_luong: 1, don_gia: 80000 }],
      });
    expect(yl.status).toBe(201);

    const sau = (await tongQuan(`?ky=ngay&moc=${homNay}`, quanLy)).body;
    expect(sau.tong.doanh_thu_vien_phi).toBe(truoc.doanh_thu_vien_phi + 80000);
    // Không khoa nào nhận khoản này; nó nằm trọn ở phần chưa phân bổ
    expect(sau.tong.chua_phan_bo).toBe(truoc.chua_phan_bo + 80000);
    const congKhoa = sau.theo_khoa.reduce((s: number, k: any) => s + k.tong_doanh_thu, 0);
    expect(congKhoa + sau.tong.chua_phan_bo).toBe(sau.tong.tong_doanh_thu);
  });

  it('kỳ tuần và tháng bao trùm ngày đang xem', async () => {
    const tuan = await tongQuan(`?ky=tuan&moc=${homNay}`, quanLy);
    expect(tuan.status).toBe(200);
    expect(tuan.body.tu <= homNay && homNay <= tuan.body.den).toBe(true);
    // Tuần bắt đầu thứ Hai → đúng 7 ngày
    const soNgay = (Date.parse(tuan.body.den) - Date.parse(tuan.body.tu)) / 86400000;
    expect(soNgay).toBe(6);
    expect(tuan.body.tong.da_kham).toBe(1);

    const thang = await tongQuan(`?ky=thang&moc=${homNay}`, quanLy);
    expect(thang.status).toBe(200);
    expect(thang.body.tu).toBe(homNay.slice(0, 8) + '01');
    expect(thang.body.tu <= homNay && homNay <= thang.body.den).toBe(true);
    expect(thang.body.tong.da_kham).toBe(1);
  });

  it('chuỗi xu hướng đủ số mốc và kết thúc ở kỳ đang xem', async () => {
    const soMoc = { ngay: 7, tuan: 8, thang: 6 };
    for (const ky of ['ngay', 'tuan', 'thang'] as const) {
      const r = await tongQuan(`?ky=${ky}&moc=${homNay}`, quanLy);
      expect(r.status).toBe(200);
      expect(r.body.theo_moc).toHaveLength(soMoc[ky]);
      expect(r.body.theo_moc[r.body.theo_moc.length - 1].tu).toBe(r.body.tu);
      // Mốc tăng dần theo thời gian
      const moc = r.body.theo_moc.map((m: any) => m.tu);
      expect([...moc].sort()).toEqual(moc);
    }
  });

  it('kỳ không có dữ liệu trả về số 0, không lỗi', async () => {
    const r = await tongQuan(`?ky=ngay&moc=${ngayISO(-400)}`, quanLy);
    expect(r.status).toBe(200);
    expect(r.body.tong.luot_dat).toBe(0);
    expect(r.body.tong.tong_doanh_thu).toBe(0);
    expect(r.body.theo_khoa.every((k: any) => k.tong_doanh_thu === 0)).toBe(true);
  });

  // Hồi quy: mốc xu hướng từng bị lệch một ngày (date → giờ máy → ISO/UTC) nên mọi
  // cột ra 0. Kỳ đang xem ở cuối chuỗi phải khớp đúng số tổng của chính kỳ đó.
  it('mốc cuối của chuỗi xu hướng khớp số tổng của kỳ đang xem', async () => {
    for (const ky of ['ngay', 'tuan', 'thang']) {
      const r = await tongQuan(`?ky=${ky}&moc=${homNay}`, quanLy);
      const cuoi = r.body.theo_moc[r.body.theo_moc.length - 1];
      expect(cuoi.da_kham).toBe(r.body.tong.da_kham);
      expect(cuoi.luot_dat).toBe(r.body.tong.luot_dat);
      expect(cuoi.doanh_thu).toBe(r.body.tong.tong_doanh_thu);
    }
  });

  it('thống kê thuốc: chỉ quản lý / quản trị xem được', async () => {
    const hoi = (token?: string) => {
      const req = request(http).get(`/api/quan-ly/thuoc?ky=ngay&moc=${homNay}`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    };
    expect([401, 403]).toContain((await hoi()).status);
    expect([401, 403]).toContain((await hoi(leTan)).status);
    expect([401, 403]).toContain((await hoi(bacSi)).status);
    expect((await hoi(quanLy)).status).toBe(200);
    expect((await hoi(admin)).status).toBe(200);
  });

  it('thống kê thuốc: chỉ tính dòng thuốc, gộp cùng loại, quy về khoa, khớp xu hướng', async () => {
    const thuocHomNay = () => request(http).get(`/api/quan-ly/thuoc?ky=ngay&moc=${homNay}`)
      .set('Authorization', `Bearer ${quanLy}`);
    const truoc = (await thuocHomNay()).body;

    // Hai người bệnh khám ở Khoa Sản, mỗi người một phiếu y lệnh
    const phieuThuoc = async (ten: string, gio: string, chiTiet: any[]) => {
      const bn = await taoBenhNhan(ds, ten);
      const lich = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
        .send({ ho_so_id: bn.id, bac_si_id: bsSanId, ngay: homNay, gio });
      expect(lich.status).toBe(201);
      const pk = await request(http).post('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`)
        .send({ ten_bn: ten, ho_so_id: bn.id, lich_hen_id: lich.body.id });
      expect(pk.status).toBe(201);
      const yl = await request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)
        .send({ phieu_kham_id: pk.body.id, da_nop: 0, chi_tiet: chiTiet });
      expect(yl.status).toBe(201);
    };
    await phieuThuoc('BN thuốc 1', '10:00', [
      { loai: 'thuoc', ten: 'Paracetamol 500mg', dvt: 'Viên', so_luong: 10, don_gia: 2000 },   // 20.000
      { loai: 'thuoc', ten: 'Sắt folic', dvt: 'Viên', so_luong: 30, don_gia: 3000 },           // 90.000
      { loai: 'dich_vu', ten: 'Siêu âm', so_luong: 1, don_gia: 150000 },                       // không phải thuốc
    ]);
    await phieuThuoc('BN thuốc 2', '10:30', [
      { loai: 'thuoc', ten: 'paracetamol 500MG', dvt: 'Viên', so_luong: 6, don_gia: 2000 },    // 12.000, cùng loại
    ]);

    const r = (await thuocHomNay()).body;
    expect(r.tong.so_luot).toBe(truoc.tong.so_luot + 3);
    expect(r.tong.gia_tri).toBe(truoc.tong.gia_tri + 122000);        // dịch vụ 150.000đ bị loại
    expect(r.tong.so_loai).toBe(truoc.tong.so_loai + 2);             // hoa/thường vẫn là một loại

    const para = r.theo_thuoc.find((t: any) => t.ten.toLowerCase() === 'paracetamol 500mg');
    expect(para.so_luong).toBe(16);
    expect(para.gia_tri).toBe(32000);
    expect(para.so_luot).toBe(2);
    expect(para.so_benh_nhan).toBe(2);
    expect(r.theo_thuoc.some((t: any) => t.ten === 'Siêu âm')).toBe(false);
    // Sắp theo giá trị giảm dần
    const giaTri = r.theo_thuoc.map((t: any) => t.gia_tri);
    expect([...giaTri].sort((a, b) => b - a)).toEqual(giaTri);

    // Gõ tay không có mã → không có trong danh mục → "Chưa phân nhóm"
    expect(r.theo_nhom.find((n: any) => n.nhom === 'Chưa phân nhóm').gia_tri).toBeGreaterThanOrEqual(122000);

    const san = r.theo_khoa.find((k: any) => k.id === khoaSanId);
    expect(san.gia_tri).toBeGreaterThanOrEqual(122000);
    const congKhoa = r.theo_khoa.reduce((s: number, k: any) => s + k.gia_tri, 0);
    expect(congKhoa).toBe(r.tong.gia_tri);

    const cuoi = r.theo_moc[r.theo_moc.length - 1];
    expect(cuoi.gia_tri).toBe(r.tong.gia_tri);
    expect(cuoi.so_luot).toBe(r.tong.so_luot);
  });

  it('quản lý xem được hàng chờ nhập viện nhưng không thao tác được', async () => {
    const hangCho = await request(http).get('/api/nhap-vien/hang-cho?trang_thai=mo').set('Authorization', `Bearer ${quanLy}`);
    expect(hangCho.status).toBe(200);
    expect(Array.isArray(hangCho.body)).toBe(true);
    const tiepNhan = await request(http).post('/api/nhap-vien/1/tiep-nhan').set('Authorization', `Bearer ${quanLy}`).send({});
    expect([401, 403]).toContain(tiepNhan.status);
    const xacNhan = await request(http).post('/api/nhap-vien/1/xac-nhan').set('Authorization', `Bearer ${quanLy}`).send({});
    expect([401, 403]).toContain(xacNhan.status);
  });

  it('quản trị viên cũng xem được để đối chiếu', async () => {
    const r = await tongQuan(`?ky=ngay&moc=${homNay}`, admin);
    expect(r.status).toBe(200);
    expect(r.body.tong.da_kham).toBe(1);
  });
});
