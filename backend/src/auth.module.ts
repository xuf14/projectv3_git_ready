import {
  Injectable, Controller, Post, Body, BadRequestException, UnauthorizedException, Get, UseGuards, Request,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { NguoiDung, HoSoBenhNhan, VaiTro } from './entities';
import { JwtAuthGuard } from './auth';
import { chuanHoaHoSo } from './profile.module';

// Bộ nhớ tạm cho OTP (thực tế nên dùng Redis + gửi SMS/email)
const otpStore = new Map<string, string>();

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(NguoiDung) private users: Repository<NguoiDung>,
    @InjectRepository(HoSoBenhNhan) private hoSo: Repository<HoSoBenhNhan>,
    private jwt: JwtService,
  ) {}

  // Bước 1: yêu cầu OTP (giả lập — trả luôn mã để demo)
  async requestOtp(sdt: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(sdt, otp);
    // Thực tế: gửi SMS qua nhà cung cấp. Ở đây trả về để test.
    return { message: 'Mã OTP đã được gửi (demo)', otp_demo: otp };
  }

  // Bước 2: đăng ký kèm xác thực OTP. Ngoài tài khoản, các thông tin bệnh nhân
  // (ngày sinh, giới tính, địa chỉ, BHYT...) được lưu luôn vào hồ sơ bệnh nhân.
  async register(dto: any) {
    const { ho_ten, sdt, email, mat_khau, otp } = dto;
    if (!ho_ten || !mat_khau || (!sdt && !email))
      throw new BadRequestException('Thiếu thông tin bắt buộc');
    if (mat_khau.length < 6) throw new BadRequestException('Mật khẩu phải có ít nhất 6 ký tự');
    if (sdt && otpStore.get(sdt) !== otp)
      throw new BadRequestException('Mã OTP không đúng hoặc đã hết hạn');

    // Kiểm tra + whitelist thông tin hồ sơ trước khi tạo bất cứ bản ghi nào
    const hoSoData = chuanHoaHoSo({
      ho_ten, sdt,
      ngay_sinh: dto.ngay_sinh, gioi_tinh: dto.gioi_tinh,
      dia_chi: dto.dia_chi, so_bhyt: dto.so_bhyt,
    }, false);

    const existed = await this.users.findOne({ where: [{ sdt }, { email }] });
    if (existed) throw new BadRequestException('Số điện thoại hoặc email đã được đăng ký');

    const hash = await bcrypt.hash(mat_khau, 10);
    const user = await this.users.save(this.users.create({
      ho_ten, sdt, email, mat_khau_hash: hash, vai_tro: VaiTro.BENH_NHAN,
    }));
    await this.hoSo.save(this.hoSo.create({
      ...hoSoData,
      ma_benh_nhan: 'BN' + Date.now().toString().slice(-8),
      nguoi_dung: user,
    }));
    otpStore.delete(sdt);
    return this.sign(user);
  }

  async login(dto: any) {
    const { tai_khoan, mat_khau } = dto; // tai_khoan = sdt hoặc email
    const user = await this.users.findOne({ where: [{ sdt: tai_khoan }, { email: tai_khoan }] });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    if (!user.trang_thai) throw new UnauthorizedException('Tài khoản đã bị khóa');
    const ok = await bcrypt.compare(mat_khau, user.mat_khau_hash);
    if (!ok) throw new UnauthorizedException('Mật khẩu không đúng');
    return this.sign(user);
  }

  private sign(user: NguoiDung) {
    const payload = { sub: user.id, vai_tro: user.vai_tro, ho_ten: user.ho_ten };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, ho_ten: user.ho_ten, vai_tro: user.vai_tro, sdt: user.sdt, email: user.email },
    };
  }
}

@Controller('api/auth')
export class AuthController {
  constructor(private svc: AuthService) {}

  @Post('request-otp') requestOtp(@Body() b: any) { return this.svc.requestOtp(b.sdt); }
  @Post('register') register(@Body() b: any) { return this.svc.register(b); }
  @Post('login') login(@Body() b: any) { return this.svc.login(b); }

  @UseGuards(JwtAuthGuard)
  @Get('me') me(@Request() req) { return req.user; }
}
