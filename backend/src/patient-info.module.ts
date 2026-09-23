import {
  Injectable, Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, ILike, In, MoreThanOrEqual } from 'typeorm';
import {
  PhieuKhamBenh, HoSoBenhNhan, LichHen, BacSi, LuotKham, KetLuanKham, ChiDinhCLS,
  TaiLieuBenhAn, NhatKyHoatDong, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { chuanHoaHoSo } from './profile.module';

// Các trường văn bản được phép ghi từ phiếu — mọi trường khác trong body bị bỏ qua.
const TEXT_FIELDS = [
  'ma_kcb', 'so_benh_an', 'ten_bn', 'gioi_tinh', 'tuoi', 'dan_toc', 'dia_chi', 'nghe_nghiep',
  'doi_tuong', 'so_the', 'ky_hieu', 'ty_le_the', 'dia_chi_the', 'noi_dk_kcb', 'noi_cap',
  'buong', 'giuong', 'bs_kham', 'chuyen_khoa', 'cdtt', 'ghi_chu', 'trieu_chung',
  'chan_doan_so_bo', 'ghi_chu_kb', 'ket_luan', 'huyet_ap', 'mach', 'nhiet_do', 'nhip_tho',
  'chieu_cao', 'can_nang', 'bmi', 'spo2', 'vong_2', 'ten_benh', 'ma_icd', 'dien_giai',
] as const;
const DATE_FIELDS = ['ngay_dk', 'ngay_sinh', 'han_the', 'ngay_vao', 'ngay_kham'] as const;
const BOOL_FIELDS = [
  'noi_tru', 'dtnt', 'dkrv', 'ttrv', 'chuyen_vien', 'cap_cuu', 'kham_lai', 'nho_kham', 'hoan_kham',
] as const;

@Injectable()
export class PatientInfoService {
  constructor(
    @InjectRepository(PhieuKhamBenh) private phieu: Repository<PhieuKhamBenh>,
    @InjectRepository(HoSoBenhNhan) private hoSo: Repository<HoSoBenhNhan>,
    @InjectRepository(LichHen) private lichHen: Repository<LichHen>,
    private ds: DataSource,
  ) {}

  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  // Lọc, chuẩn hóa và kiểm tra dữ liệu phiếu tại biên tin cậy (không tin body trực tiếp).
  private chuanHoa(dto: any) {
    const out: Record<string, string | boolean | null> = {};
    for (const k of TEXT_FIELDS) {
      if (dto[k] === undefined) continue;
      const v = dto[k] === null ? '' : String(dto[k]).trim();
      if (v.length > 2000) throw new BadRequestException(`Trường ${k} quá dài`);
      out[k] = v || null;
    }
    for (const k of DATE_FIELDS) {
      if (dto[k] === undefined || dto[k] === null || dto[k] === '') { out[k] = null; continue; }
      const v = String(dto[k]).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime()))
        throw new BadRequestException(`Ngày không hợp lệ ở trường ${k} (định dạng YYYY-MM-DD)`);
      out[k] = v;
    }
    for (const k of BOOL_FIELDS) {
      if (dto[k] === undefined) continue;
      out[k] = dto[k] === true || dto[k] === 'true' || dto[k] === 1 || dto[k] === '1';
    }
    const ten = out.ten_bn;
    if (typeof ten !== 'string' || !ten) throw new BadRequestException('Tên bệnh nhân là bắt buộc');
    if (ten.length > 100) throw new BadRequestException('Tên bệnh nhân quá dài');
    return out;
  }

  // Tra cứu hồ sơ có sẵn để điền nhanh phiếu (theo mã bệnh nhân hoặc SĐT).
  async traCuuBenhNhan(ma: string) {
    const q = (ma || '').trim();
    if (!q) throw new BadRequestException('Cần mã bệnh nhân hoặc số điện thoại để tra cứu');
    const hs = await this.hoSo.findOne({
      where: [{ ma_benh_nhan: ILike(q) }, { sdt: q }],
      order: { id: 'DESC' },
    });
    if (!hs) throw new NotFoundException(`Không tìm thấy bệnh nhân với "${q}"`);
    return {
      ho_so_id: hs.id, ma_benh_nhan: hs.ma_benh_nhan, ten_bn: hs.ho_ten,
      gioi_tinh: hs.gioi_tinh || '', ngay_sinh: hs.ngay_sinh || '',
      dia_chi: hs.dia_chi || '', so_the: hs.so_bhyt || '',
    };
  }

  // Lễ tân tiếp nhận bệnh nhân mới đến (chưa có tài khoản) — tạo hồ sơ trực tiếp.
  // Chặn trùng SĐT trừ khi lễ tân xác nhận cho_phep_trung (VD: người thân dùng chung số).
  async tiepNhanBenhNhanMoi(userId: number, dto: any) {
    const data = chuanHoaHoSo(dto, false);
    if (data.sdt && dto.cho_phep_trung !== true) {
      const trung = await this.hoSo.find({ where: { sdt: data.sdt as string }, take: 5 });
      if (trung.length)
        throw new BadRequestException(
          `SĐT này đã có hồ sơ: ${trung.map((h) => `${h.ma_benh_nhan} (${h.ho_ten})`).join(', ')}. ` +
          'Hãy tra cứu hồ sơ cũ hoặc xác nhận tạo mới.');
    }
    // Bác sĩ mong muốn khám (tùy chọn) — chỉ nhận id có thật trong danh sách bác sĩ
    let bacSiMongMuon: BacSi | null = null;
    if (dto.bac_si_mong_muon_id !== undefined && dto.bac_si_mong_muon_id !== null && dto.bac_si_mong_muon_id !== '') {
      const bsId = Number(dto.bac_si_mong_muon_id);
      if (!Number.isInteger(bsId) || bsId <= 0) throw new BadRequestException('Bác sĩ mong muốn không hợp lệ');
      bacSiMongMuon = await this.ds.getRepository(BacSi).findOne({ where: { id: bsId } });
      if (!bacSiMongMuon) throw new BadRequestException('Bác sĩ mong muốn không tồn tại');
    }
    return this.ds.transaction(async (m) => {
      const hs = await m.save(m.create(HoSoBenhNhan, {
        ...data,
        ma_benh_nhan: 'BN' + Date.now().toString().slice(-8),
        bac_si_mong_muon: bacSiMongMuon,
      }));
      await this.ghiNhatKy(m, userId, 'tiep_nhan_benh_nhan',
        `Tiếp nhận bệnh nhân mới ${hs.ma_benh_nhan} (${hs.ho_ten})` +
        (bacSiMongMuon ? ` — mong muốn khám ${bacSiMongMuon.ho_ten}` : ''));
      return hs;
    });
  }

  // Lễ tân note ngày tái khám cho một hồ sơ (kèm bác sĩ sẽ khám lại + ghi chú
  // chuẩn bị). Gửi ngay_tai_kham rỗng để xóa hẹn.
  async datTaiKham(userId: number, hoSoId: number, dto: any) {
    const hs = await this.hoSo.findOne({ where: { id: hoSoId } });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
    const ngay = (dto.ngay_tai_kham ?? '').toString().trim();
    let bsTaiKham: BacSi | null = null;
    if (!ngay) {
      hs.ngay_tai_kham = null as any; hs.ghi_chu_tai_kham = null as any; hs.bac_si_tai_kham = null as any;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || isNaN(new Date(ngay).getTime()))
        throw new BadRequestException('Ngày tái khám không hợp lệ (định dạng YYYY-MM-DD)');
      if (dto.bac_si_tai_kham_id !== undefined && dto.bac_si_tai_kham_id !== null && dto.bac_si_tai_kham_id !== '') {
        const bsId = Number(dto.bac_si_tai_kham_id);
        if (!Number.isInteger(bsId) || bsId <= 0) throw new BadRequestException('Bác sĩ tái khám không hợp lệ');
        bsTaiKham = await this.ds.getRepository(BacSi).findOne({ where: { id: bsId } });
        if (!bsTaiKham) throw new BadRequestException('Bác sĩ tái khám không tồn tại');
      }
      const ghiChu = (dto.ghi_chu_tai_kham ?? '').toString().trim();
      if (ghiChu.length > 1000) throw new BadRequestException('Ghi chú tái khám quá dài');
      hs.ngay_tai_kham = ngay; hs.ghi_chu_tai_kham = (ghiChu || null) as any; hs.bac_si_tai_kham = bsTaiKham as any;
    }
    return this.ds.transaction(async (m) => {
      const saved = await m.save(hs);
      await this.ghiNhatKy(m, userId, 'hen_tai_kham',
        ngay
          ? `Hẹn tái khám ${hs.ma_benh_nhan} (${hs.ho_ten}) ngày ${ngay}` + (bsTaiKham ? ` với ${bsTaiKham.ho_ten}` : '')
          : `Xóa hẹn tái khám của ${hs.ma_benh_nhan} (${hs.ho_ten})`);
      return saved;
    });
  }

  // Tổng hợp mọi dữ liệu phục vụ tái khám của một hồ sơ: theo từng lần khám cũ —
  // kết luận + toa thuốc, sổ khám (lượt khám/đơn thuốc), kết quả cận lâm sàng
  // (xét nghiệm, siêu âm, X-quang) và tài liệu bệnh án đã tải lên (phim, giấy ra viện).
  async thongTinTaiKham(hoSoId: number) {
    const hs = await this.hoSo.findOne({
      where: { id: hoSoId },
      relations: ['bac_si_mong_muon', 'bac_si_mong_muon.khoa', 'bac_si_tai_kham', 'bac_si_tai_kham.khoa'],
    });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
    const lichs = await this.lichHen.find({ where: { ho_so: { id: hoSoId } }, order: { id: 'DESC' } });
    const ids = lichs.map((l) => l.id);
    const [luots, ketLuans, clss, taiLieus] = ids.length
      ? await Promise.all([
          this.ds.getRepository(LuotKham).find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen', 'don_thuoc'] }),
          this.ds.getRepository(KetLuanKham).find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen', 'bac_si'] }),
          this.ds.getRepository(ChiDinhCLS).find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen'], order: { id: 'ASC' } }),
          // Chỉ metadata — tuyệt đối không nạp cột bytea du_lieu
          this.ds.getRepository(TaiLieuBenhAn).find({
            where: { lich_hen: { id: In(ids) } },
            select: ['id', 'ten_tep', 'loai_tep', 'kich_thuoc', 'thoi_gian'],
            relations: ['lich_hen'], order: { thoi_gian: 'DESC' },
          }),
        ])
      : [[], [], [], []];

    const cua = <T extends { lich_hen: LichHen }>(arr: T[], lichId: number) =>
      arr.filter((x) => x.lich_hen && x.lich_hen.id === lichId);

    return {
      ho_so: hs,
      lan_kham: lichs.map((l) => {
        const luot = luots.find((x) => x.lich_hen && x.lich_hen.id === l.id);
        const kl = ketLuans.find((x) => x.lich_hen && x.lich_hen.id === l.id);
        return {
          lich_hen_id: l.id, ma_lich_hen: l.ma_lich_hen, trang_thai: l.trang_thai,
          ngay: l.khung_gio ? l.khung_gio.ngay : null,
          gio: l.khung_gio ? l.khung_gio.gio_bat_dau : null,
          bac_si: l.khung_gio && l.khung_gio.bac_si ? l.khung_gio.bac_si.ho_ten : null,
          khoa: l.khoa ? l.khoa.ten_khoa : null,
          ket_luan: kl ? {
            chan_doan_chinh: kl.chan_doan_chinh, ma_icd: kl.ma_icd, huong_xu_tri: kl.huong_xu_tri,
            don_thuoc: kl.don_thuoc, loi_dan: kl.loi_dan, ngay_tai_kham: kl.ngay_tai_kham,
            bac_si: kl.bac_si ? kl.bac_si.ho_ten : null,
          } : null,
          so_kham: luot ? {
            chan_doan: luot.chan_doan, chi_dinh: luot.chi_dinh, ghi_chu: luot.ghi_chu,
            don_thuoc: luot.don_thuoc ? {
              danh_sach_thuoc: luot.don_thuoc.danh_sach_thuoc,
              lieu_dung: luot.don_thuoc.lieu_dung, ghi_chu: luot.don_thuoc.ghi_chu,
            } : null,
          } : null,
          can_lam_sang: cua(clss, l.id).map((c) => ({
            id: c.id, loai: c.loai, ten_chi_dinh: c.ten_chi_dinh, trang_thai: c.trang_thai,
            ket_qua: c.ket_qua, ket_luan: c.ket_luan, ngay_ket_qua: c.ngay_ket_qua,
          })),
          tai_lieu: cua(taiLieus, l.id).map((t) => ({
            id: t.id, ten_tep: t.ten_tep, loai_tep: t.loai_tep, kich_thuoc: t.kich_thuoc, thoi_gian: t.thoi_gian,
          })),
        };
      }),
    };
  }

  // Bác sĩ đăng nhập xem danh sách bệnh nhân được hẹn tái khám với mình (từ hôm nay)
  async taiKhamCuaBacSi(userId: number) {
    const bs = await this.ds.getRepository(BacSi).findOne({ where: { nguoi_dung: { id: userId } } });
    if (!bs) return [];
    const homNay = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD giờ địa phương
    const list = await this.hoSo.find({
      where: { bac_si_tai_kham: { id: bs.id }, ngay_tai_kham: MoreThanOrEqual(homNay) },
      order: { ngay_tai_kham: 'ASC' },
    });
    return list.map((h) => ({
      ho_so_id: h.id, ma_benh_nhan: h.ma_benh_nhan, ho_ten: h.ho_ten, sdt: h.sdt,
      ngay_tai_kham: h.ngay_tai_kham, ghi_chu_tai_kham: h.ghi_chu_tai_kham,
    }));
  }

  async tao(userId: number, dto: any) {
    const data = this.chuanHoa(dto);
    return this.ds.transaction(async (m) => {
      const phieu = m.create(PhieuKhamBenh, { ...data, nguoi_tao: { id: userId } as any });
      // Liên kết tùy chọn tới hồ sơ / lịch hẹn đã có, chỉ khi tồn tại thật.
      if (dto.ho_so_id) {
        const hs = await m.findOne(HoSoBenhNhan, { where: { id: +dto.ho_so_id } });
        if (hs) phieu.ho_so = hs;
      }
      if (dto.lich_hen_id) {
        const lh = await m.findOne(LichHen, { where: { id: +dto.lich_hen_id } });
        if (lh) { phieu.lich_hen = lh; if (!phieu.ho_so && lh.ho_so) phieu.ho_so = lh.ho_so; }
      }
      const saved = await m.save(phieu);
      await this.ghiNhatKy(m, userId, 'tao_phieu_kham',
        `Tạo phiếu khám bệnh #${saved.id} (${saved.ten_bn})`);
      return this.goi(saved);
    });
  }

  async danhSach() {
    const list = await this.phieu.find({
      relations: ['nguoi_tao', 'ho_so'], order: { id: 'DESC' }, take: 100,
    });
    return list.map((p) => ({
      id: p.id, ten_bn: p.ten_bn, ma_kcb: p.ma_kcb, so_benh_an: p.so_benh_an,
      chuyen_khoa: p.chuyen_khoa, chan_doan_so_bo: p.chan_doan_so_bo, ngay_tao: p.ngay_tao,
      ma_benh_nhan: p.ho_so ? p.ho_so.ma_benh_nhan : null,
      nguoi_tao: p.nguoi_tao ? p.nguoi_tao.ho_ten : null,
    }));
  }

  async chiTiet(id: number) {
    const p = await this.phieu.findOne({ where: { id }, relations: ['nguoi_tao', 'ho_so', 'lich_hen'] });
    if (!p) throw new NotFoundException('Phiếu khám không tồn tại');
    return this.goi(p);
  }

  private goi(p: PhieuKhamBenh) {
    const { nguoi_tao, ho_so, lich_hen, ...fields } = p;
    return {
      ...fields,
      ma_benh_nhan: ho_so ? ho_so.ma_benh_nhan : null,
      ma_lich_hen: lich_hen ? lich_hen.ma_lich_hen : null,
      nguoi_tao: nguoi_tao ? { id: nguoi_tao.id, ho_ten: nguoi_tao.ho_ten } : null,
    };
  }
}

@Controller('api')
export class PatientInfoController {
  constructor(private svc: PatientInfoService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/patient-lookup') traCuu(@Query('ma') ma: string) { return this.svc.traCuuBenhNhan(ma); }

  // Bác sĩ cũng đọc được để chọn bệnh nhân khi ghi phiếu điều trị
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('reception/exam-sheets') danhSach() { return this.svc.danhSach(); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('reception/exam-sheets/:id') chiTiet(@Param('id') id: string) { return this.svc.chiTiet(+id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/exam-sheets') tao(@Request() r, @Body() b) { return this.svc.tao(r.user.id, b); }

  // Tiếp nhận bệnh nhân mới đến trực tiếp (walk-in, không qua tài khoản bệnh nhân)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/patients') tiepNhan(@Request() r, @Body() b) { return this.svc.tiepNhanBenhNhanMoi(r.user.id, b); }

  // Lễ tân note / xóa hẹn tái khám của một hồ sơ
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Patch('reception/patients/:id/revisit') taiKham(@Request() r, @Param('id') id, @Body() b) { return this.svc.datTaiKham(r.user.id, +id, b); }

  // Thông tin phục vụ tái khám (toa thuốc cũ, kết quả CLS, tài liệu bệnh án)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('patients/:id/revisit-info') thongTin(@Param('id') id) { return this.svc.thongTinTaiKham(+id); }

  // Icon thông báo ở cổng bác sĩ: bệnh nhân hẹn tái khám với bác sĩ đang đăng nhập
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('doctor/revisits') taiKhamBacSi(@Request() r) { return this.svc.taiKhamCuaBacSi(r.user.id); }
}
