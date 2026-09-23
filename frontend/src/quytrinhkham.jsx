import React, { useState, useEffect } from "react";
import {
  UserCheck, Activity, Stethoscope, FlaskConical, ClipboardCheck, Wallet,
  ArrowLeft, ChevronRight, CheckCircle2, Clock, User, Plus, Save, Search, Receipt, CircleDashed,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";
import { PaymentForm } from "./Billing";

// ============================================================================
//  QUY TRÌNH KHÁM 6 BƯỚC — theo mục 6 tài liệu thiết kế hệ thống:
//   B1 Tiếp đón → B2 Sinh hiệu → B3 Khám bác sĩ → B4 Cận lâm sàng
//   → B5 Kết luận → B6 Thanh toán
//  Một màn hình dùng chung cho lễ tân (B1, B2, B6) và bác sĩ (B2-B5);
//  backend kiểm tra quyền trên từng API — ẩn/hiện nút chỉ là hỗ trợ UX.
//  Dữ liệu: GET /encounters/today, GET /encounters/:id/flow + API từng bước.
// ============================================================================

const inp = { ...input, padding: "10px 12px", fontSize: 14, borderRadius: 10 };
const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const fmtNgayGio = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };

const STEPS = [
  { key: "b1_tiep_don", n: 1, label: "Tiếp đón", icon: UserCheck },
  { key: "b2_sinh_hieu", n: 2, label: "Sinh hiệu", icon: Activity },
  { key: "b3_kham", n: 3, label: "Khám bác sĩ", icon: Stethoscope },
  { key: "b4_cls", n: 4, label: "Cận lâm sàng", icon: FlaskConical },
  { key: "b5_ket_luan", n: 5, label: "Kết luận", icon: ClipboardCheck },
  { key: "b6_thanh_toan", n: 6, label: "Thanh toán", icon: Wallet },
];

// Trạng thái một bước -> đã xong chưa (để tô màu stepper)
const xong = (key, v) => {
  if (key === "b4_cls") return v === "xong" || v === "khong_co";
  if (key === "b6_thanh_toan") return v === "da_thanh_toan";
  return v === "xong";
};
const LOAI_CLS = { xet_nghiem: "Xét nghiệm", sieu_am: "Siêu âm", thu_thuat: "Thủ thuật" };
const PHAN_LOAI = { binh_thuong: { l: "Bình thường", tone: T.mint, soft: T.mintSoft }, theo_doi: { l: "Cần theo dõi", tone: "#B7791F", soft: T.goldSoft }, nguy_co_cao: { l: "Nguy cơ cao", tone: "#C0392B", soft: "#FDECEA" } };
const XU_TRI = { ke_don: "Kê đơn về nhà", hen_tai_kham: "Hẹn tái khám", de_nghi_nhap_vien: "Đề nghị nhập viện", ket_thuc: "Kết thúc khám" };

const Field = ({ label, span, children }) => (
  <label style={{ display: "block", gridColumn: span ? `span ${span}` : undefined }}>
    <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</span>
    {children}
  </label>
);
const KV = ({ k, v }) => v ? <div style={{ fontSize: 13.5, marginBottom: 6 }}><span style={{ color: T.sub }}>{k}: </span><span style={{ color: T.ink, whiteSpace: "pre-wrap" }}>{v}</span></div> : null;

export default function QuyTrinhKham() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [selected, setSelected] = useState(null);   // id lần khám đang mở

  if (!live) {
    return (<div><PageTitle title="Quy trình khám 6 bước" sub="Tiếp đón → Sinh hiệu → Khám → Cận lâm sàng → Kết luận → Thanh toán." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập để theo dõi quy trình khám.</Card></div>);
  }
  return selected
    ? <FlowDetail id={selected} onBack={() => setSelected(null)} />
    : <TodayList onOpen={setSelected} />;
}

// ---------- Danh sách lần khám hôm nay + tiến độ 6 bước ----------
function TodayList({ onOpen }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.encountersToday().then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); });
  }, []);

  const kw = q.trim().toLowerCase();
  const data = (list || []).filter((e) => !kw
    || (e.benh_nhan || "").toLowerCase().includes(kw)
    || (e.ma_lich_hen || "").toLowerCase().includes(kw)
    || (e.ma_benh_nhan || "").toLowerCase().includes(kw));

  return (
    <div>
      <PageTitle title="Quy trình khám 6 bước" sub="Các lần khám hôm nay — bấm vào một bệnh nhân để thao tác theo từng bước." />
      <Card style={{ padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <Search size={18} color={T.sub} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã lịch hẹn, mã bệnh nhân..." style={{ flex: 1, border: "none", outline: "none", fontSize: 14.5, fontFamily: "inherit", background: "transparent", padding: "6px 0" }} />
      </Card>
      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {!list && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải danh sách...</div>}
      {list && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Hôm nay chưa có lần khám nào{kw ? " khớp tìm kiếm" : ""}.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((e) => (
          <Card key={e.id} hover onClick={() => onOpen(e.id)} style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", cursor: "pointer" }}>
            <span style={{ width: 46, height: 46, borderRadius: 14, background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={21} /></span>
            <div style={{ flex: 1, minWidth: 170 }}>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{e.benh_nhan || "—"}{e.so_thu_tu ? <span style={{ color: T.sub, fontWeight: 600 }}> · STT #{e.so_thu_tu}</span> : null}</div>
              <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>{e.ma_lich_hen}{e.khoa ? ` · ${e.khoa}` : ""}{e.bac_si ? ` · ${e.bac_si}` : ""}{e.gio ? ` · ${e.gio}` : ""}</div>
            </div>
            {/* 6 chấm tiến độ */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {STEPS.map((s) => {
                const done = xong(s.key, e.buoc[s.key]);
                return <span key={s.key} title={`${s.n}. ${s.label}`} style={{ width: 22, height: 22, borderRadius: "50%", fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center", background: done ? T.mint : T.line, color: done ? "#fff" : T.sub }}>{s.n}</span>;
              })}
            </div>
            <ChevronRight size={18} color={T.sub} />
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Chi tiết một lần khám: stepper + panel từng bước ----------
function FlowDetail({ id, onBack }) {
  const role = (store.user && store.user.vai_tro) || "";
  const laLeTan = role === "le_tan" || role === "admin";
  const laBacSi = role === "bac_si" || role === "admin";
  const [flow, setFlow] = useState(null);
  const [tab, setTab] = useState(null);   // bước đang mở
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api.encounterFlow(id)
    .then((r) => {
      setFlow(r);
      // Mặc định mở bước đầu tiên chưa xong
      if (tab === null) {
        const next = STEPS.find((s) => !xong(s.key, r.buoc[s.key]));
        setTab(next ? next.n : 6);
      }
    })
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);

  if (err) return (<div><BackBtn onBack={onBack} /><Card style={{ padding: 20, background: "#FDECEA", border: "none", color: "#C0392B" }}>{err}</Card></div>);
  if (!flow) return (<div><BackBtn onBack={onBack} /><div style={{ color: T.sub }}>Đang tải quy trình khám...</div></div>);

  const lh = flow.lich_hen;
  const ok = (text) => { setMsg(text); load(); };

  return (
    <div>
      <BackBtn onBack={onBack} />
      <PageTitle title={lh.benh_nhan ? lh.benh_nhan.ho_ten : "Lần khám"} sub={`${lh.ma_lich_hen}${lh.benh_nhan && lh.benh_nhan.ma_benh_nhan ? ` · ${lh.benh_nhan.ma_benh_nhan}` : ""}${lh.khoa ? ` · ${lh.khoa}` : ""}${lh.bac_si ? ` · ${lh.bac_si}` : ""}${lh.ngay ? ` · ${lh.ngay} ${lh.gio || ""}` : ""}`} />
      {msg && <Card style={{ padding: 13, marginBottom: 14, border: "none", background: T.mintSoft, color: "#2F8F73", fontSize: 14 }}>{msg}</Card>}

      {/* Stepper 6 bước */}
      <Card style={{ padding: "14px 18px", marginBottom: 18, display: "flex", gap: 4, overflowX: "auto" }}>
        {STEPS.map((s, i) => {
          const done = xong(s.key, flow.buoc[s.key]);
          const on = tab === s.n;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <span style={{ alignSelf: "center", width: 18, height: 2, background: done ? T.mint : T.line, flexShrink: 0 }} />}
              <button onClick={() => setTab(s.n)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderRadius: 12, border: "none",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                background: on ? T.peach : done ? T.mintSoft : T.bg, color: on ? "#fff" : done ? T.mint : T.sub,
              }}>
                {done ? <CheckCircle2 size={15} /> : <s.icon size={15} />} {s.n}. {s.label}
              </button>
            </React.Fragment>
          );
        })}
      </Card>

      {tab === 1 && <Step1 flow={flow} laLeTan={laLeTan} onDone={ok} setErr={setMsg} />}
      {tab === 2 && <Step2 flow={flow} canEdit={laLeTan || laBacSi} onDone={ok} />}
      {tab === 3 && <Step3 flow={flow} canEdit={laBacSi} onDone={ok} />}
      {tab === 4 && <Step4 flow={flow} canEdit={laBacSi} onDone={ok} />}
      {tab === 5 && <Step5 flow={flow} canEdit={laBacSi} onDone={ok} />}
      {tab === 6 && <Step6 flow={flow} laLeTan={laLeTan} onDone={ok} />}
    </div>
  );
}

const BackBtn = ({ onBack }) => (
  <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontFamily: "inherit" }}>
    <ArrowLeft size={16} /> Danh sách lần khám hôm nay
  </button>
);

// ---------- B1: Tiếp đón ----------
function Step1({ flow, laLeTan, onDone }) {
  const lh = flow.lich_hen;
  const bn = lh.benh_nhan || {};
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const run = async (fn, text) => {
    setBusy(true); setErr(null);
    try { await fn(); onDone(text); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const st = flow.buoc.b1_tiep_don;
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 14 }}>Bước 1 — Tiếp đón & mở lượt khám</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, marginBottom: 16 }} className="grid3">
        <KV k="Bệnh nhân" v={bn.ho_ten} /><KV k="Mã bệnh nhân" v={bn.ma_benh_nhan} />
        <KV k="Ngày sinh" v={bn.ngay_sinh} /><KV k="Giới tính" v={bn.gioi_tinh} />
        <KV k="Số BHYT" v={bn.so_bhyt} /><KV k="Số thứ tự" v={lh.so_thu_tu ? `#${lh.so_thu_tu}` : null} />
      </div>
      {st === "xong" && <Pill tone={T.mint} soft={T.mintSoft}><CheckCircle2 size={13} /> Đã tiếp đón — bệnh nhân đã check-in{lh.so_thu_tu ? `, STT #${lh.so_thu_tu}` : ""}</Pill>}
      {st === "da_huy" && <Pill tone="#C0392B" soft="#FDECEA">Lịch hẹn đã hủy</Pill>}
      {(st === "cho" || st === "da_xac_nhan") && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Pill tone={T.gold} soft={T.goldSoft}><Clock size={13} /> {st === "cho" ? "Chờ xác nhận lịch hẹn" : "Đã xác nhận — chờ check-in"}</Pill>
          {laLeTan && st === "cho" && <Btn kind="mint" size="sm" disabled={busy} onClick={() => run(() => api.confirmAppt(lh.id), "Đã xác nhận lịch hẹn.")}>Xác nhận lịch</Btn>}
          {laLeTan && <Btn kind="gold" size="sm" disabled={busy} onClick={() => run(() => api.checkin(lh.id), "Đã check-in, cấp số thứ tự.")}><UserCheck size={15} /> Check-in & cấp số</Btn>}
          {!laLeTan && <span style={{ fontSize: 13, color: T.sub }}>Lễ tân thực hiện xác nhận và check-in.</span>}
        </div>
      )}
      {err && <div style={{ marginTop: 12, background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12 }}>{err}</div>}
    </Card>
  );
}

// ---------- B2: Sinh hiệu ----------
function Step2({ flow, canEdit, onDone }) {
  const sh = flow.sinh_hieu;
  const [f, setF] = useState({
    huyet_ap: (sh && sh.huyet_ap) || "", mach: (sh && sh.mach) || "", nhiet_do: (sh && sh.nhiet_do) || "",
    nhip_tho: (sh && sh.nhip_tho) || "", spo2: (sh && sh.spo2) || "", chieu_cao: (sh && sh.chieu_cao) || "",
    can_nang: (sh && sh.can_nang) || "", phan_loai: (sh && sh.phan_loai) || "binh_thuong", ghi_chu: (sh && sh.ghi_chu) || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const cao = parseFloat(f.chieu_cao), nang = parseFloat(f.can_nang);
  const bmi = cao > 0 && nang > 0 ? (nang / Math.pow(cao / 100, 2)).toFixed(1) : "";

  const save = async () => {
    setBusy(true); setErr(null);
    try { await api.saveVitals(flow.lich_hen.id, f); onDone("Đã lưu sinh hiệu."); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const pl = PHAN_LOAI[f.phan_loai] || PHAN_LOAI.binh_thuong;

  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>Bước 2 — Sàng lọc & sinh hiệu</div>
        {sh && <span style={{ fontSize: 12.5, color: T.sub }}>Đo lần cuối: {fmtNgayGio(sh.thoi_gian)}{sh.nguoi_do ? ` · ${sh.nguoi_do}` : ""}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="grid3">
        <Field label="Huyết áp (mmHg)"><input style={inp} value={f.huyet_ap} onChange={set("huyet_ap")} placeholder="120/80" disabled={!canEdit} /></Field>
        <Field label="Mạch (L/P)"><input style={inp} value={f.mach} onChange={set("mach")} disabled={!canEdit} /></Field>
        <Field label="Nhiệt độ (°C)"><input style={inp} value={f.nhiet_do} onChange={set("nhiet_do")} disabled={!canEdit} /></Field>
        <Field label="Nhịp thở (L/P)"><input style={inp} value={f.nhip_tho} onChange={set("nhip_tho")} disabled={!canEdit} /></Field>
        <Field label="SpO2 (%)"><input style={inp} value={f.spo2} onChange={set("spo2")} disabled={!canEdit} /></Field>
        <Field label="Chiều cao (cm)"><input style={inp} value={f.chieu_cao} onChange={set("chieu_cao")} disabled={!canEdit} /></Field>
        <Field label="Cân nặng (kg)"><input style={inp} value={f.can_nang} onChange={set("can_nang")} disabled={!canEdit} /></Field>
        <Field label="BMI (tự tính)"><input style={{ ...inp, background: T.bg }} value={bmi} readOnly /></Field>
        <Field label="Phân loại nguy cơ" span={2}>
          <select style={inp} value={f.phan_loai} onChange={set("phan_loai")} disabled={!canEdit}>
            {Object.entries(PHAN_LOAI).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
        </Field>
        <Field label="Ghi chú" span={2}><input style={inp} value={f.ghi_chu} onChange={set("ghi_chu")} disabled={!canEdit} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
        <Pill tone={pl.tone} soft={pl.soft}><Activity size={13} /> {pl.l}</Pill>
        {canEdit && <Btn kind="mint" disabled={busy} onClick={save}><Save size={16} /> {busy ? "Đang lưu..." : sh ? "Cập nhật sinh hiệu" : "Lưu sinh hiệu"}</Btn>}
      </div>
      {err && <div style={{ marginTop: 12, background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12 }}>{err}</div>}
    </Card>
  );
}

// ---------- B3: Khám lâm sàng ----------
function Step3({ flow, canEdit, onDone }) {
  const k = flow.kham;
  const [f, setF] = useState({
    benh_su: (k && k.benh_su) || "", tien_su: (k && k.tien_su) || "", di_ung: (k && k.di_ung) || "",
    kham_thuc_the: (k && k.kham_thuc_the) || "", chan_doan_so_bo: (k && k.chan_doan_so_bo) || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value }));
  const ta = { ...inp, resize: "vertical" };
  const save = async () => {
    setBusy(true); setErr(null);
    try { await api.saveExam(flow.lich_hen.id, f); onDone("Đã lưu phiếu khám lâm sàng."); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>Bước 3 — Khám lâm sàng</div>
        {k && <span style={{ fontSize: 12.5, color: T.sub }}>Ghi lần cuối: {fmtNgayGio(k.thoi_gian)}{k.bac_si ? ` · ${k.bac_si}` : ""}</span>}
      </div>
      {!canEdit && !k && <div style={{ color: T.sub, fontSize: 14 }}>Bác sĩ chưa ghi phiếu khám cho lần khám này.</div>}
      {!canEdit && k && (
        <div>
          <KV k="Bệnh sử" v={k.benh_su} /><KV k="Tiền sử" v={k.tien_su} /><KV k="Dị ứng" v={k.di_ung} />
          <KV k="Khám thực thể" v={k.kham_thuc_the} /><KV k="Chẩn đoán sơ bộ" v={k.chan_doan_so_bo} />
        </div>
      )}
      {canEdit && (
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Bệnh sử"><textarea rows={2} style={ta} value={f.benh_su} onChange={set("benh_su")} placeholder="Diễn biến bệnh, lý do đến khám..." /></Field>
          <Field label="Tiền sử"><textarea rows={2} style={ta} value={f.tien_su} onChange={set("tien_su")} placeholder="PARA, tiền sử sản khoa, nội khoa, phẫu thuật..." /></Field>
          <Field label="Dị ứng"><input style={inp} value={f.di_ung} onChange={set("di_ung")} placeholder="Thuốc, thức ăn... (nếu có)" /></Field>
          <Field label="Khám thực thể"><textarea rows={3} style={ta} value={f.kham_thuc_the} onChange={set("kham_thuc_the")} placeholder="Toàn trạng, tim mạch, bụng, khám chuyên khoa..." /></Field>
          <Field label="Chẩn đoán sơ bộ"><input style={inp} value={f.chan_doan_so_bo} onChange={set("chan_doan_so_bo")} /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn kind="mint" disabled={busy} onClick={save}><Save size={16} /> {busy ? "Đang lưu..." : k ? "Cập nhật phiếu khám" : "Lưu phiếu khám"}</Btn>
          </div>
        </div>
      )}
      {err && <div style={{ marginTop: 12, background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12 }}>{err}</div>}
    </Card>
  );
}

// ---------- B4: Cận lâm sàng ----------
function Step4({ flow, canEdit, onDone }) {
  const ds = flow.chi_dinh || [];
  const [loai, setLoai] = useState("xet_nghiem");
  const [ten, setTen] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [openResult, setOpenResult] = useState(null); // id chỉ định đang nhập kết quả
  const [kq, setKq] = useState(""); const [klText, setKlText] = useState("");

  const them = async () => {
    if (!ten.trim()) { setErr("Nhập tên chỉ định."); return; }
    setBusy(true); setErr(null);
    try { await api.addOrder(flow.lich_hen.id, { loai, ten_chi_dinh: ten }); setTen(""); onDone("Đã thêm chỉ định."); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const luuKq = async (id) => {
    if (!kq.trim()) { setErr("Nhập nội dung kết quả."); return; }
    setBusy(true); setErr(null);
    try { await api.orderResult(id, { ket_qua: kq, ket_luan: klText }); setOpenResult(null); setKq(""); setKlText(""); onDone("Đã lưu kết quả cận lâm sàng."); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Card style={{ padding: 22 }}>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 14 }}>Bước 4 — Chỉ định cận lâm sàng & kết quả</div>
      {canEdit && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <select style={{ ...inp, width: "auto" }} value={loai} onChange={(e) => setLoai(e.target.value)}>
            {Object.entries(LOAI_CLS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input style={{ ...inp, flex: 1, minWidth: 200 }} value={ten} onChange={(e) => setTen(e.target.value)} onKeyDown={(e) => e.key === "Enter" && them()} placeholder="VD: Siêu âm thai 4D, BhCG, Công thức máu..." />
          <Btn kind="lav" disabled={busy} onClick={them}><Plus size={15} /> Thêm chỉ định</Btn>
        </div>
      )}
      {ds.length === 0 && <div style={{ padding: 24, textAlign: "center", color: T.sub, fontSize: 14, border: `1.5px dashed ${T.line}`, borderRadius: 12 }}>
        Chưa có chỉ định nào — nếu không cần cận lâm sàng, bác sĩ chuyển sang bước 5 Kết luận.
      </div>}
      <div style={{ display: "grid", gap: 10 }}>
        {ds.map((c) => (
          <div key={c.id} style={{ border: `1.5px solid ${T.line}`, borderRadius: 13, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Pill tone={T.lav} soft={T.lavSoft}>{LOAI_CLS[c.loai] || c.loai}</Pill>
              <b style={{ color: T.ink, fontSize: 14.5, flex: 1 }}>{c.ten_chi_dinh}</b>
              {c.trang_thai === "da_co_ket_qua"
                ? <Pill tone={T.mint} soft={T.mintSoft}><CheckCircle2 size={13} /> Đã có kết quả</Pill>
                : <Pill tone={T.gold} soft={T.goldSoft}><CircleDashed size={13} /> Chờ kết quả</Pill>}
              {canEdit && c.trang_thai !== "da_co_ket_qua" && openResult !== c.id &&
                <Btn kind="ghost" size="sm" onClick={() => { setOpenResult(c.id); setKq(""); setKlText(""); }}>Nhập kết quả</Btn>}
            </div>
            {c.ket_qua && <div style={{ marginTop: 10, fontSize: 13.5, color: T.ink, whiteSpace: "pre-wrap", background: T.bg, borderRadius: 10, padding: "10px 12px" }}>
              {c.ket_qua}{c.ket_luan ? <div style={{ marginTop: 6, color: T.sub }}>Kết luận: {c.ket_luan}</div> : null}
              <div style={{ marginTop: 6, fontSize: 12, color: T.sub }}>{c.nguoi_thuc_hien ? `${c.nguoi_thuc_hien} · ` : ""}{fmtNgayGio(c.ngay_ket_qua)}</div>
            </div>}
            {openResult === c.id && (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <textarea rows={3} style={{ ...inp, resize: "vertical" }} value={kq} onChange={(e) => setKq(e.target.value)} placeholder="Nội dung kết quả..." autoFocus />
                <input style={inp} value={klText} onChange={(e) => setKlText(e.target.value)} placeholder="Kết luận (không bắt buộc)" />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Btn kind="ghost" size="sm" onClick={() => setOpenResult(null)}>Hủy</Btn>
                  <Btn kind="mint" size="sm" disabled={busy} onClick={() => luuKq(c.id)}><Save size={14} /> Lưu kết quả</Btn>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {err && <div style={{ marginTop: 12, background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12 }}>{err}</div>}
    </Card>
  );
}

// ---------- B5: Kết luận ----------
function Step5({ flow, canEdit, onDone }) {
  const kl = flow.ket_luan;
  const [f, setF] = useState({
    chan_doan_chinh: (kl && kl.chan_doan_chinh) || "", ma_icd: (kl && kl.ma_icd) || "",
    chan_doan_phu: (kl && kl.chan_doan_phu) || "", huong_xu_tri: (kl && kl.huong_xu_tri) || "ke_don",
    don_thuoc: (kl && kl.don_thuoc) || "", loi_dan: (kl && kl.loi_dan) || "", ngay_tai_kham: (kl && kl.ngay_tai_kham) || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const clsChuaXong = flow.buoc.b4_cls === "cho_ket_qua";

  const save = async () => {
    setBusy(true); setErr(null);
    try { await api.saveConclusion(flow.lich_hen.id, f); onDone("Đã lưu kết luận — lần khám chuyển sang Đã khám, lễ tân có thể lập thanh toán."); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>Bước 5 — Kết luận & hướng xử trí</div>
        {kl && <span style={{ fontSize: 12.5, color: T.sub }}>Kết luận lúc: {fmtNgayGio(kl.thoi_gian)}{kl.bac_si ? ` · ${kl.bac_si}` : ""}</span>}
      </div>
      {clsChuaXong && <div style={{ marginBottom: 14, background: T.goldSoft, color: "#B7791F", fontSize: 13.5, padding: "10px 14px", borderRadius: 12 }}>
        Còn chỉ định cận lâm sàng chưa có kết quả — vẫn có thể kết luận nếu không cần chờ.
      </div>}
      {!canEdit && !kl && <div style={{ color: T.sub, fontSize: 14 }}>Bác sĩ chưa kết luận lần khám này.</div>}
      {!canEdit && kl && (
        <div>
          <KV k="Chẩn đoán chính" v={`${kl.chan_doan_chinh}${kl.ma_icd ? ` (${kl.ma_icd})` : ""}`} />
          <KV k="Chẩn đoán phụ" v={kl.chan_doan_phu} />
          <KV k="Hướng xử trí" v={XU_TRI[kl.huong_xu_tri] || kl.huong_xu_tri} />
          <KV k="Đơn thuốc" v={kl.don_thuoc} /><KV k="Lời dặn" v={kl.loi_dan} /><KV k="Ngày tái khám" v={kl.ngay_tai_kham} />
        </div>
      )}
      {canEdit && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="grid3">
          <Field label="Chẩn đoán chính *" span={2}><input style={inp} value={f.chan_doan_chinh} onChange={set("chan_doan_chinh")} /></Field>
          <Field label="Mã ICD"><input style={inp} value={f.ma_icd} onChange={set("ma_icd")} placeholder="VD: O26.9" /></Field>
          <Field label="Chẩn đoán phụ / phân biệt" span={3}><input style={inp} value={f.chan_doan_phu} onChange={set("chan_doan_phu")} /></Field>
          <Field label="Hướng xử trí">
            <select style={inp} value={f.huong_xu_tri} onChange={set("huong_xu_tri")}>
              {Object.entries(XU_TRI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Ngày tái khám"><input type="date" style={inp} value={f.ngay_tai_kham} onChange={set("ngay_tai_kham")} /></Field>
          <span />
          <Field label="Đơn thuốc" span={3}><textarea rows={3} style={{ ...inp, resize: "vertical" }} value={f.don_thuoc} onChange={set("don_thuoc")} placeholder={"Mỗi dòng một thuốc: tên — liều — cách dùng — số ngày"} /></Field>
          <Field label="Lời dặn" span={3}><input style={inp} value={f.loi_dan} onChange={set("loi_dan")} /></Field>
          <div style={{ gridColumn: "span 3", display: "flex", justifyContent: "flex-end" }}>
            <Btn kind="mint" disabled={busy} onClick={save}><ClipboardCheck size={16} /> {busy ? "Đang lưu..." : kl ? "Cập nhật kết luận" : "Kết luận & hoàn tất khám"}</Btn>
          </div>
        </div>
      )}
      {err && <div style={{ marginTop: 12, background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12 }}>{err}</div>}
    </Card>
  );
}

// ---------- B6: Thanh toán ----------
function Step6({ flow, laLeTan, onDone }) {
  const tt = flow.thanh_toan;
  const lh = flow.lich_hen;
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const daKham = flow.buoc.b5_ket_luan === "xong" || lh.trang_thai === "da_kham";

  const thu = async () => {
    setBusy(true); setErr(null);
    try { await api.payPayment(tt.id); onDone("Đã xác nhận thu tiền — hoàn tất quy trình khám."); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (creating) {
    return <PaymentForm
      appt={{ id: lh.id, ma_lich_hen: lh.ma_lich_hen, ho_so: { ho_ten: lh.benh_nhan ? lh.benh_nhan.ho_ten : "" } }}
      onBack={() => setCreating(false)}
      onDone={() => { setCreating(false); onDone("Đã lập hóa đơn dịch vụ."); }} />;
  }

  return (
    <Card style={{ padding: 22 }}>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 14 }}>Bước 6 — Viện phí & thanh toán</div>
      {!daKham && <div style={{ color: T.sub, fontSize: 14 }}>Chưa thể thanh toán — cần bác sĩ kết luận (bước 5) trước.</div>}
      {daKham && !tt && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Pill tone={T.gold} soft={T.goldSoft}><Clock size={13} /> Chưa lập hóa đơn dịch vụ</Pill>
          {laLeTan
            ? <Btn kind="gold" onClick={() => setCreating(true)}><Receipt size={16} /> Lập hóa đơn dịch vụ</Btn>
            : <span style={{ fontSize: 13, color: T.sub }}>Lễ tân lập hóa đơn và thu tiền.</span>}
        </div>
      )}
      {tt && (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <b style={{ color: T.ink }}>{tt.ma_thanh_toan}</b>
            {tt.trang_thai === "da_thanh_toan" && <Pill tone={T.mint} soft={T.mintSoft}><CheckCircle2 size={13} /> Đã thanh toán{tt.ngay_thanh_toan ? ` · ${fmtNgayGio(tt.ngay_thanh_toan)}` : ""}</Pill>}
            {tt.trang_thai === "cho_thanh_toan" && <Pill tone={T.gold} soft={T.goldSoft}><Clock size={13} /> Chờ thanh toán</Pill>}
            {tt.trang_thai === "da_huy" && <Pill tone="#C0392B" soft="#FDECEA">Đã hủy</Pill>}
          </div>
          <div style={{ border: `1.5px solid ${T.line}`, borderRadius: 13, overflow: "hidden", marginBottom: 14 }}>
            {(tt.chi_tiet || []).map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${T.line}55`, fontSize: 13.5 }}>
                <span style={{ color: T.ink }}>{c.ten_dich_vu}{c.so_luong > 1 ? ` ×${c.so_luong}` : ""}</span>
                <span style={{ fontWeight: 700, color: T.ink }}>{fmtVND(c.thanh_tien)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: T.mintSoft }}>
              <b style={{ color: T.ink }}>Tổng cộng</b><b style={{ color: T.mint, fontSize: 16 }}>{fmtVND(tt.tong_tien)}</b>
            </div>
          </div>
          {laLeTan && tt.trang_thai === "cho_thanh_toan" &&
            <Btn kind="mint" disabled={busy} onClick={thu}><Wallet size={16} /> {busy ? "Đang xử lý..." : "Xác nhận đã thu tiền"}</Btn>}
        </div>
      )}
      {err && <div style={{ marginTop: 12, background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12 }}>{err}</div>}
    </Card>
  );
}
