-- =====================================================================
--  CSDL Bệnh viện Phụ sản Hải Phòng (PostgreSQL)
-- =====================================================================
DROP TABLE IF EXISTS ho_so_benh_an, lich_hen, khung_gio, benh_nhan, bac_si, tin_tuc, nguoi_dung, khoa CASCADE;

CREATE TABLE khoa (
  id SERIAL PRIMARY KEY,
  ma VARCHAR(20) UNIQUE NOT NULL,          -- san / phu / ivf / sosinh
  ten_khoa VARCHAR(120) NOT NULL,
  mo_ta TEXT,
  vi_tri VARCHAR(120)
);

CREATE TABLE nguoi_dung (
  id SERIAL PRIMARY KEY,
  tai_khoan VARCHAR(120) UNIQUE NOT NULL,  -- SĐT (bệnh nhân) hoặc email (nhân viên)
  mat_khau_hash VARCHAR(200) NOT NULL,     -- bcrypt
  ho_ten VARCHAR(120) NOT NULL,
  vai_tro VARCHAR(20) NOT NULL DEFAULT 'patient',  -- patient | doctor | admin
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bac_si (
  id SERIAL PRIMARY KEY,
  nguoi_dung_id INT REFERENCES nguoi_dung(id),
  khoa_id INT REFERENCES khoa(id),
  ho_ten VARCHAR(120) NOT NULL,
  chuyen_mon VARCHAR(120),
  hoc_ham VARCHAR(60),
  so_nam_kn INT DEFAULT 0,
  danh_gia NUMERIC(2,1) DEFAULT 4.5
);

-- Hồ sơ bệnh nhân — do tiếp đón / bác sĩ tạo, hoặc gắn với tài khoản tự đăng ký
CREATE TABLE benh_nhan (
  id SERIAL PRIMARY KEY,
  nguoi_dung_id INT REFERENCES nguoi_dung(id),  -- NULL nếu chưa có tài khoản
  ma_benh_nhan VARCHAR(20) UNIQUE NOT NULL,     -- BN000001
  ho_ten VARCHAR(120) NOT NULL,
  ngay_sinh DATE,
  gioi_tinh VARCHAR(10) DEFAULT 'Nữ',
  sdt VARCHAR(20),
  cccd VARCHAR(20),
  so_bhyt VARCHAR(30),
  dia_chi TEXT,
  nhom_mau VARCHAR(5),
  di_ung TEXT,                                   -- dị ứng thuốc/thức ăn
  tien_su_benh TEXT,                             -- tiền sử bệnh
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE khung_gio (
  id SERIAL PRIMARY KEY,
  bac_si_id INT REFERENCES bac_si(id),
  ngay DATE NOT NULL,
  gio_bat_dau VARCHAR(5) NOT NULL,
  da_dat BOOLEAN DEFAULT false,
  UNIQUE (bac_si_id, ngay, gio_bat_dau)
);

CREATE TABLE lich_hen (
  id SERIAL PRIMARY KEY,
  ma_lich_hen VARCHAR(12) UNIQUE NOT NULL,
  benh_nhan_id INT REFERENCES benh_nhan(id) ON DELETE CASCADE,
  khoa_id INT REFERENCES khoa(id),
  khung_gio_id INT REFERENCES khung_gio(id),
  ly_do TEXT,
  trang_thai VARCHAR(20) DEFAULT 'cho_xac_nhan', -- cho_xac_nhan|da_xac_nhan|da_checkin|da_kham|da_huy
  so_thu_tu INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hồ sơ bệnh án — mỗi lượt khám 1 bản ghi
CREATE TABLE ho_so_benh_an (
  id SERIAL PRIMARY KEY,
  benh_nhan_id INT REFERENCES benh_nhan(id) ON DELETE CASCADE NOT NULL,
  bac_si_id INT REFERENCES bac_si(id),
  lich_hen_id INT REFERENCES lich_hen(id) ON DELETE SET NULL,
  ngay_kham DATE DEFAULT CURRENT_DATE,
  trieu_chung TEXT,          -- triệu chứng / lý do khám
  chan_doan TEXT,            -- chẩn đoán
  chi_dinh TEXT,             -- chỉ định cận lâm sàng (siêu âm, xét nghiệm...)
  don_thuoc TEXT,            -- đơn thuốc
  ghi_chu TEXT,              -- dặn dò, hẹn tái khám
  huyet_ap VARCHAR(15),
  can_nang NUMERIC(5,1),
  tuan_thai INT,             -- với thai phụ
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tin_tuc (
  id SERIAL PRIMARY KEY,
  tieu_de VARCHAR(200) NOT NULL,
  the_loai VARCHAR(40),
  ngay_dang DATE DEFAULT CURRENT_DATE,
  phut_doc INT DEFAULT 5
);

CREATE INDEX idx_hsba_bn ON ho_so_benh_an(benh_nhan_id);
CREATE INDEX idx_lh_bn ON lich_hen(benh_nhan_id);
CREATE INDEX idx_kg_ngay ON khung_gio(bac_si_id, ngay);
