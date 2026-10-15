import {
  Injectable, Controller, Get, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

// ============================================================================
//  CỔNG QUẢN LÝ — chỉ GIÁM SÁT, không nhập liệu.
//  Một màn hình duy nhất: hoạt động khám và doanh thu của TỪNG KHOA PHÒNG theo
//  kỳ ngày / tuần / tháng, kèm chuỗi các kỳ liền trước để thấy xu hướng.
//
//  Quy ước tính số (ghi rõ để người đọc báo cáo không hiểu nhầm):
//    - Lượt khám tính theo NGÀY KHÁM của khung giờ (khung_gio.ngay).
//    - Doanh thu tính theo NGÀY THỰC THU, gồm hai nguồn:
//        - dịch vụ : thanh_toan đã thanh toán (ngay_thanh_toan)
//        - viện phí: từng lần thu của phiếu y lệnh (lan_thu_tien_y_lenh.thoi_gian)
//    - Doanh thu quy về khoa qua lần khám (lich_hen.khoa_id). Khoản thu không gắn
//      được lần khám nào được gộp vào "chua_phan_bo" để tổng luôn khớp.
//
//    GET /api/quan-ly/tong-quan?ky=ngay|tuan|thang&moc=YYYY-MM-DD
//    GET /api/quan-ly/thuoc?ky=&moc=     thuốc đã cấp cho người bệnh trong kỳ
// ============================================================================

export const KY_HOP_LE = ['ngay', 'tuan', 'thang'];
const TRUNC: Record<string, string> = { ngay: 'day', tuan: 'week', thang: 'month' };
// Số kỳ hiển thị trên biểu đồ xu hướng, tính cả kỳ đang xem
const SO_MOC: Record<string, number> = { ngay: 7, tuan: 8, thang: 6 };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const hai = (n: number) => String(n).padStart(2, '0');

@Injectable()
export class QuanLyService {
  constructor(private ds: DataSource) {}

  private so = (v: any) => Number(v) || 0;

  // Ngày neo của kỳ báo cáo; mặc định hôm nay. Dùng giờ UTC cho phép tính ngày
  // để không bị lệch múi giờ khi cộng trừ ngày.
  private chuanMoc(v: any): Date {
    const s = v === undefined || v === null || v === '' ? ymd(new Date()) : String(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException('Mốc thời gian phải có dạng YYYY-MM-DD');
    const d = new Date(s + 'T00:00:00Z');
    if (isNaN(d.getTime())) throw new BadRequestException('Mốc thời gian không hợp lệ');
    return d;
  }

  // Đầu kỳ chứa ngày d. Tuần bắt đầu THỨ HAI (đúng quy ước lịch Việt Nam và
  // trùng với date_trunc('week') của PostgreSQL).
  private dauKy(ky: string, d: Date): Date {
    if (ky === 'ngay') return new Date(d);
    if (ky === 'tuan') {
      const lech = (d.getUTCDay() + 6) % 7;
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - lech));
    }
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private cuoiKy(ky: string, dau: Date): Date {
    if (ky === 'ngay') return new Date(dau);
    if (ky === 'tuan') return new Date(Date.UTC(dau.getUTCFullYear(), dau.getUTCMonth(), dau.getUTCDate() + 6));
    return new Date(Date.UTC(dau.getUTCFullYear(), dau.getUTCMonth() + 1, 0));
  }

  private luiKy(ky: string, dau: Date, n: number): Date {
    if (ky === 'ngay') return new Date(Date.UTC(dau.getUTCFullYear(), dau.getUTCMonth(), dau.getUTCDate() - n));
    if (ky === 'tuan') return new Date(Date.UTC(dau.getUTCFullYear(), dau.getUTCMonth(), dau.getUTCDate() - 7 * n));
    return new Date(Date.UTC(dau.getUTCFullYear(), dau.getUTCMonth() - n, 1));
  }

  private nhanKy(ky: string, dau: Date): string {
    if (ky === 'thang') return `${hai(dau.getUTCMonth() + 1)}/${dau.getUTCFullYear()}`;
    const nhan = `${hai(dau.getUTCDate())}/${hai(dau.getUTCMonth() + 1)}`;
    return ky === 'tuan' ? `Tuần ${nhan}` : nhan;
  }

  async tongQuan(kyRaw: any, mocRaw: any) {
    const ky = String(kyRaw || 'ngay').trim();
    if (!KY_HOP_LE.includes(ky)) throw new BadRequestException('Kỳ báo cáo phải là ngay, tuan hoặc thang');
    const dau = this.dauKy(ky, this.chuanMoc(mocRaw));
    const cuoi = this.cuoiKy(ky, dau);
    const P = [ymd(dau), ymd(cuoi)];

    const [tongLich] = await this.ds.query(`
      SELECT COUNT(*)::int AS luot_dat,
             COUNT(*) FILTER (WHERE lh.trang_thai = 'da_kham')::int AS da_kham,
             COUNT(*) FILTER (WHERE lh.trang_thai = 'da_huy')::int AS da_huy,
             COUNT(*) FILTER (WHERE lh.trang_thai IN ('cho_xac_nhan','da_xac_nhan','da_checkin'))::int AS dang_cho,
             COUNT(DISTINCT lh.ho_so_id)::int AS so_benh_nhan
        FROM lich_hen lh JOIN khung_gio kg ON kg.id = lh.khung_gio_id
       WHERE kg.ngay BETWEEN $1 AND $2`, P);

    // Tổng thực thu toàn viện — tính độc lập với bảng theo khoa để đối chiếu
    const [tongThu] = await this.ds.query(`
      SELECT COALESCE(SUM(tien) FILTER (WHERE nguon = 'dich_vu'),0)::int AS dich_vu,
             COALESCE(SUM(tien) FILTER (WHERE nguon = 'vien_phi'),0)::int AS vien_phi
        FROM (
          SELECT 'dich_vu' AS nguon, tong_tien AS tien FROM thanh_toan
           WHERE trang_thai = 'da_thanh_toan' AND ngay_thanh_toan::date BETWEEN $1 AND $2
          UNION ALL
          SELECT 'vien_phi', so_tien FROM lan_thu_tien_y_lenh
           WHERE thoi_gian::date BETWEEN $1 AND $2
        ) x`, P);

    // Công nợ viện phí của các phiếu lập trong kỳ
    const [conNo] = await this.ds.query(`
      SELECT COALESCE(SUM(GREATEST(tong_tien - da_nop, 0)),0)::int AS thieu,
             COUNT(*)::int AS so_phieu
        FROM y_lenh WHERE ngay_tao::date BETWEEN $1 AND $2`, P);

    const theoKhoa = await this.ds.query(`
      WITH lich AS (
        SELECT lh.khoa_id,
               COUNT(*)::int AS luot_dat,
               COUNT(*) FILTER (WHERE lh.trang_thai = 'da_kham')::int AS da_kham,
               COUNT(*) FILTER (WHERE lh.trang_thai = 'da_huy')::int AS da_huy
          FROM lich_hen lh JOIN khung_gio kg ON kg.id = lh.khung_gio_id
         WHERE kg.ngay BETWEEN $1 AND $2 AND lh.khoa_id IS NOT NULL
         GROUP BY lh.khoa_id
      ),
      dv AS (
        SELECT lh.khoa_id, COALESCE(SUM(t.tong_tien),0)::int AS tien
          FROM thanh_toan t JOIN lich_hen lh ON lh.id = t.lich_hen_id
         WHERE t.trang_thai = 'da_thanh_toan' AND t.ngay_thanh_toan::date BETWEEN $1 AND $2
           AND lh.khoa_id IS NOT NULL
         GROUP BY lh.khoa_id
      ),
      vp AS (
        SELECT lh.khoa_id, COALESCE(SUM(l.so_tien),0)::int AS tien
          FROM lan_thu_tien_y_lenh l
          JOIN y_lenh y ON y.id = l.y_lenh_id
          JOIN phieu_kham_benh pk ON pk.id = y.phieu_kham_id
          JOIN lich_hen lh ON lh.id = pk.lich_hen_id
         WHERE l.thoi_gian::date BETWEEN $1 AND $2 AND lh.khoa_id IS NOT NULL
         GROUP BY lh.khoa_id
      )
      SELECT k.id, k.ten_khoa,
             COALESCE(lich.luot_dat,0)::int AS luot_dat,
             COALESCE(lich.da_kham,0)::int  AS da_kham,
             COALESCE(lich.da_huy,0)::int   AS da_huy,
             COALESCE(dv.tien,0)::int       AS doanh_thu_dich_vu,
             COALESCE(vp.tien,0)::int       AS doanh_thu_vien_phi
        FROM khoa_phong k
        LEFT JOIN lich ON lich.khoa_id = k.id
        LEFT JOIN dv   ON dv.khoa_id   = k.id
        LEFT JOIN vp   ON vp.khoa_id   = k.id
       ORDER BY (COALESCE(dv.tien,0) + COALESCE(vp.tien,0)) DESC, k.ten_khoa ASC`, P);

    const khoa = theoKhoa.map((r: any) => {
      const dvTien = this.so(r.doanh_thu_dich_vu);
      const vpTien = this.so(r.doanh_thu_vien_phi);
      const dat = this.so(r.luot_dat);
      const kham = this.so(r.da_kham);
      return {
        id: r.id, ten_khoa: r.ten_khoa,
        luot_dat: dat, da_kham: kham, da_huy: this.so(r.da_huy),
        ty_le_den_kham: dat ? Math.round((kham / dat) * 100) : 0,
        doanh_thu_dich_vu: dvTien, doanh_thu_vien_phi: vpTien,
        tong_doanh_thu: dvTien + vpTien,
      };
    });

    const dvTong = this.so(tongThu.dich_vu);
    const vpTong = this.so(tongThu.vien_phi);
    const tongDoanhThu = dvTong + vpTong;
    const daPhanBo = khoa.reduce((s: number, k: any) => s + k.tong_doanh_thu, 0);
    const dat = this.so(tongLich.luot_dat);
    const kham = this.so(tongLich.da_kham);

    return {
      ky,
      tu: P[0], den: P[1],
      nhan_ky: this.nhanKy(ky, dau),
      tong: {
        luot_dat: dat, da_kham: kham, da_huy: this.so(tongLich.da_huy),
        dang_cho: this.so(tongLich.dang_cho), so_benh_nhan: this.so(tongLich.so_benh_nhan),
        ty_le_den_kham: dat ? Math.round((kham / dat) * 100) : 0,
        doanh_thu_dich_vu: dvTong, doanh_thu_vien_phi: vpTong, tong_doanh_thu: tongDoanhThu,
        // Khoản thu không quy được về khoa nào (phiếu không gắn lần khám)
        chua_phan_bo: Math.max(tongDoanhThu - daPhanBo, 0),
        vien_phi_con_thieu: this.so(conNo.thieu), so_phieu_y_lenh: this.so(conNo.so_phieu),
      },
      theo_khoa: khoa,
      theo_moc: await this.xuHuong(ky, dau),
    };
  }

  // Các kỳ liền trước (kể cả kỳ đang xem), cũ → mới, cùng khoảng ngày bao trùm.
  private dsMoc(ky: string, dauHienTai: Date) {
    const moc: { bat_dau: Date; nhan: string }[] = [];
    for (let i = SO_MOC[ky] - 1; i >= 0; i--) {
      const d = this.luiKy(ky, dauHienTai, i);
      moc.push({ bat_dau: d, nhan: this.nhanKy(ky, d) });
    }
    return { moc, tu: ymd(moc[0].bat_dau), den: ymd(this.cuoiKy(ky, dauHienTai)) };
  }

  // Kỳ đang xem từ tham số thô — dùng chung cho mọi màn hình của cổng quản lý
  private kyXem(kyRaw: any, mocRaw: any) {
    const ky = String(kyRaw || 'ngay').trim();
    if (!KY_HOP_LE.includes(ky)) throw new BadRequestException('Kỳ báo cáo phải là ngay, tuan hoặc thang');
    const dau = this.dauKy(ky, this.chuanMoc(mocRaw));
    return { ky, dau, tu: ymd(dau), den: ymd(this.cuoiKy(ky, dau)) };
  }

  // ------------------------------------------------------------ THUỐC ĐÃ DÙNG
  // Nguồn: các dòng loai = 'thuoc' của phiếu y lệnh — tức thuốc THỰC CẤP và tính
  // tiền cho người bệnh (đã trừ tồn kho), không phải đơn bác sĩ kê. Ngày tính theo
  // ngày lập phiếu. Một mặt hàng nhận diện bằng mã thuốc, thiếu mã thì theo tên.
  async thuoc(kyRaw: any, mocRaw: any) {
    const { ky, dau, tu, den } = this.kyXem(kyRaw, mocRaw);
    const P = [tu, den];
    const TU_BANG = `
      FROM chi_tiet_y_lenh ct
      JOIN y_lenh y ON y.id = ct.y_lenh_id
      LEFT JOIN phieu_kham_benh pk ON pk.id = y.phieu_kham_id
     WHERE ct.loai = 'thuoc' AND y.ngay_tao::date BETWEEN $1 AND $2`;

    const [tong] = await this.ds.query(`
      SELECT COUNT(*)::int AS so_luot,
             COUNT(DISTINCT COALESCE(NULLIF(ct.ma_vt, ''), lower(ct.ten)))::int AS so_loai,
             COALESCE(SUM(ct.thanh_tien), 0)::bigint AS gia_tri,
             COUNT(DISTINCT pk.ho_so_id)::int AS so_benh_nhan,
             COUNT(DISTINCT y.id)::int AS so_phieu,
             COUNT(DISTINCT y.id) FILTER (WHERE pk.ho_so_id IS NULL)::int AS so_phieu_khong_ro_bn
      ${TU_BANG}`, P);

    const theoThuoc = await this.ds.query(`
      SELECT COALESCE(NULLIF(ct.ma_vt, ''), lower(ct.ten)) AS khoa_thuoc,
             MAX(ct.ma_vt) AS ma, MAX(ct.ten) AS ten, MAX(ct.dvt) AS dvt,
             MAX(th.nhom) AS nhom,
             SUM(ct.so_luong)::float AS so_luong,
             COALESCE(SUM(ct.thanh_tien), 0)::bigint AS gia_tri,
             COUNT(*)::int AS so_luot,
             COUNT(DISTINCT pk.ho_so_id)::int AS so_benh_nhan
        FROM chi_tiet_y_lenh ct
        JOIN y_lenh y ON y.id = ct.y_lenh_id
        LEFT JOIN phieu_kham_benh pk ON pk.id = y.phieu_kham_id
        LEFT JOIN thuoc th ON th.ma_thuoc = ct.ma_vt
       WHERE ct.loai = 'thuoc' AND y.ngay_tao::date BETWEEN $1 AND $2
       GROUP BY 1
       ORDER BY gia_tri DESC, so_luot DESC, ten ASC
       LIMIT 200`, P);

    // Nhóm dược lý lấy từ danh mục thuốc; dòng gõ tay không có mã → "Chưa phân nhóm"
    const theoNhom = await this.ds.query(`
      SELECT COALESCE(th.nhom, 'Chưa phân nhóm') AS nhom,
             COALESCE(SUM(ct.thanh_tien), 0)::bigint AS gia_tri,
             COUNT(*)::int AS so_luot,
             COUNT(DISTINCT COALESCE(NULLIF(ct.ma_vt, ''), lower(ct.ten)))::int AS so_loai
        FROM chi_tiet_y_lenh ct
        JOIN y_lenh y ON y.id = ct.y_lenh_id
        LEFT JOIN thuoc th ON th.ma_thuoc = ct.ma_vt
       WHERE ct.loai = 'thuoc' AND y.ngay_tao::date BETWEEN $1 AND $2
       GROUP BY 1
       ORDER BY gia_tri DESC, so_luot DESC`, P);

    // Quy về khoa theo cùng chuỗi với doanh thu: phiếu y lệnh → phiếu khám → lần khám
    const theoKhoa = await this.ds.query(`
      SELECT k.id, COALESCE(k.ten_khoa, '') AS ten_khoa,
             COALESCE(SUM(ct.thanh_tien), 0)::bigint AS gia_tri,
             COUNT(*)::int AS so_luot
        FROM chi_tiet_y_lenh ct
        JOIN y_lenh y ON y.id = ct.y_lenh_id
        LEFT JOIN phieu_kham_benh pk ON pk.id = y.phieu_kham_id
        LEFT JOIN lich_hen lh ON lh.id = pk.lich_hen_id
        LEFT JOIN khoa_phong k ON k.id = lh.khoa_id
       WHERE ct.loai = 'thuoc' AND y.ngay_tao::date BETWEEN $1 AND $2
       GROUP BY k.id, k.ten_khoa
       ORDER BY gia_tri DESC`, P);

    const chuoi = this.dsMoc(ky, dau);
    const xu = await this.ds.query(`
      SELECT to_char(date_trunc($3, y.ngay_tao::date), 'YYYY-MM-DD') AS moc,
             COALESCE(SUM(ct.thanh_tien), 0)::bigint AS gia_tri,
             COUNT(*)::int AS so_luot
        FROM chi_tiet_y_lenh ct JOIN y_lenh y ON y.id = ct.y_lenh_id
       WHERE ct.loai = 'thuoc' AND y.ngay_tao::date BETWEEN $1 AND $2
       GROUP BY 1`, [chuoi.tu, chuoi.den, TRUNC[ky]]);
    const bangXu = new Map(xu.map((r: any) => [r.moc, r]));

    return {
      ky, tu, den, nhan_ky: this.nhanKy(ky, dau),
      tong: {
        so_luot: this.so(tong.so_luot), so_loai: this.so(tong.so_loai),
        gia_tri: this.so(tong.gia_tri), so_benh_nhan: this.so(tong.so_benh_nhan),
        so_phieu: this.so(tong.so_phieu),
        // Phiếu y lệnh không gắn phiếu khám thì không biết người bệnh là ai
        so_phieu_khong_ro_bn: this.so(tong.so_phieu_khong_ro_bn),
      },
      theo_thuoc: theoThuoc.map((r: any) => ({
        ma: r.ma || null, ten: r.ten, dvt: r.dvt || null, nhom: r.nhom || null,
        so_luong: Number(r.so_luong) || 0, gia_tri: this.so(r.gia_tri),
        so_luot: this.so(r.so_luot), so_benh_nhan: this.so(r.so_benh_nhan),
      })),
      theo_nhom: theoNhom.map((r: any) => ({
        nhom: r.nhom, gia_tri: this.so(r.gia_tri), so_luot: this.so(r.so_luot), so_loai: this.so(r.so_loai),
      })),
      theo_khoa: theoKhoa.map((r: any) => ({
        id: r.id || null,
        ten_khoa: r.id ? r.ten_khoa : 'Chưa quy được về khoa',
        gia_tri: this.so(r.gia_tri), so_luot: this.so(r.so_luot),
      })),
      theo_moc: chuoi.moc.map((m) => {
        const r: any = bangXu.get(ymd(m.bat_dau));
        return { nhan: m.nhan, tu: ymd(m.bat_dau), gia_tri: this.so(r && r.gia_tri), so_luot: this.so(r && r.so_luot) };
      }),
    };
  }

  // Chuỗi các kỳ liền trước (kể cả kỳ đang xem) để nhìn ra xu hướng tăng/giảm.
  private async xuHuong(ky: string, dauHienTai: Date) {
    const { moc, tu, den } = this.dsMoc(ky, dauHienTai);
    // TRUNC[ky] lấy từ bảng hằng sau khi ky đã qua whitelist — vẫn truyền dạng
    // tham số, không nối chuỗi vào câu lệnh.
    const P = [tu, den, TRUNC[ky]];

    // Mốc trả về dạng CHUỖI 'YYYY-MM-DD': kiểu date của PostgreSQL bị driver đổi
    // thành 0h giờ máy, đổi tiếp sang ISO (UTC) sẽ lùi một ngày ở múi giờ +7 và
    // làm lệch khóa ghép — mọi cột xu hướng ra 0.
    const lich = await this.ds.query(`
      SELECT to_char(date_trunc($3, kg.ngay), 'YYYY-MM-DD') AS moc,
             COUNT(*)::int AS luot_dat,
             COUNT(*) FILTER (WHERE lh.trang_thai = 'da_kham')::int AS da_kham
        FROM lich_hen lh JOIN khung_gio kg ON kg.id = lh.khung_gio_id
       WHERE kg.ngay BETWEEN $1 AND $2
       GROUP BY 1`, P);

    const tien = await this.ds.query(`
      SELECT to_char(date_trunc($3, ngay), 'YYYY-MM-DD') AS moc, COALESCE(SUM(tien),0)::bigint AS tien
        FROM (
          SELECT ngay_thanh_toan::date AS ngay, tong_tien AS tien FROM thanh_toan
           WHERE trang_thai = 'da_thanh_toan' AND ngay_thanh_toan::date BETWEEN $1 AND $2
          UNION ALL
          SELECT thoi_gian::date, so_tien FROM lan_thu_tien_y_lenh
           WHERE thoi_gian::date BETWEEN $1 AND $2
        ) x
       GROUP BY 1`, P);

    const bangLich = new Map(lich.map((r: any) => [r.moc, r]));
    const bangTien = new Map(tien.map((r: any) => [r.moc, r]));
    return moc.map((m) => {
      const l: any = bangLich.get(ymd(m.bat_dau));
      const t: any = bangTien.get(ymd(m.bat_dau));
      return {
        nhan: m.nhan, tu: ymd(m.bat_dau),
        luot_dat: this.so(l && l.luot_dat), da_kham: this.so(l && l.da_kham),
        doanh_thu: this.so(t && t.tien),
      };
    });
  }
}

@Controller('api')
export class QuanLyController {
  constructor(private svc: QuanLyService) {}

  // Quản trị viên cũng xem được để đối chiếu với báo cáo trong cổng quản trị
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.QUAN_LY, VaiTro.ADMIN)
  @Get('quan-ly/tong-quan') tongQuan(@Query('ky') ky: string, @Query('moc') moc: string) {
    return this.svc.tongQuan(ky, moc);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.QUAN_LY, VaiTro.ADMIN)
  @Get('quan-ly/thuoc') thuoc(@Query('ky') ky: string, @Query('moc') moc: string) {
    return this.svc.thuoc(ky, moc);
  }
}
