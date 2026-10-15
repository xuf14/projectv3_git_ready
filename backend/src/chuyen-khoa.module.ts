import {
  Injectable, Controller, Get, Post, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import {
  ChuyenKhoa, PhieuKhamBenh, KhoaPhong, BacSi, NhatKyHoatDong, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { phamViBacSi } from './pham-vi-bac-si';
import { guiThongBao, idQuanTriVien } from './notification.module';

// ============================================================================
//  CHUYỂN KHOA ĐIỀU TRỊ — nghiệp vụ nằm trong màn hình Phiếu điều trị.
//
//  Hai điểm kiểm soát, đúng thực tế bàn giao người bệnh giữa hai khoa:
//    1. ĐỀ NGHỊ  bác sĩ điều trị hoặc lễ tân lập phiếu: khoa đến + lý do +
//                tình trạng người bệnh. Phiếu ở trạng thái chờ tiếp nhận.
//    2. TIẾP NHẬN bác sĩ CỦA KHOA ĐẾN xác nhận đã nhận người bệnh — chỉ khi đó
//                việc chuyển mới có hiệu lực. Khoa đến cũng có thể từ chối,
//                người lập có thể hủy; cả hai đều phải ghi lý do.
//
//    POST /api/treatment/chuyen-khoa                  lập phiếu đề nghị
//    GET  /api/treatment/chuyen-khoa?phieu_kham_id=   phiếu của một phiếu khám
//    GET  /api/treatment/chuyen-khoa?trang_thai=&khoa_id=  hàng chờ tiếp nhận
//    POST /api/treatment/chuyen-khoa/:id/tiep-nhan    khoa đến nhận người bệnh
//    POST /api/treatment/chuyen-khoa/:id/ket-thuc     từ chối / hủy (kèm lý do)
// ============================================================================

export const TRANG_THAI_CHUYEN_KHOA = ['cho_tiep_nhan', 'da_tiep_nhan', 'tu_choi', 'da_huy'];
// Trạng thái đóng phiếu mà người dùng được phép chọn ở route ket-thuc
export const TRANG_THAI_DONG = ['tu_choi', 'da_huy'];
export const NHAN_TRANG_THAI_CK: Record<string, string> = {
  cho_tiep_nhan: 'Chờ khoa đến tiếp nhận', da_tiep_nhan: 'Khoa đến đã tiếp nhận',
  tu_choi: 'Khoa đến từ chối', da_huy: 'Đã hủy',
};

const cat = (v: any, n: number) => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null; };
const ma = () => 'CK' + Math.random().toString(36).slice(2, 7).toUpperCase();
// Vi phạm ràng buộc duy nhất của PostgreSQL (mã phiếu trùng, hoặc unique index bộ
// phận "mỗi phiếu khám một đề nghị đang chờ").
const laTrungKhoa = (e: any) => e?.code === '23505' || e?.driverError?.code === '23505';

@Injectable()
export class ChuyenKhoaService {
  constructor(
    @InjectRepository(ChuyenKhoa) private ck: Repository<ChuyenKhoa>,
    private ds: DataSource,
  ) {}

  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  // Khoa đang điều trị người bệnh ở phiếu khám này: lần chuyển gần nhất đã được
  // tiếp nhận, nếu chưa từng chuyển thì lấy khoa của lần khám.
  private async khoaHienTai(m: EntityManager, phieuKhamId: number): Promise<KhoaPhong | null> {
    const daChuyen = await m.findOne(ChuyenKhoa, {
      where: { phieu_kham: { id: phieuKhamId }, trang_thai: 'da_tiep_nhan' },
      relations: ['khoa_den'], order: { id: 'DESC' },
    });
    if (daChuyen && daChuyen.khoa_den) return daChuyen.khoa_den;
    const pk = await m.findOne(PhieuKhamBenh, {
      where: { id: phieuKhamId }, relations: ['lich_hen', 'lich_hen.khoa'],
    });
    return pk && pk.lich_hen && pk.lich_hen.khoa ? pk.lich_hen.khoa : null;
  }

  // ------------------------------------------------------------- ĐỀ NGHỊ
  async tao(userId: number, dto: any) {
    const phieuKhamId = +dto?.phieu_kham_id;
    if (!phieuKhamId) throw new BadRequestException('Cần chọn phiếu khám bệnh của bệnh nhân');
    const khoaDenId = +dto?.khoa_den_id;
    if (!khoaDenId) throw new BadRequestException('Chọn khoa tiếp nhận người bệnh');
    const ly_do = cat(dto?.ly_do, 2000);
    if (!ly_do) throw new BadRequestException('Phải ghi lý do chuyển khoa');
    const tinh_trang_nb = cat(dto?.tinh_trang_nb, 2000);

    const id = await this.ds.transaction(async (m) => {
      const pk = await m.findOne(PhieuKhamBenh, { where: { id: phieuKhamId } });
      if (!pk) throw new NotFoundException('Phiếu khám bệnh không tồn tại');
      const khoaDen = await m.findOne(KhoaPhong, { where: { id: khoaDenId } });
      if (!khoaDen) throw new NotFoundException('Khoa tiếp nhận không tồn tại');

      const khoaDi = await this.khoaHienTai(m, phieuKhamId);
      if (khoaDi && khoaDi.id === khoaDen.id)
        throw new BadRequestException(`Người bệnh đang điều trị tại ${khoaDen.ten_khoa}, chọn khoa khác`);

      const saved = await m.save(m.create(ChuyenKhoa, {
        ma_phieu: ma(), trang_thai: 'cho_tiep_nhan', ly_do, tinh_trang_nb,
        phieu_kham: { id: pk.id } as any,
        khoa_di: khoaDi ? ({ id: khoaDi.id } as any) : null,
        khoa_den: { id: khoaDen.id } as any,
        nguoi_tao: { id: userId } as any,
      }));

      // Hàng chờ của khoa đến là thời gian thực → báo ngay cho bác sĩ khoa đó
      await guiThongBao(m, [...(await this.idBacSiKhoa(m, khoaDen.id)), ...(await idQuanTriVien(m))], {
        loai: 'chuyen_khoa',
        tieu_de: `Đề nghị chuyển khoa đến ${khoaDen.ten_khoa}`,
        noi_dung: `${pk.ten_bn}${pk.ma_kcb ? ` (${pk.ma_kcb})` : ''} — ${ly_do}. Mã phiếu ${saved.ma_phieu}`,
      });
      await this.ghiNhatKy(m, userId, 'tao_chuyen_khoa',
        `Đề nghị chuyển khoa ${saved.ma_phieu} cho ${pk.ten_bn} (phiếu khám #${pk.id})` +
        ` — từ ${khoaDi ? khoaDi.ten_khoa : 'chưa xác định'} sang ${khoaDen.ten_khoa}`);
      return saved.id;
    }).catch((e) => {
      if (laTrungKhoa(e))
        throw new ConflictException('Phiếu khám này đã có một đề nghị chuyển khoa đang chờ tiếp nhận');
      throw e;
    });

    return this.chiTiet(id);
  }

  private async idBacSiKhoa(m: EntityManager, khoaId: number) {
    const list = await m.find(BacSi, { where: { khoa: { id: khoaId } }, relations: ['nguoi_dung'] });
    return list.map((b) => (b.nguoi_dung ? b.nguoi_dung.id : 0)).filter((id) => id > 0);
  }

  // ------------------------------------------------------------- DANH SÁCH
  // Có phieu_kham_id → lịch sử chuyển khoa của phiếu điều trị đó.
  // Không có → hàng chờ tiếp nhận; bác sĩ chỉ thấy hàng chờ của khoa mình.
  async danhSach(user: any, q: { phieu_kham_id?: string; trang_thai?: string; khoa_id?: string }) {
    const qb = this.ck.createQueryBuilder('c')
      .leftJoinAndSelect('c.phieu_kham', 'pk')
      .leftJoinAndSelect('c.khoa_di', 'kd')
      .leftJoinAndSelect('c.khoa_den', 'kden')
      .leftJoinAndSelect('c.nguoi_tao', 'nt')
      .leftJoinAndSelect('c.nguoi_xu_ly', 'nxl')
      .orderBy('c.id', 'DESC')
      .take(200);

    const phieuKhamId = +(q.phieu_kham_id || 0);
    if (phieuKhamId) {
      qb.where('pk.id = :id', { id: phieuKhamId });
    } else {
      const tt = String(q.trang_thai || 'cho_tiep_nhan').trim();
      if (tt !== 'tat_ca') {
        if (!TRANG_THAI_CHUYEN_KHOA.includes(tt))
          throw new BadRequestException('Trạng thái phiếu chuyển khoa không hợp lệ');
        qb.where('c.trang_thai = :tt', { tt });
      } else {
        qb.where('1 = 1');
      }
      // Bác sĩ chỉ thấy phiếu gửi đến khoa của mình; lễ tân/quản trị xem toàn bộ
      const pv = await phamViBacSi(this.ds, user);
      if (!pv.xemTatCa) {
        const khoaBs = pv.bs && pv.bs.khoa ? pv.bs.khoa.id : 0;
        if (!khoaBs) return [];
        qb.andWhere('kden.id = :kb', { kb: khoaBs });
      } else if (+(q.khoa_id || 0)) {
        qb.andWhere('kden.id = :k', { k: +q.khoa_id });
      }
    }
    return (await qb.getMany()).map((c) => this.goi(c));
  }

  async chiTiet(id: number) {
    const c = await this.ck.findOne({
      where: { id },
      relations: ['phieu_kham', 'khoa_di', 'khoa_den', 'nguoi_tao', 'nguoi_xu_ly'],
    });
    if (!c) throw new NotFoundException('Phiếu chuyển khoa không tồn tại');
    return this.goi(c);
  }

  // ------------------------------------------------------------- TIẾP NHẬN
  // Chỉ bác sĩ CỦA KHOA ĐẾN (hoặc quản trị viên) mới xác nhận được — đây là chữ ký
  // bàn giao người bệnh, không phải thao tác hành chính ai bấm cũng được.
  async tiepNhan(user: any, id: number) {
    await this.ds.transaction(async (m) => {
      const c = await m.findOne(ChuyenKhoa, {
        where: { id }, relations: ['phieu_kham', 'khoa_den', 'khoa_di', 'nguoi_tao'],
      });
      if (!c) throw new NotFoundException('Phiếu chuyển khoa không tồn tại');
      if (c.trang_thai !== 'cho_tiep_nhan')
        throw new ConflictException(`Phiếu đã ở trạng thái "${NHAN_TRANG_THAI_CK[c.trang_thai] || c.trang_thai}"`);

      const pv = await phamViBacSi(this.ds, user);
      if (!pv.xemTatCa) {
        const khoaBs = pv.bs && pv.bs.khoa ? pv.bs.khoa.id : 0;
        if (!c.khoa_den || khoaBs !== c.khoa_den.id)
          throw new ForbiddenException('Chỉ bác sĩ của khoa tiếp nhận mới xác nhận được phiếu chuyển khoa này');
      }

      c.trang_thai = 'da_tiep_nhan';
      c.thoi_gian_xu_ly = new Date();
      c.nguoi_xu_ly = { id: user.id } as any;
      await m.save(c);

      const nhan = c.nguoi_tao && c.nguoi_tao.id !== user.id ? [c.nguoi_tao.id] : [];
      await guiThongBao(m, nhan, {
        loai: 'chuyen_khoa',
        tieu_de: `${c.khoa_den.ten_khoa} đã tiếp nhận người bệnh`,
        noi_dung: `Phiếu chuyển khoa ${c.ma_phieu} — ${c.phieu_kham ? c.phieu_kham.ten_bn : ''}`,
      });
      await this.ghiNhatKy(m, user.id, 'tiep_nhan_chuyen_khoa',
        `${c.khoa_den.ten_khoa} tiếp nhận phiếu chuyển khoa ${c.ma_phieu}` +
        `${c.phieu_kham ? ` của ${c.phieu_kham.ten_bn}` : ''}`);
    });
    return this.chiTiet(id);
  }

  // ------------------------------------------------------------- TỪ CHỐI / HỦY
  async ketThuc(user: any, id: number, dto: any) {
    const trangThai = String(dto?.trang_thai || '').trim();
    if (!TRANG_THAI_DONG.includes(trangThai))
      throw new BadRequestException('Chỉ đóng phiếu với trạng thái từ chối hoặc đã hủy');
    const lyDo = cat(dto?.ly_do_ket_thuc, 1000);
    if (!lyDo) throw new BadRequestException('Phải ghi rõ lý do từ chối hoặc hủy phiếu');

    await this.ds.transaction(async (m) => {
      const c = await m.findOne(ChuyenKhoa, {
        where: { id }, relations: ['phieu_kham', 'khoa_den', 'nguoi_tao'],
      });
      if (!c) throw new NotFoundException('Phiếu chuyển khoa không tồn tại');
      if (c.trang_thai !== 'cho_tiep_nhan')
        throw new ConflictException(`Phiếu đã ở trạng thái "${NHAN_TRANG_THAI_CK[c.trang_thai] || c.trang_thai}"`);

      // Từ chối là quyết định của khoa đến; hủy là quyết định của nơi lập phiếu.
      if (trangThai === 'tu_choi') {
        const pv = await phamViBacSi(this.ds, user);
        if (!pv.xemTatCa) {
          const khoaBs = pv.bs && pv.bs.khoa ? pv.bs.khoa.id : 0;
          if (!c.khoa_den || khoaBs !== c.khoa_den.id)
            throw new ForbiddenException('Chỉ bác sĩ của khoa tiếp nhận mới từ chối được phiếu này');
        }
      } else if (user.vai_tro === VaiTro.BAC_SI) {
        if (!c.nguoi_tao || c.nguoi_tao.id !== user.id)
          throw new ForbiddenException('Chỉ người lập phiếu, lễ tân hoặc quản trị viên mới hủy được phiếu này');
      }

      c.trang_thai = trangThai;
      c.ly_do_ket_thuc = lyDo;
      c.thoi_gian_xu_ly = new Date();
      c.nguoi_xu_ly = { id: user.id } as any;
      await m.save(c);

      const nhan = c.nguoi_tao && c.nguoi_tao.id !== user.id ? [c.nguoi_tao.id] : [];
      await guiThongBao(m, nhan, {
        loai: 'chuyen_khoa',
        tieu_de: `Phiếu chuyển khoa ${c.ma_phieu} — ${NHAN_TRANG_THAI_CK[trangThai]}`,
        noi_dung: lyDo,
      });
      await this.ghiNhatKy(m, user.id, 'dong_chuyen_khoa',
        `Đóng phiếu chuyển khoa ${c.ma_phieu} — ${NHAN_TRANG_THAI_CK[trangThai]}: ${lyDo}`);
    });
    return this.chiTiet(id);
  }

  private goi(c: ChuyenKhoa) {
    return {
      id: c.id, ma_phieu: c.ma_phieu, trang_thai: c.trang_thai,
      nhan_trang_thai: NHAN_TRANG_THAI_CK[c.trang_thai] || c.trang_thai,
      ly_do: c.ly_do, tinh_trang_nb: c.tinh_trang_nb, ly_do_ket_thuc: c.ly_do_ket_thuc,
      thoi_gian_tao: c.thoi_gian_tao, thoi_gian_xu_ly: c.thoi_gian_xu_ly,
      phieu_kham: c.phieu_kham
        ? { id: c.phieu_kham.id, ten_bn: c.phieu_kham.ten_bn, ma_kcb: c.phieu_kham.ma_kcb }
        : null,
      khoa_di: c.khoa_di ? { id: c.khoa_di.id, ten_khoa: c.khoa_di.ten_khoa } : null,
      khoa_den: c.khoa_den ? { id: c.khoa_den.id, ten_khoa: c.khoa_den.ten_khoa } : null,
      nguoi_tao: c.nguoi_tao ? { id: c.nguoi_tao.id, ho_ten: c.nguoi_tao.ho_ten } : null,
      nguoi_xu_ly: c.nguoi_xu_ly ? { id: c.nguoi_xu_ly.id, ho_ten: c.nguoi_xu_ly.ho_ten } : null,
    };
  }
}

@Controller('api')
export class ChuyenKhoaController {
  constructor(private svc: ChuyenKhoaService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('treatment/chuyen-khoa') tao(@Request() r, @Body() b) { return this.svc.tao(r.user.id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('treatment/chuyen-khoa') ds(
    @Request() r, @Query('phieu_kham_id') pk: string,
    @Query('trang_thai') tt: string, @Query('khoa_id') k: string,
  ) {
    return this.svc.danhSach(r.user, { phieu_kham_id: pk, trang_thai: tt, khoa_id: k });
  }

  // Xác nhận bàn giao người bệnh — chỉ khoa đến (kiểm tra tiếp trong service)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('treatment/chuyen-khoa/:id/tiep-nhan') tiepNhan(@Request() r, @Param('id') id: string) {
    return this.svc.tiepNhan(r.user, +id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('treatment/chuyen-khoa/:id/ket-thuc') ketThuc(@Request() r, @Param('id') id: string, @Body() b) {
    return this.svc.ketThuc(r.user, +id, b);
  }
}
