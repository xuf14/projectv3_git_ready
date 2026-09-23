import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, ClipboardList, UserCheck, Users, FileText, CheckCircle2, Clock,
  ChevronRight, User, NotebookPen, ArrowLeft, Search, Activity, ListChecks,
} from "lucide-react";
import {
  T, store, api, useNav, Btn, Card, Pill, Avatar, SectionHead, StatCard, PageTitle,
  FormField, input, pickRow, PortalShell,
} from "./shared";
import { PatientList, tinhTuoi, mapHoSo } from "./PatientsPage";
import PhieuDieuTri from "./phieu_dieu_tri";
import QuyTrinhKham from "./quytrinhkham";

// ============================================================================
//  CỔNG BÁC SĨ — tách riêng khỏi App.jsx.
//  Mỗi trang tự nạp dữ liệu từ database qua API với điều kiện & phân quyền riêng:
//  - Hàng chờ khám:    GET /queue            (bac_si, admin)
//  - Hồ sơ bệnh nhân:  PatientsPage.jsx      (danh sách + calendar lịch khám)
//  - Lịch sử khám:     GET /patients?q= + GET /records/:hoSoId
//  Trang Tiếp đón thuộc cổng Lễ tân (ReceptionPortal.jsx); ExamHistory được
//  export để cổng đó dùng chung.
// ============================================================================

// Lịch hẹn đã check-in → dòng trong hàng chờ khám của bác sĩ
function mapQueueItem(a) {
  return { dbId: a.id, no: a.so_thu_tu || 0, name: (a.ho_so && a.ho_so.ho_ten) || "—",
    age: tinhTuoi(a.ho_so && a.ho_so.ngay_sinh), time: (a.khung_gio && a.khung_gio.gio_bat_dau) || "",
    reason: (a.khoa && a.khoa.ten_khoa) || "", status: "waiting" };
}

// ---------- MOCK DATA (dự phòng khi backend chưa chạy) ----------
const QUEUE = [
  { no: 1, name: "Nguyễn Thị Hoa", age: 28, time: "08:00", status: "done", reason: "Khám thai 12 tuần" },
  { no: 2, name: "Trần Mai Phương", age: 31, time: "08:30", status: "examining", reason: "Khám thai định kỳ" },
  { no: 3, name: "Lê Thị Thu", age: 26, time: "08:30", status: "waiting", reason: "Tư vấn tiền sản" },
  { no: 4, name: "Phạm Hồng Nhung", age: 34, time: "09:00", status: "waiting", reason: "Siêu âm 4D" },
  { no: 5, name: "Vũ Thị Lan", age: 29, time: "09:00", status: "waiting", reason: "Khám thai 20 tuần" },
];

// ---------- DOCTOR PORTAL ----------
function DoctorPortal() {
  const [tab, setTab] = useState("dash");
  const { online } = useNav();
  const live = online && !!store.token;
  // Icon chuông: bệnh nhân được lễ tân hẹn tái khám với bác sĩ đang đăng nhập
  const [revisits, setRevisits] = useState([]);
  useEffect(() => {
    if (!live) return;
    api.doctorRevisits().then((r) => setRevisits(Array.isArray(r) ? r : [])).catch(() => {});
  }, [live]);
  const items = [
    { id: "dash", label: "Tổng quan", icon: LayoutDashboard },
    { id: "queue", label: "Hàng chờ khám", icon: ClipboardList },
    { id: "flow", label: "Quy trình khám", icon: ListChecks },
    { id: "treatment", label: "Phiếu điều trị", icon: Activity },
    { id: "patients", label: "Hồ sơ bệnh nhân", icon: Users },
    { id: "history", label: "Lịch sử khám", icon: FileText },
  ];
  const name = (store.user && store.user.ho_ten) || "BS. Nguyễn Thị Lan";
  return (
    <PortalShell role="doctor" tone={T.sky} soft={T.skySoft} name={name} sub="Bác sĩ" items={items} tab={tab} setTab={setTab}
      bell={{ count: revisits.length, panel: <RevisitPanel list={revisits} /> }}>
      {tab === "dash" && <DoctorDash setTab={setTab} />}
      {tab === "queue" && <DoctorQueue />}
      {tab === "flow" && <QuyTrinhKham />}
      {tab === "treatment" && <PhieuDieuTri />}
      {tab === "patients" && <PatientList />}
      {tab === "history" && <ExamHistory />}
    </PortalShell>
  );
}

// Bảng thả xuống từ icon chuông: bệnh nhân được hẹn tái khám với bác sĩ đang đăng nhập
function RevisitPanel({ list }) {
  const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("vi-VN"); };
  return (
    <div>
      <div style={{ padding: "13px 16px", fontWeight: 800, color: T.ink, fontSize: 14 }}>
        Bệnh nhân hẹn tái khám ({list.length})
      </div>
      {list.length === 0 ? (
        <div style={{ padding: "8px 16px 20px", textAlign: "center", color: T.sub, fontSize: 13.5 }}>
          Chưa có bệnh nhân nào được hẹn tái khám với bạn.
        </div>
      ) : list.map((r) => (
        <div key={r.ho_so_id} style={{ padding: "11px 16px", borderTop: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, color: T.ink, fontSize: 13.5 }}>{r.ho_ten}</span>
            <Pill tone={T.gold} soft={T.goldSoft}>{fmtNgay(r.ngay_tai_kham)}</Pill>
          </div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>
            {r.ma_benh_nhan}{r.sdt ? ` · ${r.sdt}` : ""}
          </div>
          {r.ghi_chu_tai_kham && (
            <div style={{ fontSize: 12.5, color: T.ink, marginTop: 3, whiteSpace: "pre-wrap" }}>📎 {r.ghi_chu_tai_kham}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// Tổng quan bác sĩ: số liệu hôm nay + hàng chờ, đếm trực tiếp từ database
// (GET /doctor/summary + GET /queue); chưa có backend thì hiển thị demo.
function DoctorDash({ setTab }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const [sum, setSum] = useState(null);
  const [queue, setQueue] = useState(live ? null : QUEUE);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!live) return;
    api.doctorSummary().then(setSum).catch((e) => setErr(e.message));
    api.queue().then((r) => setQueue(Array.isArray(r) ? r.map(mapQueueItem) : [])).catch(() => setQueue([]));
  }, [online]);

  const name = (store.user && store.user.ho_ten) || "BS. Nguyễn Thị Lan";
  const today = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const q = queue || [];
  const next = live ? q[0] : QUEUE.find((x) => x.status === "examining");
  const stats = live
    ? [["Bệnh nhân hôm nay", sum ? sum.hom_nay : "...", ClipboardList, T.sky, T.skySoft],
       ["Đã khám xong", sum ? sum.da_kham : "...", CheckCircle2, T.mint, T.mintSoft],
       ["Đang chờ khám", sum ? sum.cho_kham : "...", Clock, T.gold, T.goldSoft]]
    : [["Bệnh nhân hôm nay", 12, ClipboardList, T.sky, T.skySoft],
       ["Đã khám xong", 5, CheckCircle2, T.mint, T.mintSoft],
       ["Đang chờ", 6, Clock, T.gold, T.goldSoft],
       ["Đang khám", 1, UserCheck, T.peach, T.peachSoft]];
  return (
    <div>
      <PageTitle title={`Chào ${name} 👩‍⚕️`} sub={`Hôm nay, ${today}` + (live ? " — số liệu lấy trực tiếp từ hệ thống." : " (dữ liệu demo)")} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 16, marginBottom: 26 }} className={stats.length === 3 ? "grid3" : "grid4"}>
        {stats.map(([l, n, Icon, tone, soft]) => <StatCard key={l} icon={Icon} tone={tone} soft={soft} n={n} l={l} />)}
      </div>
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err} — trang này cần tài khoản bác sĩ.</Card>}
      <Card style={{ padding: 26, marginBottom: 22, background: `linear-gradient(120deg, ${T.skySoft}, ${T.mintSoft})`, border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        {next ? (
          <div>
            <Pill tone={T.sky} soft="#fff"><UserCheck size={13} /> {live ? "Tiếp theo trong hàng chờ" : "Đang khám"}</Pill>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "12px 0 4px" }}>STT #{next.no} · {next.name}</div>
            <div style={{ color: T.ink, opacity: .7, fontSize: 14 }}>{qInfo(next)}</div>
          </div>
        ) : (
          <div>
            <Pill tone={T.sky} soft="#fff"><UserCheck size={13} /> Hàng chờ</Pill>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "12px 0 4px" }}>Chưa có bệnh nhân chờ khám</div>
            <div style={{ color: T.ink, opacity: .7, fontSize: 14 }}>Bệnh nhân sẽ xuất hiện tại đây sau khi lễ tân check-in.</div>
          </div>
        )}
        <Btn kind="mint" onClick={() => setTab("queue")}>{next ? "Bắt đầu khám" : "Mở hàng chờ"} <ChevronRight size={16} /></Btn>
      </Card>
      <SectionHead title="Bệnh nhân tiếp theo" action={<Btn kind="ghost" size="sm" onClick={() => setTab("queue")}>Xem hàng chờ</Btn>} />
      {live && q.length === 0 && <Card style={{ padding: 36, textAlign: "center", color: T.sub }}>Hàng chờ hôm nay đang trống.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {(live ? q.slice(0, 3) : QUEUE.filter((x) => x.status === "waiting").slice(0, 3)).map((x) => <QueueRow key={x.dbId || x.no} q={x} compact />)}
      </div>
    </div>
  );
}

const QSTATUS = {
  done: { l: "Đã khám", tone: T.mint, soft: T.mintSoft },
  examining: { l: "Đang khám", tone: T.peach, soft: T.peachSoft },
  waiting: { l: "Đang chờ", tone: T.gold, soft: T.goldSoft },
};

const qInfo = (q) => [q.age != null ? `${q.age} tuổi` : null, q.reason, q.time].filter(Boolean).join(" · ");

function QueueRow({ q, compact, onExam }) {
  const s = QSTATUS[q.status];
  return (
    <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <span style={{ width: 48, height: 48, borderRadius: 14, background: s.soft, color: s.tone, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>#{q.no}</span>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{q.name}</span><Pill tone={s.tone} soft={s.soft}>{s.l}</Pill></div>
        <div style={{ color: T.sub, fontSize: 13.5, marginTop: 5 }}>{qInfo(q)}</div>
      </div>
      {!compact && q.status === "waiting" && <Btn kind="mint" size="sm" onClick={onExam}><NotebookPen size={15} /> Bắt đầu khám</Btn>}
      {!compact && q.status === "examining" && <Btn size="sm" onClick={onExam}><NotebookPen size={15} /> Ghi kết quả</Btn>}
    </Card>
  );
}

// Trang riêng của BÁC SĨ: nạp lịch hẹn đã check-in (GET /queue, quyền bac_si/admin)
function DoctorQueue() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [exam, setExam] = useState(null);
  const [list, setList] = useState(live ? null : QUEUE);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.queue()
      .then((r) => setList(Array.isArray(r) ? r.map(mapQueueItem) : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [online]);

  if (exam) return <ExamForm q={exam} live={live} onBack={(saved) => { setExam(null); if (saved) load(); }} />;
  const data = list || [];
  return (
    <div>
      <PageTitle title="Hàng chờ khám" sub={live ? "Bệnh nhân đã check-in, chờ khám hôm nay." : "Dữ liệu demo — đăng nhập với backend để xem hàng chờ thật."} />
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải hàng chờ...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err} — trang này cần tài khoản bác sĩ.</Card>}
      {!loading && !err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có bệnh nhân nào trong hàng chờ.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((q) => <QueueRow key={q.dbId || q.no} q={q} onExam={() => setExam(q)} />)}
      </div>
    </div>
  );
}

function ExamForm({ q, live, onBack }) {
  const [f, setF] = useState({ chan_doan: "", chi_dinh: "", don_thuoc: "", ghi_chu: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Lưu kết quả khám vào database (POST /visits/:id/result); demo thì chỉ quay lại
  const save = async () => {
    if (!live || !q.dbId) { onBack(false); return; }
    if (!f.chan_doan.trim()) { setErr("Vui lòng nhập chẩn đoán trước khi lưu."); return; }
    setBusy(true); setErr(null);
    try { await api.saveResult(q.dbId, f); onBack(true); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <button onClick={() => onBack(false)} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}><ArrowLeft size={15} /> Về hàng chờ</button>
      <PageTitle title={`Khám: ${q.name}`} sub={`STT #${q.no}` + (qInfo(q) ? ` · ${qInfo(q)}` : "")} />
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }} className="examGrid">
        <Card style={{ padding: 26 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 17, marginBottom: 18 }}>Ghi nhận kết quả khám</div>
          <div style={{ display: "grid", gap: 16 }}>
            <FormField label="Chẩn đoán"><textarea value={f.chan_doan} onChange={upd("chan_doan")} placeholder="Nhập chẩn đoán..." style={{ ...input, minHeight: 80, resize: "vertical" }} /></FormField>
            <FormField label="Chỉ định cận lâm sàng"><textarea value={f.chi_dinh} onChange={upd("chi_dinh")} placeholder="Siêu âm, xét nghiệm..." style={{ ...input, minHeight: 60, resize: "vertical" }} /></FormField>
            <FormField label="Đơn thuốc"><textarea value={f.don_thuoc} onChange={upd("don_thuoc")} placeholder="Tên thuốc · liều dùng · số lượng..." style={{ ...input, minHeight: 80, resize: "vertical" }} /></FormField>
            <FormField label="Ghi chú & hẹn tái khám"><input value={f.ghi_chu} onChange={upd("ghi_chu")} placeholder="VD: Tái khám sau 4 tuần" style={input} /></FormField>
          </div>
          {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
            <Btn kind="ghost" onClick={() => onBack(false)}>Hủy bỏ</Btn>
            <Btn kind="mint" disabled={busy} onClick={save}><CheckCircle2 size={16} /> {busy ? "Đang lưu..." : "Hoàn thành & lưu"}</Btn>
          </div>
        </Card>
        <Card style={{ padding: 24, height: "fit-content" }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5, marginBottom: 16 }}>Lịch sử khám gần đây</div>
          {[["20/05", "Khám thai 24 tuần"], ["08/04", "Khám thai 18 tuần"], ["12/02", "Khám thai 10 tuần"]].map(([d, t]) => (
            <div key={d} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.line}55` }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.sky, marginTop: 6, flexShrink: 0 }} />
              <div><div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{t}</div><div style={{ fontSize: 12.5, color: T.sub }}>{d}/2026</div></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// Trang LỊCH SỬ KHÁM: tra cứu bệnh nhân theo tên/mã BN/SĐT (GET /patients?q=)
// rồi xem toàn bộ lịch sử khám đã lưu trong database (GET /records/:hoSoId)
function ExamHistory() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);   // danh sách hồ sơ khớp truy vấn
  const [selected, setSelected] = useState(null); // hồ sơ đang xem lịch sử
  const [records, setRecords] = useState(null);   // lượt khám của hồ sơ đã chọn
  const [loading, setLoading] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);
  const [err, setErr] = useState(null);

  const search = async () => {
    if (!live) { setErr("Chưa kết nối backend — tra cứu lịch sử khám cần dữ liệu thật."); return; }
    setLoading(true); setErr(null); setSelected(null); setRecords(null);
    try {
      const r = await api.patients(q.trim());
      setResults(Array.isArray(r) ? r.map(mapHoSo) : []);
    } catch (e) { setErr(e.message); setResults([]); }
    finally { setLoading(false); }
  };

  const view = async (p) => {
    setSelected(p); setRecords(null); setErr(null); setLoadingRec(true);
    try {
      const r = await api.records(p.dbId);
      setRecords(Array.isArray(r) ? r : []);
    } catch (e) { setErr(e.message); setRecords([]); }
    finally { setLoadingRec(false); }
  };

  const fmtTime = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };

  return (
    <div>
      <PageTitle title="Lịch sử khám" sub="Tra cứu bệnh nhân để xem lịch sử khám đã lưu trong hệ thống." />
      <Card style={{ padding: 26, marginBottom: 22 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 16 }}>Tra cứu bệnh nhân</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px" }}>
            <Search size={18} color={T.sub} /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Nhập tên, mã bệnh nhân hoặc SĐT..." style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontSize: 15, fontFamily: "inherit", background: "transparent" }} />
          </div>
          <Btn kind="mint" onClick={search} disabled={loading}>{loading ? "Đang tìm..." : "Tra cứu"}</Btn>
        </div>
        {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
      </Card>

      {results && !selected && (
        <div>
          <SectionHead title={`Kết quả (${results.length})`} />
          {results.length === 0 && <Card style={{ padding: 36, textAlign: "center", color: T.sub }}>Không tìm thấy bệnh nhân nào khớp truy vấn.</Card>}
          <div style={{ display: "grid", gap: 12 }}>
            {results.map((p) => (
              <button key={p.dbId} onClick={() => view(p)} className="pickRow" style={pickRow}>
                <Avatar size={46} tone={T.skySoft} color={T.sky} icon={User} />
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{p.name}</div>
                  <div style={{ fontSize: 13.5, color: T.sub, marginTop: 2 }}>{p.code} · {p.phone}{p.age != null ? ` · ${p.age} tuổi` : ""} · {p.visits} lượt đặt</div>
                </div>
                <ChevronRight size={20} color={T.sub} />
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div>
          <button onClick={() => { setSelected(null); setRecords(null); }} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}><ArrowLeft size={15} /> Về kết quả tra cứu</button>
          <Card style={{ padding: 22, marginBottom: 18, display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar size={54} tone={T.skySoft} color={T.sky} icon={User} />
            <div>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 17 }}>{selected.name}</div>
              <div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>{selected.code} · {selected.phone}{selected.age != null ? ` · ${selected.age} tuổi` : ""}</div>
            </div>
          </Card>
          {loadingRec && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải lịch sử khám...</div>}
          {records && records.length === 0 && !loadingRec && <Card style={{ padding: 36, textAlign: "center", color: T.sub }}>Bệnh nhân này chưa có lượt khám nào trong hệ thống.</Card>}
          <div style={{ display: "grid", gap: 14 }}>
            {(records || []).map((r) => (
              <Card key={r.id} style={{ padding: 22 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill tone={T.sky} soft={T.skySoft}>{fmtTime(r.thoi_gian)}</Pill>
                  {r.lich_hen && <span style={{ fontSize: 12.5, color: T.sub }}>Mã lịch: <b style={{ color: T.ink }}>{r.lich_hen.ma_lich_hen}</b></span>}
                  {r.bac_si && <span style={{ fontSize: 12.5, color: T.sub }}><User size={12} style={{ verticalAlign: -2 }} /> {r.bac_si.ho_ten}</span>}
                </div>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, margin: "12px 0 4px" }}>{r.chan_doan || "(Chưa ghi chẩn đoán)"}</div>
                {r.chi_dinh && <div style={{ color: T.sub, fontSize: 14, marginTop: 4 }}><b style={{ color: T.ink }}>Chỉ định:</b> {r.chi_dinh}</div>}
                {r.don_thuoc && r.don_thuoc.danh_sach_thuoc && <div style={{ color: T.sub, fontSize: 14, marginTop: 4 }}><b style={{ color: T.ink }}>Đơn thuốc:</b> {r.don_thuoc.danh_sach_thuoc}{r.don_thuoc.lieu_dung ? ` — ${r.don_thuoc.lieu_dung}` : ""}</div>}
                {r.ghi_chu && <div style={{ color: T.sub, fontSize: 14, marginTop: 4 }}><b style={{ color: T.ink }}>Ghi chú:</b> {r.ghi_chu}</div>}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorPortal;
// Trang dùng chung với cổng Lễ tân (ReceptionPortal.jsx); PatientList nằm ở PatientsPage.jsx
export { ExamHistory };
