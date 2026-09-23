import React, { useState, useEffect } from "react";
import { Plus, Trash2, Minus, Clock, CheckCircle2, X } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, FormField, input } from "./shared";

// ============================================================================
//  QUẢN LÝ KHUNG GIỜ — trang "Khung giờ" của cổng Quản trị viên.
//  Chọn bác sĩ + ngày → xem toàn bộ khung giờ trong database (GET /admin/slots,
//  gồm cả khung đã đầy), thêm khung mới (POST), tăng/giảm số chỗ (PATCH),
//  xóa khung chưa có lượt đặt (DELETE). Khung giờ ở đây chính là các lựa chọn
//  bệnh nhân thấy khi đặt lịch.
// ============================================================================

const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function AdminSlots() {
  const { online, doctors } = useNav();
  const live = online && !!store.token;
  const dsBacSi = doctors || [];
  const [bacSi, setBacSi] = useState("");
  const [ngay, setNgay] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymdLocal(d); });
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ gio_bat_dau: "", so_luong: 5 });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!bacSi && dsBacSi.length) setBacSi(String(dsBacSi[0].id)); }, [dsBacSi]);

  const load = () => {
    if (!live || !bacSi || !ngay) return;
    setLoading(true); setErr(null);
    api.adminSlots(bacSi, ngay)
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [live, bacSi, ngay]);

  const doAdd = async () => {
    if (!f.gio_bat_dau) { setErr("Vui lòng chọn giờ bắt đầu."); return; }
    setBusy(true); setErr(null);
    try {
      await api.addSlot({ bac_si_id: +bacSi, ngay, gio_bat_dau: f.gio_bat_dau, so_luong: +f.so_luong || 5 });
      setAdding(false); setF({ gio_bat_dau: "", so_luong: 5 });
      load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const doiSoCho = async (s, delta) => {
    setErr(null);
    try { await api.updateSlot(s.id, { so_luong: s.so_luong + delta }); load(); }
    catch (e) { setErr(e.message); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Xóa khung giờ ${s.gio_bat_dau} ngày ${ngay}?`)) return;
    setErr(null);
    try { await api.deleteSlot(s.id); load(); }
    catch (e) { setErr(e.message); }
  };

  if (!live) {
    return (
      <div>
        <PageTitle title="Khung giờ" sub="Quản lý lịch làm việc và khung giờ khám của bác sĩ." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần kết nối backend để quản lý khung giờ thật.</Card>
      </div>
    );
  }

  const data = list || [];
  const tenBacSi = (dsBacSi.find((d) => String(d.id) === bacSi) || {}).name || "";
  return (
    <div>
      <PageTitle title="Khung giờ" sub="Khung giờ ở đây chính là các lựa chọn bệnh nhân thấy khi đặt lịch." action={<Btn kind="lav" onClick={() => { setAdding(!adding); setErr(null); }}>{adding ? <><X size={16} /> Đóng</> : <><Plus size={16} /> Thêm mới</>}</Btn>} />

      <Card style={{ padding: 20, marginBottom: 16, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <FormField label="Bác sĩ">
            <select value={bacSi} onChange={(e) => setBacSi(e.target.value)} style={{ ...input, background: T.surface }}>
              {dsBacSi.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </FormField>
        </div>
        <div style={{ flex: 1, minWidth: 170 }}>
          <FormField label="Ngày"><input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} style={input} /></FormField>
        </div>
      </Card>

      {adding && (
        <Card style={{ padding: 20, marginBottom: 16, background: T.lavSoft, border: "none" }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 12 }}>Thêm khung giờ cho {tenBacSi} — ngày {ngay.split("-").reverse().join("/")}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 140 }}><FormField label="Giờ bắt đầu"><input type="time" value={f.gio_bat_dau} onChange={(e) => setF({ ...f, gio_bat_dau: e.target.value })} style={input} /></FormField></div>
            <div style={{ minWidth: 110 }}><FormField label="Số chỗ"><input type="number" min="1" max="50" value={f.so_luong} onChange={(e) => setF({ ...f, so_luong: e.target.value })} style={input} /></FormField></div>
            <Btn kind="lav" disabled={busy} onClick={doAdd}><CheckCircle2 size={16} /> {busy ? "Đang lưu..." : "Lưu khung giờ"}</Btn>
          </div>
        </Card>
      )}

      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải khung giờ...</div>}
      {!loading && data.length === 0 && !err && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          {tenBacSi} chưa có khung giờ nào trong ngày này — bấm "Thêm mới" để tạo.
        </Card>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {data.map((s) => {
          const conLai = s.so_luong - s.da_dat;
          const day = s.da_dat >= s.so_luong;
          return (
            <Card key={s.id} style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, background: day ? "#FDECEA" : T.lavSoft, color: day ? "#C0392B" : T.lav, display: "grid", placeItems: "center", flexShrink: 0 }}><Clock size={20} /></span>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{s.gio_bat_dau}</span>
                  {day
                    ? <Pill tone="#C0392B" soft="#FDECEA">Đã đầy</Pill>
                    : <Pill tone={T.mint} soft={T.mintSoft}>Còn {conLai} chỗ</Pill>}
                </div>
                <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>Đã đặt {s.da_dat}/{s.so_luong} chỗ</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Btn kind="ghost" size="sm" onClick={() => doiSoCho(s, -1)} disabled={s.so_luong <= 1}><Minus size={14} /></Btn>
                <span style={{ fontWeight: 800, color: T.ink, minWidth: 26, textAlign: "center" }}>{s.so_luong}</span>
                <Btn kind="ghost" size="sm" onClick={() => doiSoCho(s, 1)}><Plus size={14} /></Btn>
                <Btn kind="ghost" size="sm" style={{ color: "#C0392B", borderColor: "#FDECEA", marginLeft: 6 }} onClick={() => remove(s)} title={s.da_dat > 0 ? "Khung đã có lượt đặt — không thể xóa" : "Xóa khung giờ"}><Trash2 size={14} /></Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
