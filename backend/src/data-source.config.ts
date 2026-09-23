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
export const dbConfig = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'bv_phusan',
  entities: ENTITIES,
  // synchronize: tự tạo/cập nhật bảng theo entity — TIỆN cho phát triển.
  // Ở môi trường production nên đặt false và dùng migration.
  synchronize: process.env.DB_SYNC ? process.env.DB_SYNC === 'true' : true,
  logging: process.env.DB_LOGGING === 'true',
};
