import {
  Injectable, Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException, StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  LichHen, KhungGio, HoSoBenhNhan, LuotKham, DonThuoc, BacSi, TrangThaiLich, TrangThaiKham, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

@Injectable()
export class ApptService {
  constructor(
    @InjectRepository(LichHen) private lich: Repository<LichHen>,
    @InjectRepository(KhungGio) private slot: Repository<KhungGio>,
    @InjectRepository(HoSoBenhNhan) private hoSo: Repository<HoSoBenhNhan>,
    @InjectRepository(LuotKham) private luot: Repository<LuotKham>,
    @InjectRepository(DonThuoc) private don: Repository<DonThuoc>,
    private ds: DataSource,
  ) {}

  // ----- Đặt lịch (giao dịch để tránh đặt trùng quá slot) -----
  async datLich(userId: number, dto: any) {
    // Bắt buộc id hợp lệ: id null/undefined khiến TypeORM bỏ qua điều kiện
    // và trả về khung giờ ĐẦU TIÊN trong bảng (đặt nhầm lịch cho bác sĩ khác).
    const khungGioId = Number(dto?.khung_gio_id);
    if (!Number.isInteger(khungGioId) || khungGioId <= 0)
      throw new BadRequestException('Thiếu hoặc sai khung giờ (khung_gio_id)');
    return this.ds.transaction(async (m) => {
      const slot = await m.findOne(KhungGio, { where: { id: khungGioId }, relations: ['bac_si', 'bac_si.khoa'] });
      if (!slot) throw new NotFoundException('Khung giờ không tồn tại');
      if (slot.da_dat >= slot.so_luong) throw new BadRequestException('Khung giờ đã hết chỗ');

      // Chỉ dùng hồ sơ thuộc chính người đang đặt lịch.
      // Lưu ý: không được truyền id undefined vào findOne — TypeORM sẽ bỏ qua
      // điều kiện và trả về bản ghi đầu tiên (gắn lịch vào bệnh nhân khác).
      let hoSo = dto.ho_so_id
        ? await m.findOne(HoSoBenhNhan, { where: { id: dto.ho_so_id, nguoi_dung: { id: userId } } })
        : await m.findOne(HoSoBenhNhan, { where: { nguoi_dung: { id: userId } } });
      if (dto.ho_so_id && !hoSo) throw new NotFoundException('Hồ sơ không tồn tại hoặc không thuộc tài khoản này');
      if (!hoSo) {
        // tự tạo hồ sơ nhanh từ thông tin gửi lên
        hoSo = await m.save(m.create(HoSoBenhNhan, {
          ma_benh_nhan: 'BN' + Date.now().toString().slice(-8),
          ho_ten: dto.ho_ten, sdt: dto.sdt, so_bhyt: dto.so_bhyt,
          nguoi_dung: { id: userId } as any,
        }));
      }

      slot.da_dat += 1;
      await m.save(slot);

      const ma = 'BV' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const lich = await m.save(m.create(LichHen, {
        ma_lich_hen: ma, ho_so: hoSo, khung_gio: slot, khoa: slot.bac_si.khoa,
        trang_thai: TrangThaiLich.CHO_XAC_NHAN, so_thu_tu: slot.da_dat,
      }));
      return { ma_lich_hen: ma, so_thu_tu: lich.so_thu_tu, trang_thai: lich.trang_thai, id: lich.id };
    });
  }

  async lichCuaToi(userId: number) {
    return this.lich.find({
      where: { ho_so: { nguoi_dung: { id: userId } } },
      order: { ngay_tao: 'DESC' },
    });
  }

  async huyLich(userId: number, id: number) {
    const lich = await this.lich.findOne({ where: { id }, relations: ['khung_gio', 'ho_so', 'ho_so.nguoi_dung'] });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.ho_so.nguoi_dung?.id !== userId) throw new BadRequestException('Không thể hủy lịch của người khác');
    lich.trang_thai = TrangThaiLich.DA_HUY;
    await this.lich.save(lich);
    const slot = lich.khung_gio;
    if (slot.da_dat > 0) { slot.da_dat -= 1; await this.slot.save(slot); }
    return { message: 'Đã hủy lịch hẹn', ma_lich_hen: lich.ma_lich_hen };
  }

  // Xóa hẳn lịch hẹn khỏi database — chỉ cho phép với lịch đã hủy của chính mình
  async xoaLich(userId: number, id: number) {
    const lich = await this.lich.findOne({ where: { id }, relations: ['ho_so', 'ho_so.nguoi_dung'] });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.ho_so.nguoi_dung?.id !== userId) throw new BadRequestException('Không thể xóa lịch của người khác');
    if (lich.trang_thai !== TrangThaiLich.DA_HUY) throw new BadRequestException('Chỉ xóa được lịch hẹn đã hủy');
    await this.lich.delete(id);
    return { message: 'Đã xóa lịch hẹn', ma_lich_hen: lich.ma_lich_hen };
  }

  // ----- Tiếp đón: tra cứu + check-in -----
  traCuu(ma: string) {
    return this.lich.findOne({ where: { ma_lich_hen: ma } });
  }

  // Toàn bộ lịch hẹn cho lễ tân (không giới hạn hôm nay). Lọc theo trạng thái
  // và tìm theo tên/mã BN/mã lịch. Sắp theo ngày khám mới nhất.
  async tatCaLichHen(trangThai?: string, q?: string) {
    const qb = this.lich.createQueryBuilder('lh')
      .leftJoinAndSelect('lh.ho_so', 'hs')
      .leftJoinAndSelect('lh.khung_gio', 'kg')
      .leftJoinAndSelect('kg.bac_si', 'bs')
      .leftJoinAndSelect('lh.khoa', 'k')
      .orderBy('kg.ngay', 'DESC')
      .addOrderBy('kg.gio_bat_dau', 'ASC')
      .take(200);
    const TT = Object.values(TrangThaiLich) as string[];
    if (trangThai && TT.includes(trangThai)) qb.andWhere('lh.trang_thai = :tt', { tt: trangThai });
    if (q && q.trim())
      qb.andWhere('(hs.ho_ten ILIKE :q OR hs.ma_benh_nhan ILIKE :q OR lh.ma_lich_hen ILIKE :q)', { q: `%${q.trim()}%` });
    return qb.getMany();
  }

  // Lễ tân xác nhận lịch hẹn: chờ xác nhận → đã xác nhận
  async xacNhanLich(id: number) {
    const lich = await this.lich.findOneBy({ id });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.trang_thai === TrangThaiLich.DA_HUY) throw new BadRequestException('Lịch hẹn đã bị hủy, không thể xác nhận');
    if (lich.trang_thai !== TrangThaiLich.CHO_XAC_NHAN) throw new BadRequestException('Lịch hẹn đã được xác nhận hoặc đã xử lý');
    lich.trang_thai = TrangThaiLich.DA_XAC_NHAN;
    return this.lich.save(lich);
  }

  // Lịch hẹn trong ngày hôm nay (chưa hủy, chưa khám xong) cho màn hình tiếp đón
  // Lịch hẹn của một ngày (mặc định hôm nay) — lễ tân chọn ngày để xem/check-in.
  // Trả mọi trạng thái để ngày đã qua vẫn xem được lịch đã khám / đã hủy.
  lichTheoNgay(ngayChon?: string) {
    let ngay: string;
    if (ngayChon !== undefined && ngayChon !== null && ngayChon !== '') {
      const v = String(ngayChon).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime()))
        throw new BadRequestException('Ngày không hợp lệ (định dạng YYYY-MM-DD)');
      ngay = v;
    } else {
      const d = new Date();
      ngay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return this.lich.find({
      where: { khung_gio: { ngay } },
      order: { so_thu_tu: 'ASC', id: 'ASC' },
    });
  }
  async checkin(id: number) {
    const lich = await this.lich.findOneBy({ id });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.trang_thai === TrangThaiLich.DA_HUY) throw new BadRequestException('Lịch hẹn đã bị hủy, không thể check-in');
    if (lich.trang_thai === TrangThaiLich.DA_KHAM) throw new BadRequestException('Lịch hẹn đã khám xong');
    if (lich.trang_thai === TrangThaiLich.DA_CHECKIN) return lich; // đã check-in rồi thì trả nguyên trạng
    lich.trang_thai = TrangThaiLich.DA_CHECKIN;
    return this.lich.save(lich);
  }

  // Bác sĩ đăng nhập bằng tài khoản riêng → tìm hồ sơ bác sĩ gắn với tài khoản đó.
  // Trả null nếu tài khoản chưa gắn bác sĩ nào (khi đó xem toàn bộ, dành cho admin/demo).
  private bacSiCuaUser(user: any) {
    if (user.vai_tro !== VaiTro.BAC_SI) return Promise.resolve(null);
    return this.ds.getRepository(BacSi).findOne({ where: { nguoi_dung: { id: user.id } } });
  }

  // Số liệu hôm nay cho trang tổng quan — chỉ đếm lịch của chính bác sĩ đó
  async tongQuanHomNay(user: any) {
    const d = new Date();
    const ngay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const bs = await this.bacSiCuaUser(user);
    const khungGio = bs ? { ngay, bac_si: { id: bs.id } } : { ngay };
    const [homNay, choKham, daKham] = await Promise.all([
      this.lich.count({ where: { khung_gio: khungGio } }),
      this.lich.count({ where: { khung_gio: khungGio, trang_thai: TrangThaiLich.DA_CHECKIN } }),
      this.lich.count({ where: { khung_gio: khungGio, trang_thai: TrangThaiLich.DA_KHAM } }),
    ]);
    return { hom_nay: homNay, cho_kham: choKham, da_kham: daKham, bac_si: bs ? bs.ho_ten : null };
  }

  // ----- Bác sĩ: hàng chờ + ghi kết quả -----
  async hangCho(user: any) {
    const bs = await this.bacSiCuaUser(user);
    return this.lich.find({
      where: {
        trang_thai: TrangThaiLich.DA_CHECKIN,
        ...(bs ? { khung_gio: { bac_si: { id: bs.id } } } : {}),
      },
      order: { so_thu_tu: 'ASC' },
    });
  }

  async ghiKetQua(lichId: number, user: any, dto: any) {
    const lich = await this.lich.findOne({ where: { id: lichId }, relations: ['khung_gio', 'khung_gio.bac_si'] });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    // Ưu tiên bác sĩ gắn với tài khoản đang đăng nhập; nếu tài khoản chưa gắn
    // thì ghi theo bác sĩ của khung giờ được đặt
    const bs = await this.bacSiCuaUser(user);
    const bacSiId = (bs && bs.id) || (lich.khung_gio && lich.khung_gio.bac_si && lich.khung_gio.bac_si.id) || 1;
    const luot = await this.luot.save(this.luot.create({
      lich_hen: lich, bac_si: { id: bacSiId } as any,
      chan_doan: dto.chan_doan, chi_dinh: dto.chi_dinh, ghi_chu: dto.ghi_chu,
      trang_thai: TrangThaiKham.HOAN_THANH,
    }));
    if (dto.don_thuoc) {
      await this.don.save(this.don.create({ luot_kham: luot, danh_sach_thuoc: dto.don_thuoc, lieu_dung: dto.lieu_dung }));
    }
    lich.trang_thai = TrangThaiLich.DA_KHAM;
    await this.lich.save(lich);
    return { message: 'Đã lưu kết quả khám', luot_kham_id: luot.id };
  }

  lichSuKham(hoSoId: number) {
    return this.luot.find({
      where: { lich_hen: { ho_so: { id: hoSoId } } },
      relations: ['lich_hen', 'don_thuoc'],
      order: { thoi_gian: 'DESC' },
    });
  }

  // Danh sách hồ sơ bệnh nhân kèm tổng số lượt đặt lịch.
  // q (tùy chọn): tìm theo tên, mã bệnh nhân hoặc số điện thoại.
  danhSachHoSo(q?: string) {
    const qb = this.hoSo
      .createQueryBuilder('hs')
      // QueryBuilder không tự nạp quan hệ — join tường minh bác sĩ mong muốn + khoa
      .leftJoinAndSelect('hs.bac_si_mong_muon', 'bsmm')
      .leftJoinAndSelect('bsmm.khoa', 'bsmm_khoa')
      .leftJoinAndSelect('hs.bac_si_tai_kham', 'bstk')
      .loadRelationCountAndMap('hs.so_luot_dat', 'hs.lich_hen')
      .orderBy('hs.id', 'DESC');
    if (q && q.trim()) {
      qb.where('(hs.ho_ten ILIKE :q OR hs.ma_benh_nhan ILIKE :q OR hs.sdt LIKE :q)', { q: `%${q.trim()}%` });
    }
    return qb.getMany();
  }

  // Toàn bộ lịch hẹn của một hồ sơ — nguồn cho calendar ở trang Hồ sơ bệnh nhân
  lichCuaHoSo(hoSoId: number) {
    return this.lich.find({ where: { ho_so: { id: hoSoId } }, order: { id: 'DESC' } });
  }

  // Xuất báo cáo CSV (mở được bằng Excel) từ dữ liệu thật trong database:
  // tổng quan, thống kê theo khoa, theo bác sĩ và danh sách lịch hẹn chi tiết
  async xuatBaoCao() {
    const csvCell = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = (...cells: any[]) => cells.map(csvCell).join(',');

    const tong = await this.baoCao();
    const theoKhoa = await this.lich.createQueryBuilder('lh')
      .leftJoin('lh.khoa', 'k')
      .select(`COALESCE(k.ten_khoa, '(không rõ)')`, 'khoa')
      .addSelect('COUNT(*)', 'tong')
      .addSelect(`SUM(CASE WHEN lh.trang_thai = 'da_kham' THEN 1 ELSE 0 END)`, 'da_kham')
      .addSelect(`SUM(CASE WHEN lh.trang_thai = 'da_huy' THEN 1 ELSE 0 END)`, 'da_huy')
      .groupBy('k.ten_khoa').orderBy('k.ten_khoa').getRawMany();
    const theoBacSi = await this.lich.createQueryBuilder('lh')
      .leftJoin('lh.khung_gio', 'kg').leftJoin('kg.bac_si', 'bs')
      .select(`COALESCE(bs.ho_ten, '(không rõ)')`, 'bac_si')
      .addSelect('COUNT(*)', 'tong')
      .addSelect(`SUM(CASE WHEN lh.trang_thai = 'da_kham' THEN 1 ELSE 0 END)`, 'da_kham')
      .groupBy('bs.ho_ten').orderBy('bs.ho_ten').getRawMany();
    const chiTiet = await this.lich.find({ order: { id: 'ASC' } }); // eager: ho_so, khung_gio, khoa

    const lines: string[] = [];
    lines.push(row('BÁO CÁO HOẠT ĐỘNG KHÁM CHỮA BỆNH — BV PHỤ SẢN HẢI PHÒNG'));
    lines.push(row('Xuất lúc', new Date().toLocaleString('vi-VN')));
    lines.push('');
    lines.push(row('TỔNG QUAN'));
    lines.push(row('Tổng lượt đặt', tong.tong_luot_dat));
    lines.push(row('Đã khám', tong.da_kham));
    lines.push(row('Đã hủy', tong.da_huy));
    lines.push(row('Tỷ lệ đến khám (%)', tong.ty_le_den_kham));
    lines.push('');
    lines.push(row('THEO KHOA'));
    lines.push(row('Khoa', 'Tổng lượt đặt', 'Đã khám', 'Đã hủy'));
    for (const k of theoKhoa) lines.push(row(k.khoa, k.tong, k.da_kham, k.da_huy));
    lines.push('');
    lines.push(row('THEO BÁC SĨ'));
    lines.push(row('Bác sĩ', 'Tổng lượt đặt', 'Đã khám'));
    for (const b of theoBacSi) lines.push(row(b.bac_si, b.tong, b.da_kham));
    lines.push('');
    lines.push(row('CHI TIẾT LỊCH HẸN'));
    lines.push(row('Mã lịch hẹn', 'Bệnh nhân', 'Mã BN', 'Khoa', 'Bác sĩ', 'Ngày khám', 'Giờ', 'STT', 'Trạng thái', 'Ngày tạo'));
    for (const l of chiTiet) {
      lines.push(row(
        l.ma_lich_hen,
        l.ho_so ? l.ho_so.ho_ten : '', l.ho_so ? l.ho_so.ma_benh_nhan : '',
        l.khoa ? l.khoa.ten_khoa : '',
        l.khung_gio && l.khung_gio.bac_si ? l.khung_gio.bac_si.ho_ten : '',
        l.khung_gio ? l.khung_gio.ngay : '', l.khung_gio ? l.khung_gio.gio_bat_dau : '',
        l.so_thu_tu || '', l.trang_thai,
        l.ngay_tao ? new Date(l.ngay_tao).toLocaleString('vi-VN') : '',
      ));
    }
    // BOM để Excel nhận đúng tiếng Việt UTF-8
    return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
  }

  // ----- Báo cáo (admin) -----
  async baoCao() {
    const tong = await this.lich.count();
    const daKham = await this.lich.count({ where: { trang_thai: TrangThaiLich.DA_KHAM } });
    const daHuy = await this.lich.count({ where: { trang_thai: TrangThaiLich.DA_HUY } });
    return {
      tong_luot_dat: tong,
      da_kham: daKham,
      da_huy: daHuy,
      ty_le_den_kham: tong ? Math.round((daKham / tong) * 100) : 0,
    };
  }
}

@Controller('api')
export class ApptController {
  constructor(private svc: ApptService) {}

  // Bệnh nhân
  @UseGuards(JwtAuthGuard) @Post('appointments') dat(@Request() r, @Body() b) { return this.svc.datLich(r.user.id, b); }
  @UseGuards(JwtAuthGuard) @Get('appointments/me') cuaToi(@Request() r) { return this.svc.lichCuaToi(r.user.id); }
  @UseGuards(JwtAuthGuard) @Patch('appointments/:id/cancel') huy(@Request() r, @Param('id') id) { return this.svc.huyLich(r.user.id, +id); }
  @UseGuards(JwtAuthGuard) @Delete('appointments/:id') xoa(@Request() r, @Param('id') id) { return this.svc.xoaLich(r.user.id, +id); }

  // Tiếp đón
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/today') lichHomNay(@Query('ngay') ngay?: string) { return this.svc.lichTheoNgay(ngay); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/lookup/:ma') traCuu(@Param('ma') ma) { return this.svc.traCuu(ma); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/checkin/:id') checkin(@Param('id') id) { return this.svc.checkin(+id); }
  // Lễ tân xem tất cả lịch hẹn + xác nhận
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/appointments') tatCaLich(@Query('trang_thai') tt?: string, @Query('q') q?: string) { return this.svc.tatCaLichHen(tt, q); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/confirm/:id') xacNhan(@Param('id') id) { return this.svc.xacNhanLich(+id); }

  // Bác sĩ
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('queue') hangCho(@Request() r) { return this.svc.hangCho(r.user); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('doctor/summary') tongQuan(@Request() r) { return this.svc.tongQuanHomNay(r.user); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('visits/:id/result') ghi(@Request() r, @Param('id') id, @Body() b) { return this.svc.ghiKetQua(+id, r.user, b); }
  // Lịch sử khám của một hồ sơ — chỉ nhân viên y tế được xem
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('records/:hoSoId') lichSu(@Param('hoSoId') id) { return this.svc.lichSuKham(+id); }

  // Hồ sơ bệnh nhân (bác sĩ, lễ tân, admin) — hỗ trợ ?q= tìm theo tên/mã BN/SĐT
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('patients') danhSachHoSo(@Query('q') q?: string) { return this.svc.danhSachHoSo(q); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('patients/:id/appointments') lichHoSo(@Param('id') id) { return this.svc.lichCuaHoSo(+id); }

  // Admin
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/reports') baoCao() { return this.svc.baoCao(); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/reports/export') async xuatBaoCao() {
    const ngay = new Date().toISOString().slice(0, 10);
    return new StreamableFile(await this.svc.xuatBaoCao(), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(`bao-cao-${ngay}.csv`)}`,
    });
  }
}
