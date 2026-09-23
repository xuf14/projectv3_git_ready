import {
  Injectable, Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException, StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  ThanhToan, ChiTietThanhToan, LichHen, DichVu, NhatKyHoatDong,
  TrangThaiThanhToan, TrangThaiLich, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

const laNhanVien = (vaiTro: string) =>
  [VaiTro.LE_TAN, VaiTro.ADMIN].includes(vaiTro as VaiTro);

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(ThanhToan) private tt: Repository<ThanhToan>,
    @InjectRepository(LichHen) private lich: Repository<LichHen>,
    @InjectRepository(DichVu) private dichVu: Repository<DichVu>,
    private ds: DataSource,
  ) {}

  // Danh mục dịch vụ cho lễ tân chọn khi lập hóa đơn
  danhSachDichVu() {
    return this.dichVu.find({ relations: ['khoa'], order: { id: 'ASC' } });
  }

  private goiTien(t: ThanhToan) {
    return {
      id: t.id, ma_thanh_toan: t.ma_thanh_toan, tong_tien: t.tong_tien,
      trang_thai: t.trang_thai, ghi_chu: t.ghi_chu,
      ngay_tao: t.ngay_tao, ngay_thanh_toan: t.ngay_thanh_toan,
      nguoi_tao: t.nguoi_tao ? { id: t.nguoi_tao.id, ho_ten: t.nguoi_tao.ho_ten } : null,
      lich_hen: t.lich_hen ? {
        id: t.lich_hen.id, ma_lich_hen: t.lich_hen.ma_lich_hen, trang_thai: t.lich_hen.trang_thai,
        benh_nhan: t.lich_hen.ho_so ? t.lich_hen.ho_so.ho_ten : null,
        ma_benh_nhan: t.lich_hen.ho_so ? t.lich_hen.ho_so.ma_benh_nhan : null,
        khoa: t.lich_hen.khoa ? t.lich_hen.khoa.ten_khoa : null,
      } : null,
      chi_tiet: (t.chi_tiet || [])
        .sort((a, b) => a.id - b.id)
        .map((c) => ({ id: c.id, ten_dich_vu: c.ten_dich_vu, don_gia: c.don_gia, so_luong: c.so_luong, thanh_tien: c.thanh_tien })),
    };
  }

  // Lễ tân lập hóa đơn cho một lịch hẹn ĐÃ KHÁM, gồm các dịch vụ đã chọn.
  async lapHoaDon(user: any, lichId: number, dto: any) {
    const lich = await this.lich.findOne({ where: { id: lichId }, relations: ['ho_so'] });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.trang_thai !== TrangThaiLich.DA_KHAM)
      throw new BadRequestException('Chỉ lập thanh toán sau khi bệnh nhân đã khám xong');

    const items: any[] = Array.isArray(dto.items) ? dto.items : [];
    if (items.length === 0) throw new BadRequestException('Vui lòng chọn ít nhất một dịch vụ');

    // Đã có hóa đơn còn hiệu lực cho lịch này thì không lập thêm
    const daCo = await this.tt.findOne({
      where: [
        { lich_hen: { id: lichId }, trang_thai: TrangThaiThanhToan.CHO_THANH_TOAN },
        { lich_hen: { id: lichId }, trang_thai: TrangThaiThanhToan.DA_THANH_TOAN },
      ],
    });
    if (daCo) throw new BadRequestException(`Lịch hẹn này đã có hóa đơn ${daCo.ma_thanh_toan}`);

    return this.ds.transaction(async (m) => {
      const chiTiet: ChiTietThanhToan[] = [];
      let tong = 0;
      for (const it of items) {
        const dv = await m.findOne(DichVu, { where: { id: +it.dich_vu_id || 0 } });
        if (!dv) throw new BadRequestException('Dịch vụ không tồn tại');
        const soLuong = Math.max(1, Math.min(50, +it.so_luong || 1));
        const thanhTien = dv.gia * soLuong;
        tong += thanhTien;
        chiTiet.push(m.create(ChiTietThanhToan, {
          ten_dich_vu: dv.ten_dich_vu, don_gia: dv.gia, so_luong: soLuong, thanh_tien: thanhTien,
          dich_vu: { id: dv.id } as any,
        }));
      }
      const hoaDon = await m.save(m.create(ThanhToan, {
        ma_thanh_toan: 'TT' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        tong_tien: tong, trang_thai: TrangThaiThanhToan.CHO_THANH_TOAN,
        ghi_chu: dto.ghi_chu ? String(dto.ghi_chu).slice(0, 500) : null,
        lich_hen: { id: lich.id } as any, nguoi_tao: { id: user.id } as any,
        chi_tiet: chiTiet,
      }));
      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'lap_thanh_toan',
        noi_dung: `Lập hóa đơn ${hoaDon.ma_thanh_toan} (${tong.toLocaleString('vi-VN')}đ) cho lịch hẹn ${lich.ma_lich_hen}`,
        nguoi_dung: { id: user.id } as any,
      }));
      const full = await m.findOne(ThanhToan, { where: { id: hoaDon.id }, relations: ['lich_hen', 'lich_hen.ho_so', 'lich_hen.khoa', 'nguoi_tao', 'chi_tiet'] });
      return this.goiTien(full);
    });
  }

  // Lễ tân xác nhận bệnh nhân đã thanh toán tại quầy
  async xacNhanThanhToan(user: any, id: number) {
    const t = await this.tt.findOne({ where: { id }, relations: ['lich_hen', 'lich_hen.ho_so', 'lich_hen.khoa', 'nguoi_tao', 'chi_tiet'] });
    if (!t) throw new NotFoundException('Không tìm thấy hóa đơn');
    if (t.trang_thai === TrangThaiThanhToan.DA_HUY) throw new BadRequestException('Hóa đơn đã bị hủy');
    if (t.trang_thai === TrangThaiThanhToan.DA_THANH_TOAN) return this.goiTien(t);
    t.trang_thai = TrangThaiThanhToan.DA_THANH_TOAN;
    t.ngay_thanh_toan = new Date();
    await this.tt.save(t);
    await this.ds.getRepository(NhatKyHoatDong).save({
      hanh_dong: 'thu_thanh_toan',
      noi_dung: `Thu thanh toán hóa đơn ${t.ma_thanh_toan} (${t.tong_tien.toLocaleString('vi-VN')}đ)`,
      nguoi_dung: { id: user.id } as any,
    });
    return this.goiTien(t);
  }

  // Admin hủy hóa đơn (chỉ hóa đơn chưa thanh toán)
  async huyHoaDon(user: any, id: number) {
    const t = await this.tt.findOne({ where: { id }, relations: ['lich_hen', 'lich_hen.ho_so', 'lich_hen.khoa', 'nguoi_tao', 'chi_tiet'] });
    if (!t) throw new NotFoundException('Không tìm thấy hóa đơn');
    if (t.trang_thai === TrangThaiThanhToan.DA_THANH_TOAN)
      throw new BadRequestException('Hóa đơn đã thanh toán, không thể hủy');
    t.trang_thai = TrangThaiThanhToan.DA_HUY;
    await this.tt.save(t);
    await this.ds.getRepository(NhatKyHoatDong).save({
      hanh_dong: 'huy_thanh_toan',
      noi_dung: `Hủy hóa đơn ${t.ma_thanh_toan}`,
      nguoi_dung: { id: user.id } as any,
    });
    return this.goiTien(t);
  }

  // Toàn bộ hóa đơn (lễ tân & admin)
  async danhSach() {
    const list = await this.tt.find({
      relations: ['lich_hen', 'lich_hen.ho_so', 'lich_hen.khoa', 'nguoi_tao', 'chi_tiet'],
      order: { id: 'DESC' }, take: 200,
    });
    return list.map((t) => this.goiTien(t));
  }

  // Hóa đơn của một lịch hẹn — nhân viên xem bất kỳ; bệnh nhân chỉ xem của mình
  async choLichHen(user: any, lichId: number) {
    const list = await this.tt.find({
      where: { lich_hen: { id: lichId } },
      relations: ['lich_hen', 'lich_hen.ho_so', 'lich_hen.ho_so.nguoi_dung', 'lich_hen.khoa', 'nguoi_tao', 'chi_tiet'],
      order: { id: 'DESC' },
    });
    if (!laNhanVien(user.vai_tro)) {
      const cuaMinh = list.every((t) => t.lich_hen.ho_so.nguoi_dung?.id === user.id);
      if (!cuaMinh) throw new ForbiddenException('Không có quyền xem hóa đơn này');
    }
    return list.map((t) => this.goiTien(t));
  }

  // Bệnh nhân xem toàn bộ hóa đơn của mình
  async cuaBenhNhan(userId: number) {
    const list = await this.tt.find({
      where: { lich_hen: { ho_so: { nguoi_dung: { id: userId } } } },
      relations: ['lich_hen', 'lich_hen.ho_so', 'lich_hen.khoa', 'nguoi_tao', 'chi_tiet'],
      order: { id: 'DESC' },
    });
    return list.map((t) => this.goiTien(t));
  }

  // Chuẩn hóa ngày về YYYY-MM-DD; mặc định là hôm nay (giờ địa phương)
  private chuanNgay(ngay?: string) {
    if (ngay && /^\d{4}-\d{2}-\d{2}$/.test(ngay)) return ngay;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Sổ thu: các hóa đơn ĐÃ THANH TOÁN trong một ngày (theo ngày thu tiền).
  // Dữ liệu lưu sẵn trong bảng thanh_toan — đây là truy vấn theo ngay_thanh_toan.
  async thanhToanTrongNgay(ngay?: string) {
    const day = this.chuanNgay(ngay);
    const list = await this.tt.createQueryBuilder('t')
      .leftJoinAndSelect('t.lich_hen', 'lh')
      .leftJoinAndSelect('lh.ho_so', 'hs')
      .leftJoinAndSelect('lh.khoa', 'k')
      .leftJoinAndSelect('t.nguoi_tao', 'nt')
      .leftJoinAndSelect('t.chi_tiet', 'ct')
      .where('t.trang_thai = :tt', { tt: TrangThaiThanhToan.DA_THANH_TOAN })
      .andWhere('t.ngay_thanh_toan::date = :day', { day })
      .orderBy('t.ngay_thanh_toan', 'DESC')
      .getMany();
    const tong = list.reduce((s, t) => s + t.tong_tien, 0);
    return { ngay: day, so_hoa_don: list.length, tong_tien: tong, danh_sach: list.map((t) => this.goiTien(t)) };
  }

  // Trích xuất sổ thu trong ngày ra CSV (Excel mở được, UTF-8 BOM)
  async xuatExcelNgay(ngay?: string) {
    const { ngay: day, so_hoa_don, tong_tien, danh_sach } = await this.thanhToanTrongNgay(ngay);
    const cell = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = (...c: any[]) => c.map(cell).join(',');
    const lines: string[] = [];
    lines.push(row('SỔ THU DỊCH VỤ TRONG NGÀY — BV PHỤ SẢN HẢI PHÒNG'));
    lines.push(row('Ngày', day.split('-').reverse().join('/')));
    lines.push(row('Số hóa đơn đã thu', so_hoa_don));
    lines.push(row('Tổng thu (đồng)', tong_tien));
    lines.push('');
    lines.push(row('STT', 'Mã hóa đơn', 'Bệnh nhân', 'Mã lịch hẹn', 'Khoa', 'Dịch vụ', 'Thành tiền', 'Giờ thu', 'Người thu'));
    danh_sach.forEach((t, i) => {
      const dv = t.chi_tiet.map((c) => `${c.ten_dich_vu}${c.so_luong > 1 ? ` x${c.so_luong}` : ''}`).join('; ');
      const gio = t.ngay_thanh_toan ? new Date(t.ngay_thanh_toan).toLocaleTimeString('vi-VN') : '';
      lines.push(row(i + 1, t.ma_thanh_toan, t.lich_hen ? t.lich_hen.benh_nhan : '',
        t.lich_hen ? t.lich_hen.ma_lich_hen : '', t.lich_hen ? t.lich_hen.khoa : '',
        dv, t.tong_tien, gio, t.nguoi_tao ? t.nguoi_tao.ho_ten : ''));
    });
    lines.push('');
    lines.push(row('', '', '', '', '', 'TỔNG CỘNG', tong_tien));
    return { day, buffer: Buffer.from('﻿' + lines.join('\r\n'), 'utf8') };
  }
}

@Controller('api')
export class PaymentController {
  constructor(private svc: PaymentService) {}

  // Danh mục dịch vụ (nhân viên y tế)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('services') dichVu() { return this.svc.danhSachDichVu(); }

  // Lễ tân lập hóa đơn + thu tiền
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/appointments/:id/payment') lap(@Request() r, @Param('id') id, @Body() b) { return this.svc.lapHoaDon(r.user, +id, b); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('payments/:id/pay') thu(@Request() r, @Param('id') id) { return this.svc.xacNhanThanhToan(r.user, +id); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/payments') dsLeTan() { return this.svc.danhSach(); }
  // Sổ thu trong ngày + trích xuất Excel
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/payments/daily') soThuNgay(@Query('ngay') ngay?: string) { return this.svc.thanhToanTrongNgay(ngay); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/payments/daily/export') async xuatSoThu(@Query('ngay') ngay?: string) {
    const { day, buffer } = await this.svc.xuatExcelNgay(ngay);
    return new StreamableFile(buffer, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(`so-thu-${day}.csv`)}`,
    });
  }

  // Hóa đơn theo lịch hẹn (bệnh nhân xem của mình, nhân viên xem bất kỳ)
  @UseGuards(JwtAuthGuard)
  @Get('appointments/:id/payment') theoLich(@Request() r, @Param('id') id) { return this.svc.choLichHen(r.user, +id); }
  // Bệnh nhân xem toàn bộ hóa đơn của mình
  @UseGuards(JwtAuthGuard)
  @Get('payments/me') cuaToi(@Request() r) { return this.svc.cuaBenhNhan(r.user.id); }

  // Admin xem & quản lý toàn bộ hóa đơn
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/payments') dsAdmin() { return this.svc.danhSach(); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Patch('admin/payments/:id/cancel') huy(@Request() r, @Param('id') id) { return this.svc.huyHoaDon(r.user, +id); }
}
