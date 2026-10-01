import React, { useState, useEffect } from "react";
import { Stethoscope, Search, Save, RotateCcw, FileText, User, Activity } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  THÔNG TIN KHÁM BỆNH — mẫu bệnh án (màn hình HIS) cho lễ tân nhập.
//  Toàn bộ trường được lưu vào bảng phieu_kham_benh qua API:
//    POST /reception/exam-sheets            (tạo phiếu)
//    GET  /reception/exam-sheets            (danh sách gần đây)
//    GET  /reception/exam-sheets/:id        (xem lại 1 phiếu)
//    GET  /reception/patient-lookup?ma=     (điền nhanh từ hồ sơ có sẵn)
//  Lễ tân có thể tra cứu bệnh nhân sẵn có để liên kết phiếu vào hồ sơ (ho_so_id).
// ============================================================================

const inp = { ...input, padding: "10px 12px", fontSize: 14, borderRadius: 10 };
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };

// Tính tuổi theo ngày sinh (năm)
function tinhTuoi(ngaySinh) {
  if (!ngaySinh) return "";
  const d = new Date(ngaySinh); if (isNaN(d)) return "";
  const now = new Date();
  let t = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) t--;
  return t >= 0 && t < 200 ? String(t) : "";
}
// Tính BMI = cân nặng(kg) / (chiều cao(m))^2
function tinhBMI(cao, nang) {
  const c = parseFloat(cao), n = parseFloat(nang);
  if (!c || !n) return "";
  const m = c / 100;
  const b = n / (m * m);
  return isFinite(b) ? b.toFixed(1) : "";
}

const EMPTY = {
  ho_so_id: "", ma_kcb: "", so_benh_an: "", ngay_dk: "",
  noi_tru: false, dtnt: false, dkrv: false, ttrv: false, chuyen_vien: false, cap_cuu: false,
  ten_bn: "", gioi_tinh: "", ngay_sinh: "", tuoi: "", dan_toc: "", dia_chi: "", nghe_nghiep: "",
  doi_tuong: "", so_the: "", ky_hieu: "", han_the: "", ty_le_the: "", dia_chi_the: "", noi_dk_kcb: "", noi_cap: "",
  ngay_vao: "", buong: "", giuong: "",
  kham_lai: false, nho_kham: false, hoan_kham: false,
  ngay_kham: "", bs_kham: "", chuyen_khoa: "", cdtt: "", ghi_chu: "", trieu_chung: "", chan_doan_so_bo: "", ghi_chu_kb: "", ket_luan: "",
  huyet_ap: "", mach: "", nhiet_do: "", nhip_tho: "", chieu_cao: "", can_nang: "", bmi: "", spo2: "", vong_2: "",
  ten_benh: "", ma_icd: "", dien_giai: "",
};

// Field/Section phải nằm ngoài component chính, nếu không mỗi lần gõ phím sẽ bị tạo lại và ô nhập mất focus
const Field = ({ label, children, span }) => (
  <label style={{ display: "block", gridColumn: span ? `span ${span}` : undefined }}>
    <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</span>
    {children}
  </label>
);
const Section = ({ icon: Icon, title, cols = 3, children }) => (
  <Card style={{ padding: 20, marginBottom: 16 }}>
    <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8 }}>
      {Icon && <Icon size={17} color={T.gold} />} {title}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }} className="grid3">{children}</div>
  </Card>
);

export default function ThongTinBenhNhan() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [f, setF] = useState(EMPTY);
  const [ma, setMa] = useState("");
  const [msg, setMsg] = useState(null);      // { type: "ok"|"err", text }
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [list, setList] = useState([]);

  const set = (k, v) => setF((s) => {
    const next = { ...s, [k]: v };
    if (k === "ngay_sinh") next.tuoi = tinhTuoi(v);
    if (k === "chieu_cao" || k === "can_nang") next.bmi = tinhBMI(k === "chieu_cao" ? v : s.chieu_cao, k === "can_nang" ? v : s.can_nang);
    return next;
  });

  const loadList = () => { if (live) api.examSheets().then((r) => setList(Array.isArray(r) ? r : [])).catch(() => {}); };
  useEffect(loadList, [live]);

  const traCuu = async () => {
    const q = ma.trim(); setMsg(null);
    if (!q) return;
    setLooking(true);
    try {
      const r = await api.lookupPatientInfo(q);
      setF((s) => ({ ...s, ho_so_id: r.ho_so_id || "", ten_bn: r.ten_bn || s.ten_bn,
        gioi_tinh: r.gioi_tinh || s.gioi_tinh, ngay_sinh: r.ngay_sinh || s.ngay_sinh,
        tuoi: r.ngay_sinh ? tinhTuoi(r.ngay_sinh) : s.tuoi,
        dia_chi: r.dia_chi || s.dia_chi, so_the: r.so_the || s.so_the }));
      setMsg({ type: "ok", text: `Đã điền thông tin bệnh nhân ${r.ma_benh_nhan} vào phiếu.` });
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setLooking(false); }
  };

  const luu = async () => {
    setMsg(null);
    if (!f.ten_bn.trim()) { setMsg({ type: "err", text: "Vui lòng nhập Tên bệnh nhân." }); return; }
    setSaving(true);
    try {
      const r = await api.createExamSheet(f);
      setMsg({ type: "ok", text: `Đã lưu phiếu khám #${r.id} cho ${r.ten_bn} vào cơ sở dữ liệu.` });
      setF(EMPTY); setMa(""); loadList();
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setSaving(false); }
  };

  const xem = async (id) => {
    setMsg(null);
    try {
      const r = await api.examSheet(id);
      const next = { ...EMPTY };
      for (const k of Object.keys(EMPTY)) if (r[k] !== undefined && r[k] !== null) next[k] = r[k];
      next.ho_so_id = ""; // không gán lại liên kết khi chỉ xem
      setF(next);
      setMsg({ type: "ok", text: `Đang xem phiếu #${id}. Nhấn "Làm mới" để nhập phiếu mới.` });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setMsg({ type: "err", text: e.message }); }
  };

  const ti = (k) => ({ style: inp, value: f[k] || "", onChange: (e) => set(k, e.target.value) });
  const Chk = ({ k, label }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: T.ink, cursor: "pointer", whiteSpace: "nowrap" }}>
      <input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} style={{ accentColor: T.gold, width: 16, height: 16 }} /> {label}
    </label>
  );
  if (!live) {
    return (
      <div>
        <PageTitle title="Thông tin khám bệnh" sub="Nhập mẫu bệnh án của bệnh nhân." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản lễ tân để nhập phiếu.</Card>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Thông tin khám bệnh" sub="Nhập mẫu bệnh án theo bệnh nhân — dữ liệu lưu trực tiếp vào hệ thống."
        action={<div style={{ display: "flex", gap: 10 }}>
          <Btn kind="ghost" onClick={() => { setF(EMPTY); setMa(""); setMsg(null); }}><RotateCcw size={15} /> Làm mới</Btn>
          <Btn kind="gold" disabled={saving} onClick={luu}><Save size={16} /> {saving ? "Đang lưu..." : "Lưu phiếu"}</Btn>
        </div>} />

      {msg && <Card style={{ padding: 14, marginBottom: 16, border: "none", fontSize: 14,
        background: msg.type === "ok" ? T.mintSoft : "#FDECEA", color: msg.type === "ok" ? "#2F8F73" : "#C0392B" }}>{msg.text}</Card>}

      {/* Tra cứu để điền nhanh từ hồ sơ có sẵn */}
      <Card style={{ padding: 16, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13.5, color: T.sub, fontWeight: 700 }}>Điền nhanh từ hồ sơ:</span>
        <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 11, padding: "0 12px" }}>
          <Search size={17} color={T.sub} />
          <input value={ma} onChange={(e) => setMa(e.target.value)} onKeyDown={(e) => e.key === "Enter" && traCuu()} placeholder="Nhập mã bệnh nhân (BN...) hoặc số điện thoại" style={{ flex: 1, border: "none", outline: "none", padding: "11px 0", fontSize: 14.5, fontFamily: "inherit", background: "transparent" }} />
        </div>
        <Btn kind="ghost" disabled={looking} onClick={traCuu}>{looking ? "Đang tìm..." : "Tra cứu"}</Btn>
        {f.ho_so_id && <Pill tone={T.mint} soft={T.mintSoft}>Đã liên kết hồ sơ #{f.ho_so_id}</Pill>}
      </Card>

      <Section icon={FileText} title="Hành chính">
        <Field label="Mã KCB (F5)"><input {...ti("ma_kcb")} /></Field>
        <Field label="Số bệnh án"><input {...ti("so_benh_an")} /></Field>
        <Field label="Ngày ĐK"><input type="date" {...ti("ngay_dk")} /></Field>
        <Field label="Đối tượng / hình thức" span={3}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 6 }}>
            <Chk k="noi_tru" label="Nội trú" /><Chk k="dtnt" label="ĐTNT" /><Chk k="dkrv" label="ĐKRV" />
            <Chk k="ttrv" label="TTRV" /><Chk k="chuyen_vien" label="Chuyển viện" /><Chk k="cap_cuu" label="Cấp cứu" />
          </div>
        </Field>
      </Section>

      <Section icon={User} title="Thông tin bệnh nhân">
        <Field label="Tên bệnh nhân *" span={2}><input {...ti("ten_bn")} placeholder="Họ và tên" /></Field>
        <Field label="Giới tính">
          <select {...ti("gioi_tinh")}><option value="">—</option><option value="Nữ">Nữ</option><option value="Nam">Nam</option><option value="Khác">Khác</option></select>
        </Field>
        <Field label="Ngày sinh"><input type="date" {...ti("ngay_sinh")} /></Field>
        <Field label="Tuổi"><input {...ti("tuoi")} readOnly style={{ ...inp, background: T.bg }} /></Field>
        <Field label="Dân tộc"><input {...ti("dan_toc")} /></Field>
        <Field label="Địa chỉ" span={2}><input {...ti("dia_chi")} /></Field>
        <Field label="Nghề nghiệp"><input {...ti("nghe_nghiep")} /></Field>
      </Section>

      <Section icon={FileText} title="Bảo hiểm y tế">
        <Field label="Đối tượng"><input {...ti("doi_tuong")} /></Field>
        <Field label="Số thẻ"><input {...ti("so_the")} /></Field>
        <Field label="Ký hiệu (K?)"><input {...ti("ky_hieu")} /></Field>
        <Field label="Hạn thẻ"><input type="date" {...ti("han_the")} /></Field>
        <Field label="Tỷ lệ % thẻ"><input {...ti("ty_le_the")} /></Field>
        <Field label="Nơi cấp"><input {...ti("noi_cap")} /></Field>
        <Field label="Địa chỉ thẻ" span={2}><input {...ti("dia_chi_the")} /></Field>
        <Field label="Nơi đăng ký KCB"><input {...ti("noi_dk_kcb")} /></Field>
      </Section>

      <Section icon={FileText} title="Vào viện">
        <Field label="Ngày vào"><input type="date" {...ti("ngay_vao")} /></Field>
        <Field label="Buồng"><input {...ti("buong")} /></Field>
        <Field label="Giường"><input {...ti("giuong")} /></Field>
      </Section>

      <Section icon={Stethoscope} title="Thông tin khám bệnh">
        <Field label="Hình thức khám" span={3}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 6 }}>
            <Chk k="kham_lai" label="Khám lại" /><Chk k="nho_kham" label="Nhờ khám" /><Chk k="hoan_kham" label="Hoãn khám" />
          </div>
        </Field>
        <Field label="Ngày khám"><input type="date" {...ti("ngay_kham")} /></Field>
        <Field label="BS khám"><input {...ti("bs_kham")} /></Field>
        <Field label="Chuyên khoa"><input {...ti("chuyen_khoa")} /></Field>
        <Field label="CĐTT (chẩn đoán tuyến trước)" span={2}><input {...ti("cdtt")} /></Field>
        <Field label="Ghi chú"><input {...ti("ghi_chu")} /></Field>
        <Field label="Triệu chứng" span={3}><textarea {...ti("trieu_chung")} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <Field label="Chẩn đoán sơ bộ" span={3}><textarea {...ti("chan_doan_so_bo")} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <Field label="Ghi chú KB" span={2}><input {...ti("ghi_chu_kb")} /></Field>
        <Field label="Kết luận"><input {...ti("ket_luan")} /></Field>
      </Section>

      <Section icon={Activity} title="Chỉ số sinh tồn" cols={4}>
        <Field label="Huyết áp (mmHg)"><input {...ti("huyet_ap")} placeholder="120/80" /></Field>
        <Field label="Mạch (L/P)"><input {...ti("mach")} /></Field>
        <Field label="Nhiệt độ (°C)"><input {...ti("nhiet_do")} /></Field>
        <Field label="Nhịp thở (L/P)"><input {...ti("nhip_tho")} /></Field>
        <Field label="Chiều cao (cm)"><input {...ti("chieu_cao")} /></Field>
        <Field label="Cân nặng (Kg)"><input {...ti("can_nang")} /></Field>
        <Field label="BMI (Kg/m²)"><input {...ti("bmi")} readOnly style={{ ...inp, background: T.bg }} /></Field>
        <Field label="SPO2 (%)"><input {...ti("spo2")} /></Field>
        <Field label="Vòng 2 (cm)"><input {...ti("vong_2")} /></Field>
      </Section>

      <Section icon={FileText} title="Chẩn đoán">
        <Field label="Mã ICD"><input {...ti("ma_icd")} /></Field>
        <Field label="Tên bệnh" span={2}><input {...ti("ten_benh")} /></Field>
        <Field label="Diễn giải" span={3}><textarea {...ti("dien_giai")} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
      </Section>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 30 }}>
        <Btn kind="gold" disabled={saving} onClick={luu}><Save size={16} /> {saving ? "Đang lưu..." : "Lưu phiếu vào hệ thống"}</Btn>
      </div>

      {/* Phiếu đã nhập gần đây */}
      {list.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15 }}>Phiếu đã nhập gần đây</div>
          <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.6fr 1fr 1.4fr 1.2fr 0.7fr", gap: 12, padding: "12px 20px", background: T.bg, fontSize: 12.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .5 }} className="tableHead">
            <span>Mã KCB</span><span>Bệnh nhân</span><span>Chuyên khoa</span><span>Chẩn đoán sơ bộ</span><span>Thời gian</span><span></span>
          </div>
          {list.map((p, i) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "0.6fr 1.6fr 1fr 1.4fr 1.2fr 0.7fr", gap: 12, padding: "12px 20px", borderBottom: i < list.length - 1 ? `1px solid ${T.line}55` : "none", alignItems: "center", fontSize: 13.5 }} className="tableRow">
              <span style={{ fontWeight: 700, color: T.ink }}>{p.ma_kcb || `#${p.id}`}</span>
              <span style={{ color: T.ink }}>{p.ten_bn}{p.ma_benh_nhan ? ` · ${p.ma_benh_nhan}` : ""}</span>
              <span style={{ color: T.sub }}>{p.chuyen_khoa || "—"}</span>
              <span style={{ color: T.sub }}>{p.chan_doan_so_bo || "—"}</span>
              <span style={{ color: T.sub }}>{fmtNgay(p.ngay_tao)}</span>
              <Btn kind="ghost" size="sm" onClick={() => xem(p.id)}>Xem</Btn>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
