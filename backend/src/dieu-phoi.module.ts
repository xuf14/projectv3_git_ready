import {
  Injectable, Controller, Get, Post, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import {
  DieuPhoiBenhNhan, LichHen, KhoaPhong, BacSi, NguoiDung, PhieuKhamBenh,
  NhatKyHoatDong, TrangThaiLich, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { phamViBacSi } from './pham-vi-bac-si';
import { guiThongBao, idQuanTriVien } from './notification.module';

// ============================================================================
//  ĐIỀU PHỐI BỆNH NHÂN VÀO KHOA PHÒNG — ba điểm kiểm soát:
//    1. LỄ TÂN  tiếp đón (check-in) → phiếu điều phối tự sinh ở trạng thái
//               cho_duyet (appointment.module gọi taoPhieuDieuPhoi trong CÙNG
//               transaction với check-in)
//    2. QUẢN LÝ duyệt khoa tiếp nhận + chỉ định bác sĩ → da_chi_dinh.
//               Từ lúc này người bệnh nằm trong hàng chờ của bác sĩ ĐƯỢC CHỈ ĐỊNH.
//               Quản lý cũng có thể hoãn/từ chối kèm lý do → tu_choi.
//    3. LỄ TÂN  xác nhận đã đưa người bệnh tới phòng → da_chuyen_phong
//
//    GET  /api/dieu-phoi?trang_thai=&ngay=&q=   hàng chờ điều phối
//    GET  /api/dieu-phoi/:id                    chi tiết đầy đủ (popup)
//    POST /api/dieu-phoi/:id/chi-dinh           quản lý duyệt khoa + chỉ định BS
//    POST /api/dieu-phoi/:id/chuyen-phong       lễ tân xác nhận đã tới phòng
//    POST /api/dieu-phoi/:id/tu-choi            quản lý hoãn/từ chối kèm lý do
// ============================================================================

export const TRANG_THAI_DIEU_PHOI = ['cho_duyet', 'da_chi_dinh', 'da_chuyen_phong', 'tu_choi'];
export const NHAN_DIEU_PHOI: Record<string, string> = {
  cho_duyet: 'Chờ quản lý duyệt',
  da_chi_dinh: 'Chờ chuyển phòng',
  da_chuyen_phong: 'Đã tới phòng',
  tu_choi: 'Đã hoãn / từ chối',
};

const cat = (v: any, n: number) => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null; };

// Gọi từ appointment.module ngay sau khi lễ tân check-in, trong cùng transaction.
// Idempotent: check-in lại một lịch đã có phiếu thì không tạo phiếu thứ hai.
export async function taoPhieuDieuPhoi(m: EntityManager, lich: LichHen) {
  const da = await m.findOne(DieuPhoiBenhNhan, { where: { lich_hen: { id: lich.id } } });
  if (da) return da;
  const phieu = await m.save(m.create(DieuPhoiBenhNhan, {
    trang_thai: 'cho_duyet',
    lich_hen: { id: lich.id } as any,
    // Khoa đặt lịch là gợi ý ban đầu; quản lý có quyền đổi sang khoa khác
    khoa: lich.khoa ? ({ id: lich.khoa.id } as any) : null,
  }));
  const quanLy = await m.find(NguoiDung, { where: { vai_tro: VaiTro.QUAN_LY }, select: ['id'] });
  await guiThongBao(m, [...quanLy.map((u) => u.id), ...(await idQuanTriVien(m))], {
    loai: 'dieu_phoi',
    tieu_de: 'Người bệnh đã tiếp đón, chờ phân khoa',
    noi_dung: `${lich.ho_so ? lich.ho_so.ho_ten : 'Người bệnh'}${lich.so_thu_tu ? ` — số thứ tự ${lich.so_thu_tu}` : ''}`,
    lich_hen_id: lich.id,
  });
  return phieu;
}

@Injectable()
export class DieuPhoiService {
  constructor(
    @InjectRepository(DieuPhoiBenhNhan) private dp: Repository<DieuPhoiBenhNhan>,
    private ds: DataSource,
  ) {}

  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  private truyVan() {
    return this.dp.createQueryBuilder('dp')
      .leftJoinAndSelect('dp.lich_hen', 'lh')
      .leftJoinAndSelect('lh.ho_so', 'hs')
      .leftJoinAndSelect('lh.khung_gio', 'kg')
      .leftJoinAndSelect('kg.bac_si', 'kgbs')
      .leftJoinAndSelect('lh.khoa', 'khoadat')
      .leftJoinAndSelect('dp.khoa', 'k')
      .leftJoinAndSelect('dp.bac_si', 'bs')
      .leftJoinAndSelect('bs.khoa', 'bskhoa')
      .leftJoinAndSelect('dp.nguoi_duyet', 'nd')
      .leftJoinAndSelect('dp.nguoi_chuyen_phong', 'ncp');
  }

  // Hàng chờ điều phối. Bác sĩ chỉ thấy người bệnh đã được chỉ định cho mình.
  async danhSach(user: any, q: { trang_thai?: string; ngay?: string; q?: string }) {
    const qb = this.truyVan().orderBy('dp.id', 'DESC').take(200);

    const tt = String(q.trang_thai || 'dang_mo').trim();
    if (tt === 'dang_mo') {
      qb.where('dp.trang_thai IN (:...mo)', { mo: ['cho_duyet', 'da_chi_dinh'] });
    } else if (tt === 'tat_ca') {
      qb.where('1 = 1');
    } else {
      if (!TRANG_THAI_DIEU_PHOI.includes(tt))
        throw new BadRequestException('Trạng thái điều phối không hợp lệ');
      qb.where('dp.trang_thai = :tt', { tt });
    }

    const ngay = String(q.ngay || '').trim();
    if (ngay) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) throw new BadRequestException('Ngày phải có dạng YYYY-MM-DD');
      qb.andWhere('kg.ngay = :ngay', { ngay });
    }
    const tuKhoa = String(q.q || '').trim();
    if (tuKhoa)
      qb.andWhere('(hs.ho_ten ILIKE :tk OR hs.ma_benh_nhan ILIKE :tk OR lh.ma_lich_hen ILIKE :tk)', { tk: `%${tuKhoa}%` });

    const pv = await phamViBacSi(this.ds, user);
    if (!pv.xemTatCa) {
      const bsId = pv.bs ? pv.bs.id : 0;
      if (!bsId) return [];
      qb.andWhere('bs.id = :bsId', { bsId });
    }
    return (await qb.getMany()).map((d) => this.goi(d));
  }

  // Chi tiết đầy đủ cho popup ở cổng quản lý: hồ sơ, lần khám, mốc thời gian,
  // phiếu khám đã lập và danh sách bác sĩ của khoa đang chọn để chỉ định.
  async chiTiet(id: number) {
    const d = await this.truyVan().where('dp.id = :id', { id }).getOne();
    if (!d) throw new NotFoundException('Phiếu điều phối không tồn tại');

    const hoSoId = d.lich_hen && d.lich_hen.ho_so ? d.lich_hen.ho_so.id : 0;
    const [phieuKham, lichKhac] = await Promise.all([
      hoSoId
        ? this.ds.getRepository(PhieuKhamBenh).find({
            where: { ho_so: { id: hoSoId } }, order: { id: 'DESC' }, take: 5,
          })
        : Promise.resolve([]),
      hoSoId
        ? this.ds.getRepository(LichHen).count({
            where: { ho_so: { id: hoSoId }, trang_thai: TrangThaiLich.DA_KHAM },
          })
        : Promise.resolve(0),
    ]);

    return {
      ...this.goi(d),
      so_lan_da_kham: lichKhac,
      phieu_kham_gan_day: phieuKham.map((p) => ({
        id: p.id, ma_kcb: p.ma_kcb, ngay_tao: p.ngay_tao,
        chan_doan_so_bo: p.chan_doan_so_bo, chuyen_khoa: p.chuyen_khoa,
      })),
    };
  }

  // Danh sách bác sĩ của một khoa để quản lý chọn khi chỉ định
  async bacSiTheoKhoa(khoaId: number) {
    if (!khoaId) throw new BadRequestException('Cần chọn khoa');
    const list = await this.ds.getRepository(BacSi).find({
      where: { khoa: { id: khoaId } }, order: { ho_ten: 'ASC' },
    });
    return list.map((b) => ({
      id: b.id, ho_ten: b.ho_ten, hoc_ham: b.hoc_ham, chuyen_mon: b.chuyen_mon,
      khoa: b.khoa ? b.khoa.ten_khoa : null,
    }));
  }

  // ------------------------------------------------- QUẢN LÝ DUYỆT + CHỈ ĐỊNH
  async chiDinh(userId: number, id: number, dto: any) {
    const khoaId = +dto?.khoa_id;
    if (!khoaId) throw new BadRequestException('Chọn khoa tiếp nhận người bệnh');
    const bacSiId = +dto?.bac_si_id;
    if (!bacSiId) throw new BadRequestException('Chọn bác sĩ phụ trách');
    const ghiChu = cat(dto?.ghi_chu, 1000);

    await this.ds.transaction(async (m) => {
      const d = await m.findOne(DieuPhoiBenhNhan, {
        where: { id }, relations: ['lich_hen', 'lich_hen.ho_so'],
      });
      if (!d) throw new NotFoundException('Phiếu điều phối không tồn tại');
      if (d.trang_thai === 'da_chuyen_phong')
        throw new ConflictException('Người bệnh đã được chuyển tới phòng, không đổi chỉ định được nữa');

      const khoa = await m.findOne(KhoaPhong, { where: { id: khoaId } });
      if (!khoa) throw new NotFoundException('Khoa tiếp nhận không tồn tại');
      const bacSi = await m.findOne(BacSi, { where: { id: bacSiId }, relations: ['khoa', 'nguoi_dung'] });
      if (!bacSi) throw new NotFoundException('Bác sĩ được chọn không tồn tại');
      // Chốt ở máy chủ: bác sĩ phải thuộc đúng khoa vừa duyệt, không để giao diện
      // gửi lên một cặp khoa/bác sĩ không khớp nhau.
      if (!bacSi.khoa || bacSi.khoa.id !== khoa.id)
        throw new BadRequestException(`Bác sĩ ${bacSi.ho_ten} không thuộc ${khoa.ten_khoa}`);

      d.trang_thai = 'da_chi_dinh';
      d.khoa = { id: khoa.id } as any;
      d.bac_si = { id: bacSi.id } as any;
      d.ghi_chu = ghiChu;
      d.ly_do_tu_choi = null;
      d.thoi_gian_chi_dinh = new Date();
      d.nguoi_duyet = { id: userId } as any;
      await m.save(d);

      // Khoa của lần khám đi theo quyết định của quản lý để báo cáo theo khoa đúng
      if (d.lich_hen)
        await m.update(LichHen, { id: d.lich_hen.id }, { khoa: { id: khoa.id } as any });

      const tenBn = d.lich_hen && d.lich_hen.ho_so ? d.lich_hen.ho_so.ho_ten : 'Người bệnh';
      const leTan = await m.find(NguoiDung, { where: { vai_tro: VaiTro.LE_TAN }, select: ['id'] });
      const taiKhoanBs = bacSi.nguoi_dung ? [bacSi.nguoi_dung.id] : [];
      await guiThongBao(m, [...leTan.map((u) => u.id), ...taiKhoanBs], {
        loai: 'dieu_phoi',
        tieu_de: `Đã phân ${khoa.ten_khoa} — chờ chuyển phòng`,
        noi_dung: `${tenBn} → ${bacSi.ho_ten}${ghiChu ? `. ${ghiChu}` : ''}`,
        lich_hen_id: d.lich_hen ? d.lich_hen.id : undefined,
      });
      await this.ghiNhatKy(m, userId, 'chi_dinh_dieu_phoi',
        `Phân ${tenBn} vào ${khoa.ten_khoa}, chỉ định ${bacSi.ho_ten}`);
    });
    return this.chiTiet(id);
  }

  // ------------------------------------------------- LỄ TÂN XÁC NHẬN TỚI PHÒNG
  async chuyenPhong(userId: number, id: number, dto: any) {
    const phong = cat(dto?.phong, 100);
    if (!phong) throw new BadRequestException('Ghi rõ phòng đã đưa người bệnh tới');

    await this.ds.transaction(async (m) => {
      const d = await m.findOne(DieuPhoiBenhNhan, {
        where: { id },
        relations: ['lich_hen', 'lich_hen.ho_so', 'khoa', 'bac_si', 'bac_si.nguoi_dung', 'nguoi_duyet'],
      });
      if (!d) throw new NotFoundException('Phiếu điều phối không tồn tại');
      if (d.trang_thai === 'cho_duyet')
        throw new ConflictException('Quản lý chưa phân khoa và chỉ định bác sĩ cho người bệnh này');
      if (d.trang_thai === 'tu_choi')
        throw new ConflictException('Phiếu đã bị hoãn/từ chối, không chuyển phòng được');
      if (d.trang_thai === 'da_chuyen_phong')
        throw new ConflictException('Người bệnh đã được xác nhận tới phòng rồi');

      d.trang_thai = 'da_chuyen_phong';
      d.phong = phong;
      d.thoi_gian_chuyen_phong = new Date();
      d.nguoi_chuyen_phong = { id: userId } as any;
      await m.save(d);

      const tenBn = d.lich_hen && d.lich_hen.ho_so ? d.lich_hen.ho_so.ho_ten : 'Người bệnh';
      const nhan = [
        ...(d.bac_si && d.bac_si.nguoi_dung ? [d.bac_si.nguoi_dung.id] : []),
        ...(d.nguoi_duyet ? [d.nguoi_duyet.id] : []),
      ];
      await guiThongBao(m, nhan, {
        loai: 'dieu_phoi',
        tieu_de: `${tenBn} đã tới ${phong}`,
        noi_dung: `${d.khoa ? d.khoa.ten_khoa : ''}${d.bac_si ? ` · ${d.bac_si.ho_ten}` : ''}`,
        lich_hen_id: d.lich_hen ? d.lich_hen.id : undefined,
      });
      await this.ghiNhatKy(m, userId, 'chuyen_phong_dieu_phoi',
        `Xác nhận đã đưa ${tenBn} tới ${phong}`);
    });
    return this.chiTiet(id);
  }

  // ------------------------------------------------- QUẢN LÝ HOÃN / TỪ CHỐI
  async tuChoi(userId: number, id: number, dto: any) {
    const lyDo = cat(dto?.ly_do_tu_choi, 1000);
    if (!lyDo) throw new BadRequestException('Phải ghi rõ lý do hoãn hoặc từ chối');

    await this.ds.transaction(async (m) => {
      const d = await m.findOne(DieuPhoiBenhNhan, {
        where: { id }, relations: ['lich_hen', 'lich_hen.ho_so'],
      });
      if (!d) throw new NotFoundException('Phiếu điều phối không tồn tại');
      if (d.trang_thai === 'da_chuyen_phong')
        throw new ConflictException('Người bệnh đã tới phòng, không hoãn được nữa');

      d.trang_thai = 'tu_choi';
      d.ly_do_tu_choi = lyDo;
      d.thoi_gian_chi_dinh = new Date();
      d.nguoi_duyet = { id: userId } as any;
      await m.save(d);

      const tenBn = d.lich_hen && d.lich_hen.ho_so ? d.lich_hen.ho_so.ho_ten : 'Người bệnh';
      const leTan = await m.find(NguoiDung, { where: { vai_tro: VaiTro.LE_TAN }, select: ['id'] });
      await guiThongBao(m, leTan.map((u) => u.id), {
        loai: 'dieu_phoi',
        tieu_de: `Hoãn phân khoa — ${tenBn}`,
        noi_dung: lyDo,
        lich_hen_id: d.lich_hen ? d.lich_hen.id : undefined,
      });
      await this.ghiNhatKy(m, userId, 'tu_choi_dieu_phoi', `Hoãn điều phối ${tenBn}: ${lyDo}`);
    });
    return this.chiTiet(id);
  }

  private goi(d: DieuPhoiBenhNhan) {
    const lh = d.lich_hen;
    const hs = lh ? lh.ho_so : null;
    const kg = lh ? lh.khung_gio : null;
    return {
      id: d.id, trang_thai: d.trang_thai,
      nhan_trang_thai: NHAN_DIEU_PHOI[d.trang_thai] || d.trang_thai,
      phong: d.phong, ghi_chu: d.ghi_chu, ly_do_tu_choi: d.ly_do_tu_choi,
      thoi_gian_tiep_don: d.thoi_gian_tiep_don,
      thoi_gian_chi_dinh: d.thoi_gian_chi_dinh,
      thoi_gian_chuyen_phong: d.thoi_gian_chuyen_phong,
      lich_hen: lh
        ? {
            id: lh.id, ma_lich_hen: lh.ma_lich_hen, trang_thai: lh.trang_thai,
            so_thu_tu: lh.so_thu_tu,
            ngay: kg ? kg.ngay : null, gio: kg ? kg.gio_bat_dau : null,
            bac_si_dat_lich: kg && kg.bac_si ? kg.bac_si.ho_ten : null,
            khoa_dat_lich: lh.khoa ? lh.khoa.ten_khoa : null,
          }
        : null,
      benh_nhan: hs
        ? {
            id: hs.id, ma_benh_nhan: hs.ma_benh_nhan, ho_ten: hs.ho_ten,
            ngay_sinh: hs.ngay_sinh, gioi_tinh: hs.gioi_tinh, sdt: hs.sdt,
            dia_chi: hs.dia_chi, so_bhyt: hs.so_bhyt,
          }
        : null,
      khoa: d.khoa ? { id: d.khoa.id, ten_khoa: d.khoa.ten_khoa } : null,
      bac_si: d.bac_si
        ? {
            id: d.bac_si.id, ho_ten: d.bac_si.ho_ten, hoc_ham: d.bac_si.hoc_ham,
            chuyen_mon: d.bac_si.chuyen_mon,
            khoa: d.bac_si.khoa ? d.bac_si.khoa.ten_khoa : null,
          }
        : null,
      nguoi_duyet: d.nguoi_duyet ? { id: d.nguoi_duyet.id, ho_ten: d.nguoi_duyet.ho_ten } : null,
      nguoi_chuyen_phong: d.nguoi_chuyen_phong
        ? { id: d.nguoi_chuyen_phong.id, ho_ten: d.nguoi_chuyen_phong.ho_ten }
        : null,
    };
  }
}

@Controller('api')
export class DieuPhoiController {
  constructor(private svc: DieuPhoiService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.QUAN_LY, VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('dieu-phoi') ds(
    @Request() r, @Query('trang_thai') tt: string,
    @Query('ngay') ngay: string, @Query('q') q: string,
  ) {
    return this.svc.danhSach(r.user, { trang_thai: tt, ngay, q });
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.QUAN_LY, VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('dieu-phoi/bac-si') bacSi(@Query('khoa_id') khoaId: string) {
    return this.svc.bacSiTheoKhoa(+khoaId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.QUAN_LY, VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('dieu-phoi/:id') ct(@Param('id') id: string) { return this.svc.chiTiet(+id); }

  // Duyệt khoa + chỉ định bác sĩ là quyền của quản lý
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.QUAN_LY, VaiTro.ADMIN)
  @Post('dieu-phoi/:id/chi-dinh') chiDinh(@Request() r, @Param('id') id: string, @Body() b) {
    return this.svc.chiDinh(r.user.id, +id, b);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.QUAN_LY, VaiTro.ADMIN)
  @Post('dieu-phoi/:id/tu-choi') tuChoi(@Request() r, @Param('id') id: string, @Body() b) {
    return this.svc.tuChoi(r.user.id, +id, b);
  }

  // Đưa người bệnh tới phòng là việc của lễ tân
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('dieu-phoi/:id/chuyen-phong') chuyenPhong(@Request() r, @Param('id') id: string, @Body() b) {
    return this.svc.chuyenPhong(r.user.id, +id, b);
  }
}
