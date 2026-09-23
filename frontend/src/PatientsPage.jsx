import React, { useState, useEffect, useMemo } from "react";
import {
  User, Filter, MoreHorizontal, ChevronLeft, ChevronRight, ArrowLeft, Clock, FileText,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, Avatar, SectionHead, PageTitle } from "./shared";

// ============================================================================
//  TRANG HỒ SƠ BỆNH NHÂN — file riêng, dùng chung cho cổng Bác sĩ và Lễ tân.
//  - Danh sách hồ sơ:          GET /patients                    (bac_si, le_tan, admin)
//  - Chọn một bệnh nhân → lịch khám của họ hiển thị trên CALENDAR theo từng
//    ngày, lấy từ database:    GET /patients/:id/appointments
// ============================================================================

export function tinhTuoi(ngaySinh) {
  if (!ngaySinh) return null;
  const d = new Date(ngaySinh);
  if (isNaN(d)) return null;
  const now = new Date();
  let t = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) t -= 1;
  return t;
}

export function mapHoSo(h) {
  return { dbId: h.id, code: h.ma_benh_nhan, name: h.ho_ten, age: tinhTuoi(h.ngay_sinh),
    phone: h.sdt || "—", visits: h.so_luot_dat || 0 };
}

// Mock dự phòng khi backend chưa chạy
const PATIENTS = [
  { code: "BN-08842", name: "Trần Mai Phương", age: 31, phone: "0912 345 678", visits: 8 },
  { code: "BN-08651", name: "Nguyễn Thị Hoa", age: 28, phone: "0987 654 321", visits: 3 },
  { code: "BN-08433", name: "Phạm Hồng Nhung", age: 34, phone: "0934 222 111", visits: 12 },
  { code: "BN-08120", name: "Lê Thị Thu", age: 26, phone: "0901 888 777", visits: 1 },
];

const TT_LICH = {
  cho_xac_nhan: { l: "Chờ xác nhận", tone: T.gold, soft: T.goldSoft },
  da_xac_nhan: { l: "Đã xác nhận", tone: T.sky, soft: T.skySoft },
  da_checkin: { l: "Đã check-in", tone: T.mint, soft: T.mintSoft },
  da_kham: { l: "Đã khám", tone: T.sub, soft: "#F0F0F2" },
  da_huy: { l: "Đã hủy", tone: "#C0392B", soft: "#FDECEA" },
};

// Danh sách hồ sơ; bấm một bệnh nhân để mở calendar lịch khám của họ
export function PatientList() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(live ? null : PATIENTS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.patients()
      .then((r) => setList(Array.isArray(r) ? r.map(mapHoSo) : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  }, [online]);

  if (selected) return <PatientCalendar p={selected} live={live} onBack={() => setSelected(null)} />;

  const data = list || [];
  return (
    <div>
      <PageTitle title="Hồ sơ bệnh nhân" sub={live ? "Bấm vào một bệnh nhân để xem lịch khám trên calendar." : "Dữ liệu demo — đăng nhập với backend để xem hồ sơ thật."} action={<Btn kind="ghost"><Filter size={15} /> Lọc</Btn>} />
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải hồ sơ...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err} — trang này cần tài khoản bác sĩ hoặc lễ tân.</Card>}
      {!loading && !err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có hồ sơ bệnh nhân nào.</Card>}
      <Card style={{ padding: 0, overflow: "hidden", display: data.length ? undefined : "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1fr auto", gap: 12, padding: "16px 22px", borderBottom: `1px solid ${T.line}`, background: T.bg, fontSize: 12.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: 0.5 }} className="tableHead">
          <span>Bệnh nhân</span><span>Tuổi</span><span>Điện thoại</span><span>Lượt đặt</span><span></span>
        </div>
        {data.map((p, i) => (
          <div key={p.code} onClick={() => setSelected(p)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1fr auto", gap: 12, padding: "16px 22px", borderBottom: i < data.length - 1 ? `1px solid ${T.line}55` : "none", alignItems: "center", fontSize: 14.5, cursor: "pointer" }} className="tableRow">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Avatar size={38} tone={T.peachSoft} color={T.peach} icon={User} /><div><div style={{ fontWeight: 700, color: T.ink }}>{p.name}</div><div style={{ fontSize: 12.5, color: T.sub }}>{p.code}</div></div></div>
            <span style={{ color: T.sub }}>{p.age != null ? p.age : "—"}</span>
            <span style={{ color: T.sub }}>{p.phone}</span>
            <span style={{ color: T.ink, fontWeight: 700 }}>{p.visits} lần</span>
            <button onClick={(e) => { e.stopPropagation(); setSelected(p); }} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 8, cursor: "pointer" }}><MoreHorizontal size={18} color={T.sub} /></button>
          </div>
        ))}
      </Card>
    </div>
  );
}

const pad2 = (n) => String(n).padStart(2, "0");
const ymdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const THANG = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

// Calendar lịch khám của một bệnh nhân: mỗi ngày có lịch hẹn hiện badge số lượng,
// bấm vào ngày để xem chi tiết các lịch hẹn hôm đó (giờ, khoa, bác sĩ, trạng thái)
function PatientCalendar({ p, live, onBack }) {
  const today = new Date();
  const [appts, setAppts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [sel, setSel] = useState(ymdLocal(today));

  useEffect(() => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.patientAppts(p.dbId)
      .then((r) => setAppts(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setAppts([]); })
      .finally(() => setLoading(false));
  }, [p.dbId]);

  // Gom lịch hẹn theo ngày (khung_gio.ngay dạng YYYY-MM-DD)
  const byDay = useMemo(() => {
    const m = {};
    (appts || []).forEach((a) => {
      const d = a.khung_gio && a.khung_gio.ngay;
      if (!d) return;
      (m[d] = m[d] || []).push(a);
    });
    Object.values(m).forEach((l) => l.sort((a, b) => (a.khung_gio.gio_bat_dau || "").localeCompare(b.khung_gio.gio_bat_dau || "")));
    return m;
  }, [appts]);

  const startIdx = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7; // tuần bắt đầu Thứ 2
  const soNgay = new Date(ym.y, ym.m + 1, 0).getDate();
  const keyOf = (d) => `${ym.y}-${pad2(ym.m + 1)}-${pad2(d)}`;
  const todayKey = ymdLocal(today);
  const doiThang = (dir) => setYm(({ y, m }) => { const d = new Date(y, m + dir, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const selAppts = byDay[sel] || [];
  const fmtSel = (() => { const [y, m, d] = sel.split("-"); return `${d}/${m}/${y}`; })();

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}><ArrowLeft size={15} /> Về danh sách hồ sơ</button>
      <Card style={{ padding: 22, marginBottom: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Avatar size={54} tone={T.peachSoft} color={T.peach} icon={User} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 17 }}>{p.name}</div>
          <div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>{p.code} · {p.phone}{p.age != null ? ` · ${p.age} tuổi` : ""} · {p.visits} lượt đặt</div>
        </div>
        {live && appts && <Pill tone={T.sky} soft={T.skySoft}>{appts.length} lịch khám trong hệ thống</Pill>}
      </Card>

      {!live && <Card style={{ padding: 30, textAlign: "center", color: T.sub }}>Cần kết nối backend để xem lịch khám thật của bệnh nhân.</Card>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải lịch khám...</div>}

      {live && !err && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }} className="examGrid">
          <Card style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <button onClick={() => doiThang(-1)} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 7, cursor: "pointer", display: "grid", placeItems: "center" }}><ChevronLeft size={17} color={T.sub} /></button>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{THANG[ym.m]} / {ym.y}</div>
              <button onClick={() => doiThang(1)} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 7, cursor: "pointer", display: "grid", placeItems: "center" }}><ChevronRight size={17} color={T.sub} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((t) => (
                <div key={t} style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: T.sub, padding: "4px 0" }}>{t}</div>
              ))}
              {Array.from({ length: startIdx }).map((_, i) => <div key={"e" + i} />)}
              {Array.from({ length: soNgay }, (_, i) => i + 1).map((d) => {
                const k = keyOf(d);
                const n = (byDay[k] || []).length;
                const isSel = k === sel;
                const isToday = k === todayKey;
                return (
                  <button key={k} onClick={() => setSel(k)} style={{
                    position: "relative", aspectRatio: "1", border: isSel ? `2px solid ${T.peach}` : `1.5px solid ${isToday ? T.sky : T.line + "88"}`,
                    borderRadius: 12, background: n ? T.peachSoft : T.surface, cursor: "pointer",
                    fontWeight: isToday || isSel ? 800 : 600, fontSize: 13.5, color: T.ink, fontFamily: "inherit",
                  }}>
                    {d}
                    {n > 0 && <span style={{ position: "absolute", top: 3, right: 3, minWidth: 16, height: 16, borderRadius: 99, background: T.peach, color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 3px" }}>{n}</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 12, color: T.sub, flexWrap: "wrap" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: T.peachSoft, border: `1px solid ${T.peach}`, verticalAlign: -1, marginRight: 5 }} />Ngày có lịch khám</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, border: `1.5px solid ${T.sky}`, verticalAlign: -1, marginRight: 5 }} />Hôm nay</span>
            </div>
          </Card>

          <div>
            <SectionHead title={`Lịch khám ngày ${fmtSel}`} />
            {selAppts.length === 0 && <Card style={{ padding: 28, textAlign: "center", color: T.sub, fontSize: 14 }}>Không có lịch khám nào trong ngày này.</Card>}
            <div style={{ display: "grid", gap: 10 }}>
              {selAppts.map((a) => {
                const s = TT_LICH[a.trang_thai] || TT_LICH.cho_xac_nhan;
                return (
                  <Card key={a.id} style={{ padding: 16 }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                      <Pill tone={s.tone} soft={s.soft}>{s.l}</Pill>
                      <span style={{ fontWeight: 800, color: T.ink, fontSize: 15 }}><Clock size={13} style={{ verticalAlign: -2 }} /> {a.khung_gio.gio_bat_dau}</span>
                      {a.so_thu_tu && <span style={{ fontSize: 12.5, color: T.sub }}>STT #{a.so_thu_tu}</span>}
                    </div>
                    <div style={{ color: T.sub, fontSize: 13.5, marginTop: 7 }}>
                      Mã <b style={{ color: T.ink }}>{a.ma_lich_hen}</b>
                      {a.khoa ? <> · {a.khoa.ten_khoa}</> : null}
                      {a.khung_gio.bac_si ? <> · {a.khung_gio.bac_si.ho_ten}</> : null}
                    </div>
                    <DocList lichId={a.id} />
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Bệnh án bệnh nhân đã tải lên cho lịch hẹn — bác sĩ/lễ tân xem online (PDF)
// hoặc tải về dạng PDF/Word (GET /appointments/:id/documents + /documents/:id/download)
const linkBtn = { background: "none", border: "none", color: "#5BA8D0", fontWeight: 800, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" };

function DocList({ lichId }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.documents(lichId)
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); });
  }, [lichId]);

  if (!list || (list.length === 0 && !err)) return null;

  const open = async (d, xemOnline) => {
    setErr(null);
    try {
      const blob = await api.downloadDocument(d.id);
      const url = URL.createObjectURL(blob);
      if (xemOnline) window.open(url, "_blank");
      else { const a = document.createElement("a"); a.href = url; a.download = d.ten_tep; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${T.line}` }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Bệnh án đính kèm</div>
      {err && <div style={{ color: "#C0392B", fontSize: 12.5 }}>{err}</div>}
      {list.map((d) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0", flexWrap: "wrap" }}>
          <FileText size={14} color={T.peach} />
          <span style={{ flex: 1, minWidth: 120, color: T.ink, fontWeight: 700 }}>{d.ten_tep}</span>
          <span style={{ color: T.sub, fontSize: 12 }}>{d.loai_tep === "application/pdf" ? "PDF" : "Word"}</span>
          {d.loai_tep === "application/pdf" && <button onClick={() => open(d, true)} style={linkBtn}>Xem online</button>}
          <button onClick={() => open(d, false)} style={linkBtn}>Tải về</button>
        </div>
      ))}
    </div>
  );
}

export default PatientList;
