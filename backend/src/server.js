// =====================================================================
//  Backend — BV Phụ sản Hải Phòng (Express + PostgreSQL)
//  Chạy: npm run seed  (lần đầu)  →  npm run start:dev
// =====================================================================
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const SECRET = process.env.JWT_SECRET || "dev-secret";
const sign = (u) => jwt.sign({ id: u.id, vai_tro: u.vai_tro, ho_ten: u.ho_ten }, SECRET, { expiresIn: "12h" });

// ---------- middleware ----------
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Bạn cần đăng nhập" });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ message: "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại" }); }
}
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.vai_tro) ? next() : res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này" });

const genCode = (prefix, n = 6) => prefix + Array.from({ length: n }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");

// =====================================================================
//  AUTH — đăng ký / đăng nhập (mật khẩu bắt buộc, băm bcrypt)
// =====================================================================
const otpStore = new Map(); // demo OTP theo SĐT

app.post("/api/auth/request-otp", (req, res) => {
  const { sdt } = req.body;
  if (!sdt || !/^0\d{9}$/.test(sdt)) return res.status(400).json({ message: "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)" });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(sdt, { otp, exp: Date.now() + 5 * 60 * 1000 });
  res.json({ ok: true, otp_demo: otp }); // demo: trả OTP về luôn; thực tế gửi SMS
});

app.post("/api/auth/register", async (req, res) => {
  const { ho_ten, sdt, mat_khau, otp } = req.body;
  if (!ho_ten || !sdt || !mat_khau) return res.status(400).json({ message: "Vui lòng nhập đủ họ tên, số điện thoại và mật khẩu" });
  if (mat_khau.length < 6) return res.status(400).json({ message: "Mật khẩu tối thiểu 6 ký tự" });
  const saved = otpStore.get(sdt);
  if (!saved || saved.otp !== otp || saved.exp < Date.now()) return res.status(400).json({ message: "Mã OTP không đúng hoặc đã hết hạn" });

  const dup = await pool.query("SELECT id FROM nguoi_dung WHERE tai_khoan=$1", [sdt]);
  if (dup.rowCount) return res.status(409).json({ message: "Số điện thoại đã được đăng ký, hãy đăng nhập" });

  const hash = await bcrypt.hash(mat_khau, 10);
  const { rows: [u] } = await pool.query(
    "INSERT INTO nguoi_dung (tai_khoan, mat_khau_hash, ho_ten, vai_tro) VALUES ($1,$2,$3,'patient') RETURNING id, tai_khoan, ho_ten, vai_tro",
    [sdt, hash, ho_ten]);
  // tạo hồ sơ bệnh nhân gắn với tài khoản
  const { rows: [mx] } = await pool.query("SELECT COALESCE(MAX(id),0)+1 AS n FROM benh_nhan");
  await pool.query(
    "INSERT INTO benh_nhan (nguoi_dung_id, ma_benh_nhan, ho_ten, sdt) VALUES ($1,$2,$3,$4)",
    [u.id, "BN" + String(mx.n).padStart(6, "0"), ho_ten, sdt]);
  otpStore.delete(sdt);
  res.json({ access_token: sign(u), user: u });
});

app.post("/api/auth/login", async (req, res) => {
  const { tai_khoan, mat_khau } = req.body;
  if (!tai_khoan || !mat_khau) return res.status(400).json({ message: "Vui lòng nhập tài khoản và mật khẩu" });
  const { rows: [u] } = await pool.query("SELECT * FROM nguoi_dung WHERE tai_khoan=$1", [tai_khoan]);
  if (!u || !(await bcrypt.compare(mat_khau, u.mat_khau_hash)))
    return res.status(401).json({ message: "Tài khoản hoặc mật khẩu không đúng" });
  res.json({ access_token: sign(u), user: { id: u.id, tai_khoan: u.tai_khoan, ho_ten: u.ho_ten, vai_tro: u.vai_tro } });
});

// =====================================================================
//  DANH MỤC CÔNG KHAI
// =====================================================================
app.get("/api/departments", async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT k.*,
      (SELECT json_agg(b) FROM (SELECT id FROM bac_si WHERE khoa_id=k.id) b) AS bac_si
    FROM khoa k ORDER BY k.id`);
  res.json(rows);
});

app.get("/api/doctors", async (req, res) => {
  const { khoa } = req.query;
  const { rows } = await pool.query(`
    SELECT b.*, json_build_object('ma', k.ma, 'ten_khoa', k.ten_khoa) AS khoa
    FROM bac_si b JOIN khoa k ON k.id=b.khoa_id
    ${khoa ? "WHERE k.ma=$1" : ""} ORDER BY b.id`, khoa ? [khoa] : []);
  res.json(rows);
});

app.get("/api/slots", async (req, res) => {
  const { bacSi, ngay } = req.query;
  const { rows } = await pool.query(
    "SELECT id, gio_bat_dau, da_dat FROM khung_gio WHERE bac_si_id=$1 AND ngay=$2 ORDER BY gio_bat_dau", [bacSi, ngay]);
  res.json(rows);
});

app.get("/api/news", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM tin_tuc ORDER BY ngay_dang DESC");
  res.json(rows);
});

// =====================================================================
//  LỊCH HẸN
// =====================================================================
app.post("/api/appointments", auth, async (req, res) => {
  const { khung_gio_id, khoa_id, ly_do } = req.body;
  const { rows: [bn] } = await pool.query("SELECT id FROM benh_nhan WHERE nguoi_dung_id=$1", [req.user.id]);
  if (!bn) return res.status(400).json({ message: "Không tìm thấy hồ sơ bệnh nhân của tài khoản này" });

  const { rows: [kg] } = await pool.query("SELECT * FROM khung_gio WHERE id=$1 FOR UPDATE", [khung_gio_id]);
  if (!kg || kg.da_dat) return res.status(409).json({ message: "Khung giờ này vừa có người đặt, vui lòng chọn giờ khác" });

  await pool.query("UPDATE khung_gio SET da_dat=true WHERE id=$1", [khung_gio_id]);
  const { rows: [{ count }] } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM lich_hen l JOIN khung_gio g ON g.id=l.khung_gio_id WHERE g.ngay=$1 AND g.bac_si_id=$2 AND l.trang_thai<>'da_huy'",
    [kg.ngay, kg.bac_si_id]);
  const { rows: [lh] } = await pool.query(
    "INSERT INTO lich_hen (ma_lich_hen, benh_nhan_id, khoa_id, khung_gio_id, ly_do, trang_thai, so_thu_tu) VALUES ($1,$2,$3,$4,$5,'da_xac_nhan',$6) RETURNING *",
    [genCode("BV"), bn.id, khoa_id, khung_gio_id, ly_do || null, count + 1]);
  res.json(lh);
});

app.get("/api/appointments/me", auth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT l.*, json_build_object('ten_khoa', k.ten_khoa) AS khoa,
      json_build_object('ngay', to_char(g.ngay,'DD/MM/YYYY'), 'gio_bat_dau', g.gio_bat_dau,
        'bac_si', json_build_object('ho_ten', b.ho_ten)) AS khung_gio
    FROM lich_hen l
    JOIN benh_nhan bn ON bn.id=l.benh_nhan_id
    LEFT JOIN khoa k ON k.id=l.khoa_id
    LEFT JOIN khung_gio g ON g.id=l.khung_gio_id
    LEFT JOIN bac_si b ON b.id=g.bac_si_id
    WHERE bn.nguoi_dung_id=$1 ORDER BY l.created_at DESC`, [req.user.id]);
  res.json(rows);
});

app.patch("/api/appointments/:id/cancel", auth, async (req, res) => {
  const { rows: [lh] } = await pool.query(`
    UPDATE lich_hen SET trang_thai='da_huy' WHERE id=$1
      AND benh_nhan_id=(SELECT id FROM benh_nhan WHERE nguoi_dung_id=$2) RETURNING khung_gio_id`,
    [req.params.id, req.user.id]);
  if (!lh) return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });
  await pool.query("UPDATE khung_gio SET da_dat=false WHERE id=$1", [lh.khung_gio_id]);
  res.json({ ok: true });
});

// =====================================================================
//  BỆNH NHÂN — thêm mới / tra cứu (tiếp đón, bác sĩ, admin)
// =====================================================================
app.get("/api/patients", auth, requireRole("doctor", "admin"), async (req, res) => {
  const q = (req.query.q || "").trim();
  const { rows } = await pool.query(`
    SELECT * FROM benh_nhan
    ${q ? "WHERE ho_ten ILIKE $1 OR sdt LIKE $1 OR ma_benh_nhan ILIKE $1" : ""}
    ORDER BY created_at DESC LIMIT 100`, q ? [`%${q}%`] : []);
  res.json(rows);
});

app.post("/api/patients", auth, requireRole("doctor", "admin"), async (req, res) => {
  const { ho_ten, ngay_sinh, gioi_tinh, sdt, cccd, so_bhyt, dia_chi, nhom_mau, di_ung, tien_su_benh } = req.body;
  if (!ho_ten) return res.status(400).json({ message: "Họ tên là bắt buộc" });
  if (sdt && !/^0\d{9}$/.test(sdt)) return res.status(400).json({ message: "Số điện thoại không hợp lệ" });
  const { rows: [mx] } = await pool.query("SELECT COALESCE(MAX(id),0)+1 AS n FROM benh_nhan");
  const { rows: [bn] } = await pool.query(`
    INSERT INTO benh_nhan (ma_benh_nhan, ho_ten, ngay_sinh, gioi_tinh, sdt, cccd, so_bhyt, dia_chi, nhom_mau, di_ung, tien_su_benh)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    ["BN" + String(mx.n).padStart(6, "0"), ho_ten, ngay_sinh || null, gioi_tinh || "Nữ",
     sdt || null, cccd || null, so_bhyt || null, dia_chi || null, nhom_mau || null, di_ung || null, tien_su_benh || null]);
  res.json(bn);
});

app.get("/api/patients/:id", auth, requireRole("doctor", "admin"), async (req, res) => {
  const { rows: [bn] } = await pool.query("SELECT * FROM benh_nhan WHERE id=$1", [req.params.id]);
  if (!bn) return res.status(404).json({ message: "Không tìm thấy bệnh nhân" });
  res.json(bn);
});

app.delete("/api/patients/:id", auth, requireRole("doctor", "admin"), async (req, res) => {
  const { rows: [bn] } = await pool.query("SELECT id, ho_ten FROM benh_nhan WHERE id=$1", [req.params.id]);
  if (!bn) return res.status(404).json({ message: "Không tìm thấy bệnh nhân" });
  // ON DELETE CASCADE trong schema sẽ tự xóa bệnh án & lịch hẹn liên quan
  await pool.query("DELETE FROM benh_nhan WHERE id=$1", [req.params.id]);
  res.json({ deleted: true, id: bn.id });
});

// =====================================================================
//  HỒ SƠ BỆNH ÁN
// =====================================================================
app.post("/api/records", auth, requireRole("doctor", "admin"), async (req, res) => {
  const { benh_nhan_id, lich_hen_id, trieu_chung, chan_doan, chi_dinh, don_thuoc, ghi_chu, huyet_ap, can_nang, tuan_thai } = req.body;
  if (!benh_nhan_id || !chan_doan) return res.status(400).json({ message: "Cần chọn bệnh nhân và nhập chẩn đoán" });
  const { rows: [bs] } = await pool.query("SELECT id FROM bac_si WHERE nguoi_dung_id=$1", [req.user.id]);
  const { rows: [hs] } = await pool.query(`
    INSERT INTO ho_so_benh_an (benh_nhan_id, bac_si_id, lich_hen_id, trieu_chung, chan_doan, chi_dinh, don_thuoc, ghi_chu, huyet_ap, can_nang, tuan_thai)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [benh_nhan_id, bs ? bs.id : null, lich_hen_id || null, trieu_chung || null, chan_doan,
     chi_dinh || null, don_thuoc || null, ghi_chu || null, huyet_ap || null, can_nang || null, tuan_thai || null]);
  if (lich_hen_id) await pool.query("UPDATE lich_hen SET trang_thai='da_kham' WHERE id=$1", [lich_hen_id]);
  res.json(hs);
});

// Bác sĩ/Admin xem theo bệnh nhân
app.get("/api/records", auth, requireRole("doctor", "admin"), async (req, res) => {
  const { patient } = req.query;
  if (!patient) return res.status(400).json({ message: "Thiếu tham số patient" });
  const { rows } = await pool.query(`
    SELECT h.*, b.ho_ten AS bac_si_ten FROM ho_so_benh_an h
    LEFT JOIN bac_si b ON b.id=h.bac_si_id
    WHERE h.benh_nhan_id=$1 ORDER BY h.ngay_kham DESC, h.id DESC`, [patient]);
  res.json(rows);
});

// Bệnh nhân xem hồ sơ của chính mình
app.get("/api/records/me", auth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT h.*, b.ho_ten AS bac_si_ten FROM ho_so_benh_an h
    JOIN benh_nhan bn ON bn.id=h.benh_nhan_id
    LEFT JOIN bac_si b ON b.id=h.bac_si_id
    WHERE bn.nguoi_dung_id=$1 ORDER BY h.ngay_kham DESC, h.id DESC`, [req.user.id]);
  res.json(rows);
});

// =====================================================================
//  BÁO CÁO (ADMIN)
// =====================================================================
app.get("/api/admin/reports", auth, requireRole("admin"), async (_req, res) => {
  const [{ rows: [a] }, { rows: [b] }, { rows: [c] }, { rows: [d] }] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS n FROM benh_nhan"),
    pool.query("SELECT COUNT(*)::int AS n FROM lich_hen WHERE trang_thai<>'da_huy'"),
    pool.query("SELECT COUNT(*)::int AS n FROM ho_so_benh_an"),
    pool.query("SELECT COUNT(*)::int AS n FROM bac_si"),
  ]);
  res.json({ benh_nhan: a.n, lich_hen: b.n, ho_so: c.n, bac_si: d.n });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Lỗi máy chủ, vui lòng thử lại" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend chạy tại http://localhost:${PORT} (PostgreSQL)`));
