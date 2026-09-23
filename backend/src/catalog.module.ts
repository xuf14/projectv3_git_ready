import {
  Injectable, Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KhoaPhong, BacSi, KhungGio, TinTuc, VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(KhoaPhong) private khoa: Repository<KhoaPhong>,
    @InjectRepository(BacSi) private bacSi: Repository<BacSi>,
    @InjectRepository(KhungGio) private slot: Repository<KhungGio>,
    @InjectRepository(TinTuc) private tin: Repository<TinTuc>,
  ) {}

  getKhoa() { return this.khoa.find({ relations: ['bac_si'] }); }

  getBacSi(khoaId?: number) {
    const where = khoaId ? { khoa: { id: khoaId } } : {};
    return this.bacSi.find({ where });
  }

  // Ngày nằm trong cửa sổ đặt lịch (hôm nay → 1 năm tới)?
  private trongCuaSoDat(ngay: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay || '')) return false;
    const d = new Date(ngay + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    const homNay = new Date(); homNay.setHours(0, 0, 0, 0);
    const max = new Date(homNay); max.setFullYear(max.getFullYear() + 1);
    return d >= homNay && d <= max;
  }

  async getSlots(bacSiId: number, ngay: string) {
    let all = await this.slot.find({ where: { bac_si: { id: bacSiId }, ngay }, order: { gio_bat_dau: 'ASC' } });

    // Ngày chưa được cấu hình khung giờ → tự sinh bộ khung mặc định để bệnh
    // nhân luôn đặt được trong cửa sổ 30 ngày; admin chỉnh lại ở trang Khung giờ.
    if (all.length === 0 && this.trongCuaSoDat(ngay)) {
      const bs = await this.bacSi.findOneBy({ id: bacSiId });
      if (bs) {
        const GIO_MAC_DINH = ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '13:30', '14:00', '14:30', '15:00'];
        await this.slot.manager.transaction(async (m) => {
          // kiểm tra lại trong transaction để hạn chế sinh trùng khi gọi đồng thời
          const daCo = await m.count(KhungGio, { where: { bac_si: { id: bacSiId }, ngay } });
          if (daCo === 0) {
            await m.save(GIO_MAC_DINH.map((g) =>
              m.create(KhungGio, { ngay, gio_bat_dau: g, gio_ket_thuc: g, so_luong: 5, da_dat: 0, bac_si: bs })));
          }
        });
        all = await this.slot.find({ where: { bac_si: { id: bacSiId }, ngay }, order: { gio_bat_dau: 'ASC' } });
      }
    }

    return all
      .filter((s) => s.da_dat < s.so_luong)
      .map((s) => ({ id: s.id, gio_bat_dau: s.gio_bat_dau, gio_ket_thuc: s.gio_ket_thuc, con_lai: s.so_luong - s.da_dat }));
  }

  getTinTuc() { return this.tin.find({ order: { ngay_dang: 'DESC' } }); }

  // --- Admin: quản lý khung giờ khám của bác sĩ ---
  // Khác /slots công khai: trả đủ mọi khung (kể cả đã đầy) kèm số đã đặt
  adminSlots(bacSiId: number, ngay: string) {
    return this.slot.find({ where: { bac_si: { id: bacSiId }, ngay }, order: { gio_bat_dau: 'ASC' } });
  }

  async addSlot(dto: any) {
    const ngay = String(dto.ngay || '');
    const gio = String(dto.gio_bat_dau || '');
    const soLuong = +dto.so_luong || 5;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) throw new BadRequestException('Ngày không hợp lệ (YYYY-MM-DD)');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(gio)) throw new BadRequestException('Giờ không hợp lệ (HH:mm)');
    if (soLuong < 1 || soLuong > 50) throw new BadRequestException('Số chỗ phải từ 1 đến 50');
    const bs = await this.bacSi.findOneBy({ id: +dto.bac_si_id || 0 });
    if (!bs) throw new NotFoundException('Không tìm thấy bác sĩ');
    const trung = await this.slot.findOne({ where: { bac_si: { id: bs.id }, ngay, gio_bat_dau: gio } });
    if (trung) throw new BadRequestException('Bác sĩ đã có khung giờ này trong ngày');
    return this.slot.save(this.slot.create({ ngay, gio_bat_dau: gio, gio_ket_thuc: gio, so_luong: soLuong, da_dat: 0, bac_si: bs }));
  }

  async updateSlot(id: number, dto: any) {
    const s = await this.slot.findOneBy({ id });
    if (!s) throw new NotFoundException('Không tìm thấy khung giờ');
    const soLuong = +dto.so_luong;
    if (!soLuong || soLuong < 1 || soLuong > 50) throw new BadRequestException('Số chỗ phải từ 1 đến 50');
    if (soLuong < s.da_dat) throw new BadRequestException(`Đã có ${s.da_dat} lượt đặt — không thể giảm dưới mức đó`);
    s.so_luong = soLuong;
    return this.slot.save(s);
  }

  async deleteSlot(id: number) {
    const s = await this.slot.findOneBy({ id });
    if (!s) throw new NotFoundException('Không tìm thấy khung giờ');
    if (s.da_dat > 0) throw new BadRequestException('Khung giờ đã có lượt đặt, không thể xóa');
    await this.slot.delete(id);
    return { message: 'Đã xóa khung giờ' };
  }

  // --- Admin: thêm khoa / bác sĩ ---
  addKhoa(dto: any) { return this.khoa.save(this.khoa.create(dto)); }
  async addBacSi(dto: any) {
    const khoa = await this.khoa.findOneBy({ id: dto.khoa_id });
    return this.bacSi.save(this.bacSi.create({ ...dto, khoa }));
  }
}

@Controller('api')
export class CatalogController {
  constructor(private svc: CatalogService) {}

  @Get('departments') khoa() { return this.svc.getKhoa(); }
  @Get('doctors') bacSi(@Query('khoa') khoa?: string) { return this.svc.getBacSi(khoa ? +khoa : undefined); }
  @Get('slots') slots(@Query('bacSi') bacSi: string, @Query('ngay') ngay: string) { return this.svc.getSlots(+bacSi, ngay); }
  @Get('news') tin() { return this.svc.getTinTuc(); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/slots') adminSlots(@Query('bacSi') bacSi: string, @Query('ngay') ngay: string) { return this.svc.adminSlots(+bacSi, ngay); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('admin/slots') addSlot(@Body() b: any) { return this.svc.addSlot(b); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Patch('admin/slots/:id') updateSlot(@Param('id') id: string, @Body() b: any) { return this.svc.updateSlot(+id, b); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Delete('admin/slots/:id') deleteSlot(@Param('id') id: string) { return this.svc.deleteSlot(+id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('admin/departments') addKhoa(@Body() b: any) { return this.svc.addKhoa(b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('admin/doctors') addBacSi(@Body() b: any) { return this.svc.addBacSi(b); }
}
