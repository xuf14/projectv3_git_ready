import * as dotenv from 'dotenv';
dotenv.config(); // nạp biến từ file .env

import {
  NguoiDung, KhoaPhong, BacSi, DichVu, HoSoBenhNhan, KhungGio, LichHen, LuotKham, DonThuoc, TinTuc,
  NhatKyHoatDong, TaiLieuBenhAn, ThanhToan, ChiTietThanhToan, PhieuKhamBenh,
  PhieuYLenh, ChiTietYLenh, DienBienDieuTri, LanThuTienYLenh,
  SinhHieu, KhamLamSang, ChiDinhCLS, KetLuanKham, BaiTruyenThong, AnhTruyenThong,
} from './entities';

export const ENTITIES = [
  NguoiDung, KhoaPhong, BacSi, DichVu, HoSoBenhNhan, KhungGio, LichHen, LuotKham, DonThuoc, TinTuc,
  NhatKyHoatDong, TaiLieuBenhAn, ThanhToan, ChiTietThanhToan, PhieuKhamBenh,
  PhieuYLenh, ChiTietYLenh, DienBienDieuTri, LanThuTienYLenh,
  SinhHieu, KhamLamSang, ChiDinhCLS, KetLuanKham, BaiTruyenThong, AnhTruyenThong,
];

// Cấu hình kết nối PostgreSQL, đọc từ biến môi trường (.env).
// Mặc định phù hợp với cài đặt PostgreSQL cục bộ thông thường.
const url = process.env.DATABASE_URL;
const isProd = process.env.NODE_ENV === 'production';

export const dbConfig = {
  type: 'postgres' as const,
  ...(url
    ? { url }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'postgres',
        database: process.env.DB_NAME || 'bv_phusan',
      }),
  entities: ENTITIES,
  // Lần đầu deploy đặt DB_SYNC=true để tạo bảng, sau đó nên đặt false.
  synchronize: process.env.DB_SYNC ? process.env.DB_SYNC === 'true' : !isProd,
  logging: process.env.DB_LOGGING === 'true',
};
