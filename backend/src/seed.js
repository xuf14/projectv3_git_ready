// Nạp dữ liệu mẫu: npm run seed
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("→ Tạo bảng...");
  await pool.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

  console.log("→ Khoa phòng...");
  const { rows: khoas } = await pool.query(`
    INSERT INTO khoa (ma, ten_khoa, mo_ta, vi_tri) VALUES
    ('san','Khoa Sản','Theo dõi thai kỳ, sinh thường & sinh mổ, chăm sóc sau sinh.','Tầng 2, Nhà A'),
    ('phu','Khoa Phụ','Khám và điều trị bệnh lý phụ khoa, tầm soát ung thư cổ tử cung.','Tầng 3, Nhà A'),
    ('ivf','Hỗ trợ sinh sản (IVF)','Tư vấn hiếm muộn, thụ tinh ống nghiệm, bơm tinh trùng (IUI).','Tầng 1, Nhà B'),
    ('sosinh','Sơ sinh','Chăm sóc & hồi sức sơ sinh, sàng lọc sau sinh, tiêm chủng.','Tầng 1, Nhà C')
    RETURNING id, ma`);
  const K = Object.fromEntries(khoas.map((k) => [k.ma, k.id]));

  console.log("→ Tài khoản demo (mật khẩu: 123456)...");
  const hash = await bcrypt.hash("123456", 10);
  const mkUser = async (tk, ten, role) =>
    (await pool.query("INSERT INTO nguoi_dung (tai_khoan, mat_khau_hash, ho_ten, vai_tro) VALUES ($1,$2,$3,$4) RETURNING id", [tk, hash, ten, role])).rows[0].id;

  const uBn = await mkUser("benhnhan@demo.vn", "Nguyễn Thị Hoa", "patient");
  const uBs = await mkUser("bacsi@demo.vn", "BS.CKII Nguyễn Thị Lan", "doctor");
  await mkUser("admin@demo.vn", "Quản trị viên", "admin");

  console.log("→ Bác sĩ...");
  const docs = [
    [uBs, K.san, "BS.CKII Nguyễn Thị Lan", "Trưởng khoa Sản", "BS.CKII", 22, 4.9],
    [null, K.san, "BS.CKI Trần Văn Minh", "Bác sĩ Sản khoa", "BS.CKI", 12, 4.7],
    [null, K.phu, "TS.BS Phạm Thu Hà", "Phụ khoa", "TS.BS", 18, 4.8],
    [null, K.ivf, "BS.CKII Lê Hữu Phúc", "Trung tâm IVF", "BS.CKII", 15, 4.9],
    [null, K.sosinh, "BS.CKI Vũ Mai Anh", "Sơ sinh", "BS.CKI", 10, 4.6],
    [null, K.phu, "BS.CKI Đỗ Khánh Linh", "Phụ khoa", "BS.CKI", 9, 4.7],
  ];
  const bsIds = [];
  for (const d of docs)
    bsIds.push((await pool.query("INSERT INTO bac_si (nguoi_dung_id, khoa_id, ho_ten, chuyen_mon, hoc_ham, so_nam_kn, danh_gia) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", d)).rows[0].id);

  console.log("→ Khung giờ 14 ngày tới...");
  const gio = ["07:30","08:00","08:30","09:00","09:30","10:00","10:30","13:30","14:00","14:30","15:00","15:30"];
  for (const bs of bsIds)
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const ngay = d.toISOString().slice(0, 10);
      for (const g of gio)
        await pool.query("INSERT INTO khung_gio (bac_si_id, ngay, gio_bat_dau) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [bs, ngay, g]);
    }

  console.log("→ Bệnh nhân mẫu + hồ sơ bệnh án...");
  const { rows: [bn] } = await pool.query(`
    INSERT INTO benh_nhan (nguoi_dung_id, ma_benh_nhan, ho_ten, ngay_sinh, sdt, so_bhyt, dia_chi, nhom_mau, di_ung, tien_su_benh)
    VALUES ($1,'BN000001','Nguyễn Thị Hoa','1996-03-14','0901234567','HP4960123456789','Lê Chân, Hải Phòng','O','Không','Không có bệnh nền')
    RETURNING id`, [uBn]);
  await pool.query(`
    INSERT INTO ho_so_benh_an (benh_nhan_id, bac_si_id, trieu_chung, chan_doan, chi_dinh, don_thuoc, ghi_chu, huyet_ap, can_nang, tuan_thai)
    VALUES ($1,$2,'Khám thai định kỳ','Thai 28 tuần, phát triển bình thường','Siêu âm 4D, xét nghiệm nước tiểu','Sắt + acid folic 1v/ngày','Tái khám sau 2 tuần','110/70',58.5,28)`,
    [bn.id, bsIds[0]]);

  console.log("→ Tin tức...");
  await pool.query(`
    INSERT INTO tin_tuc (tieu_de, the_loai, ngay_dang, phut_doc) VALUES
    ('10 dấu hiệu chuyển dạ mẹ bầu cần biết','Cẩm nang','2026-06-24',5),
    ('Lịch khám thai theo yêu cầu dịp hè 2026','Thông báo','2026-06-20',3),
    ('Chế độ ăn cho mẹ trong tam cá nguyệt đầu','Dinh dưỡng','2026-06-18',7),
    ('Hành trình IVF: những điều nên chuẩn bị','Hiếm muộn','2026-06-15',8)`);

  console.log("✅ Seed xong. Tài khoản demo: benhnhan@demo.vn / bacsi@demo.vn / admin@demo.vn — mật khẩu 123456");
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
