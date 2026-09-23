import React, { useState, useEffect } from "react";
import { ClipboardList, Pill as PillIcon, Package, Stethoscope, Plus, Trash2, Save, RotateCcw, Receipt, Filter, Search, CreditCard, X, CheckCircle2 } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  Y LỆNH — lễ tân lập phiếu thanh toán viện phí (thuốc, vật tư tiêu hao, dịch vụ).
//  Phiếu liên kết với phiếu khám bệnh (thongtinbenhnhan) để lấy thông tin bệnh nhân.
//  Lưu vào bảng y_lenh + chi_tiet_y_lenh qua:
//    POST /reception/y-lenh, GET /reception/y-lenh, GET /reception/y-lenh/:id
// ============================================================================

const inp = { ...input, padding: "9px 11px", fontSize: 13.5, borderRadius: 9 };
const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const LOAI = {
  thuoc: { label: "Thuốc", tone: T.peach, soft: T.peachSoft, icon: PillIcon },
  vat_tu: { label: "Vật tư", tone: T.sky, soft: T.skySoft, icon: Package },
  dich_vu: { label: "Dịch vụ", tone: T.lav, soft: T.lavSoft, icon: Stethoscope },
};
const thanhTien = (r) => Math.round((Number(r.so_luong) || 0) * (Number(r.don_gia) || 0) * ((Number(r.ty_le) || 0) / 100));
const dongMoi = (loai) => ({ loai, ten: "", ma_vt: "", dvt: "", so_luong: 1, lieu_dung: "", cach_dung: "", don_gia: 0, ty_le: 100 });
const TT = {
  chua_nop: { label: "Chưa nộp", tone: "#C0392B", soft: "#FDECEA" },
  mot_phan: { label: "Nộp một phần", tone: "#B7791F", soft: T.goldSoft },
  da_du: { label: "Đã nộp đủ", tone: T.mint, soft: T.mintSoft },
};
// Tên hiển thị bác sĩ điều trị. ho_ten trong dữ liệu đã kèm học hàm nên chỉ thêm
// tiền tố khi ho_ten chưa chứa sẵn, tránh lặp "BS.CKI BS.CKI ...".
const tenBS = (d) => {
  const ten = (d.ho_ten || "").trim();
  const hh = (d.hoc_ham || "").trim();
  return hh && !ten.startsWith(hh) ? `${hh} ${ten}` : ten;
};

export default function YLenh() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [sheets, setSheets] = useState([]);       // phiếu khám để liên kết
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);     // danh sách bác sĩ bệnh viện
  const [phieuKhamId, setPhieuKhamId] = useState("");
  const [ngayYl, setNgayYl] = useState(() => ymd(new Date()));
  const [ngayCdht, setNgayCdht] = useState("");
  const [bsDt, setBsDt] = useState("");
  const [daNop, setDaNop] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState([]);
  // Bộ lọc danh sách phiếu gần đây
  const [fTu, setFTu] = useState(""); const [fDen, setFDen] = useState(""); const [fQ, setFQ] = useState("");
  // Thu thêm (nộp nhiều lần)
  const [payFor, setPayFor] = useState(null); const [paySo, setPaySo] = useState(""); const [paying, setPaying] = useState(false);

  const loadList = (flt) => {
    if (!live) return;
    const f = flt || { tu: fTu, den: fDen, q: fQ };
    api.yLenhList({ tu: f.tu || undefined, den: f.den || undefined, q: f.q || undefined })
      .then((r) => setList(Array.isArray(r) ? r : [])).catch(() => {});
  };
  useEffect(() => {
    if (!live) return;
    api.examSheets().then((r) => setSheets(Array.isArray(r) ? r : [])).catch(() => {});
    api.services().then((r) => setServices(Array.isArray(r) ? r : [])).catch(() => {});
    api.doctors().then((r) => setDoctors(Array.isArray(r) ? r : [])).catch(() => {});
    loadList({});
  }, [live]);

  const xoaLoc = () => { setFTu(""); setFDen(""); setFQ(""); loadList({ tu: "", den: "", q: "" }); };
  const xacNhanThu = async () => {
    if (!payFor) return;
    const so = Math.round(Number(paySo) || 0);
    if (so <= 0) { setMsg({ type: "err", text: "Số tiền thu phải lớn hơn 0." }); return; }
    setPaying(true);
    try {
      const r = await api.payYLenh(payFor.id, so);
      setMsg({ type: "ok", text: `Đã thu thêm ${fmtVND(so)} cho ${r.ma_phieu} — còn lại ${fmtVND(r.con_lai)}.` });
      setPayFor(null); setPaySo(""); loadList();
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setPaying(false); }
  };

  const sheet = sheets.find((s) => String(s.id) === String(phieuKhamId));
  const setRow = (i, k, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = (loai) => setRows((rs) => [...rs, dongMoi(loai)]);
  const delRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const addDichVu = (id) => {
    const dv = services.find((s) => String(s.id) === String(id));
    if (!dv) return;
    setRows((rs) => [...rs, { ...dongMoi("dich_vu"), ten: dv.ten_dich_vu, don_gia: dv.gia, dvt: "Lần", ma_vt: dv.id ? `DV${dv.id}` : "" }]);
  };

  const tong = rows.reduce((s, r) => s + thanhTien(r), 0);
  const traLai = Math.max(0, (Number(daNop) || 0) - tong);

  const reset = () => { setPhieuKhamId(""); setNgayYl(ymd(new Date())); setNgayCdht(""); setBsDt(""); setDaNop(""); setGhiChu(""); setRows([]); setMsg(null); };

  const luu = async () => {
    setMsg(null);
    if (rows.length === 0) { setMsg({ type: "err", text: "Thêm ít nhất một dòng thuốc / vật tư / dịch vụ." }); return; }
    if (rows.some((r) => !r.ten.trim())) { setMsg({ type: "err", text: "Mỗi dòng phải có tên." }); return; }
    setSaving(true);
    try {
      const r = await api.createYLenh({
        phieu_kham_id: phieuKhamId || undefined, ngay_yl: ngayYl || undefined,
        ngay_cdht: ngayCdht || undefined, bs_dt: bsDt || undefined,
        da_nop: Number(daNop) || 0, ghi_chu: ghiChu || undefined,
        chi_tiet: rows.map((r) => ({ loai: r.loai, ten: r.ten, ma_vt: r.ma_vt, dvt: r.dvt,
          so_luong: r.so_luong, lieu_dung: r.lieu_dung, cach_dung: r.cach_dung, don_gia: r.don_gia, ty_le: r.ty_le })),
      });
      setMsg({ type: "ok", text: `Đã lưu phiếu y lệnh ${r.ma_phieu} — tổng ${fmtVND(r.tong_tien)}.` });
      reset(); loadList();
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setSaving(false); }
  };

  if (!live) {
    return (<div><PageTitle title="Y lệnh — thanh toán viện phí" sub="Lập phiếu thuốc, vật tư và dịch vụ." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản lễ tân.</Card></div>);
  }

  const th = { padding: "10px 8px", fontSize: 11.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .4, textAlign: "left" };
  const td = { padding: "6px 8px", verticalAlign: "top" };

  return (
    <div>
      <PageTitle title="Y lệnh — thanh toán viện phí" sub="Thuốc, vật tư tiêu hao và dịch vụ — lưu vào hệ thống, liên kết bệnh nhân từ phiếu khám."
        action={<div style={{ display: "flex", gap: 10 }}>
          <Btn kind="ghost" onClick={reset}><RotateCcw size={15} /> Làm mới</Btn>
          <Btn kind="gold" disabled={saving} onClick={luu}><Save size={16} /> {saving ? "Đang lưu..." : "Lưu phiếu"}</Btn>
        </div>} />

      {msg && <Card style={{ padding: 14, marginBottom: 16, border: "none", fontSize: 14,
        background: msg.type === "ok" ? T.mintSoft : "#FDECEA", color: msg.type === "ok" ? "#2F8F73" : "#C0392B" }}>{msg.text}</Card>}

      {/* Liên kết bệnh nhân + thông tin phiếu */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><ClipboardList size={17} color={T.gold} /> Thông tin phiếu</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }} className="grid3">
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Bệnh nhân (từ phiếu khám)</span>
            <select style={{ ...inp, padding: "10px 12px", fontSize: 14 }} value={phieuKhamId} onChange={(e) => setPhieuKhamId(e.target.value)}>
              <option value="">— Chọn phiếu khám bệnh —</option>
              {sheets.map((s) => <option key={s.id} value={s.id}>{s.ten_bn}{s.ma_kcb ? ` · ${s.ma_kcb}` : ` · #${s.id}`}{s.ma_benh_nhan ? ` · ${s.ma_benh_nhan}` : ""}</option>)}
            </select>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Ngày YL</span>
            <input type="date" style={{ ...inp, padding: "10px 12px", fontSize: 14 }} value={ngayYl} onChange={(e) => setNgayYl(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Ngày CĐHT</span>
            <input type="date" style={{ ...inp, padding: "10px 12px", fontSize: 14 }} value={ngayCdht} onChange={(e) => setNgayCdht(e.target.value)} />
          </label>
          <label style={{ display: "block", gridColumn: "span 2" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>BS điều trị</span>
            <select style={{ ...inp, padding: "10px 12px", fontSize: 14 }} value={bsDt} onChange={(e) => setBsDt(e.target.value)}>
              <option value="">— Chọn bác sĩ điều trị —</option>
              {doctors.map((d) => <option key={d.id} value={tenBS(d)}>{tenBS(d)}{d.khoa ? ` — ${d.khoa.ten_khoa}` : ""}</option>)}
            </select>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Ghi chú</span>
            <input style={{ ...inp, padding: "10px 12px", fontSize: 14 }} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
          </label>
        </div>
        {sheet && <div style={{ marginTop: 12, padding: "10px 14px", background: T.bg, borderRadius: 12, fontSize: 13.5, color: T.sub }}>
          Liên kết: <b style={{ color: T.ink }}>{sheet.ten_bn}</b>{sheet.chan_doan_so_bo ? ` — CĐ: ${sheet.chan_doan_so_bo}` : ""}
        </div>}
      </Card>

      {/* Bảng chi tiết thuốc / vật tư / dịch vụ */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Receipt size={17} color={T.gold} /> Chi tiết viện phí</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Btn kind="soft" size="sm" onClick={() => addRow("thuoc")}><Plus size={14} /> Thuốc</Btn>
            <Btn kind="soft" size="sm" onClick={() => addRow("vat_tu")}><Plus size={14} /> Vật tư</Btn>
            <select style={{ ...inp, width: "auto", padding: "8px 10px" }} value="" onChange={(e) => { addDichVu(e.target.value); e.target.value = ""; }}>
              <option value="">+ Dịch vụ từ danh mục…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.ten_dich_vu} — {fmtVND(s.gia)}</option>)}
            </select>
            <Btn kind="soft" size="sm" onClick={() => addRow("dich_vu")}><Plus size={14} /> Dịch vụ trống</Btn>
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 14, border: `1.5px dashed ${T.line}`, borderRadius: 12 }}>
            Chưa có dòng nào. Dùng các nút bên trên để thêm thuốc, vật tư tiêu hao hoặc dịch vụ.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.line}` }}>
                <th style={{ ...th, width: 82 }}>Loại</th><th style={{ ...th, minWidth: 200 }}>Tên</th>
                <th style={{ ...th, width: 70 }}>ĐVT</th><th style={{ ...th, width: 70 }}>SL</th>
                <th style={{ ...th, minWidth: 130 }}>Liều/Cách dùng</th>
                <th style={{ ...th, width: 110 }}>Đơn giá</th><th style={{ ...th, width: 60 }}>TL%</th>
                <th style={{ ...th, width: 110, textAlign: "right" }}>Thành tiền</th><th style={{ ...th, width: 36 }}></th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => { const L = LOAI[r.loai]; return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.line}55` }}>
                    <td style={td}><Pill tone={L.tone} soft={L.soft}><L.icon size={12} /> {L.label}</Pill></td>
                    <td style={td}><input style={inp} value={r.ten} onChange={(e) => setRow(i, "ten", e.target.value)} placeholder="Tên..." /></td>
                    <td style={td}><input style={inp} value={r.dvt} onChange={(e) => setRow(i, "dvt", e.target.value)} placeholder="Cái" /></td>
                    <td style={td}><input style={inp} type="number" min="0" step="any" value={r.so_luong} onChange={(e) => setRow(i, "so_luong", e.target.value)} /></td>
                    <td style={td}>
                      <input style={{ ...inp, marginBottom: 4 }} value={r.lieu_dung} onChange={(e) => setRow(i, "lieu_dung", e.target.value)} placeholder="Liều dùng" />
                      <input style={inp} value={r.cach_dung} onChange={(e) => setRow(i, "cach_dung", e.target.value)} placeholder="Cách dùng" />
                    </td>
                    <td style={td}><input style={inp} type="number" min="0" value={r.don_gia} onChange={(e) => setRow(i, "don_gia", e.target.value)} /></td>
                    <td style={td}><input style={inp} type="number" min="0" max="100" value={r.ty_le} onChange={(e) => setRow(i, "ty_le", e.target.value)} /></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: T.ink }}>{fmtVND(thanhTien(r))}</td>
                    <td style={td}><button onClick={() => delRow(i)} title="Xóa dòng" style={{ background: "none", border: "none", cursor: "pointer", color: "#C0392B", padding: 4 }}><Trash2 size={16} /></button></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Tổng kết thanh toán */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end", justifyContent: "space-between" }}>
        <label style={{ display: "block", maxWidth: 240 }}>
          <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Bệnh nhân nộp lần đầu (đ) — lễ tân xác nhận</span>
          <input style={{ ...inp, padding: "10px 12px", fontSize: 14 }} type="number" min="0" value={daNop} onChange={(e) => setDaNop(e.target.value)} placeholder="0" />
          <span style={{ fontSize: 11.5, color: T.sub, display: "block", marginTop: 5 }}>Nộp chưa đủ có thể thu tiếp lần sau ở danh sách bên dưới.</span>
        </label>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 12.5, color: T.sub }}>Tổng chi phí</div><div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>{fmtVND(tong)}</div></div>
          <div><div style={{ fontSize: 12.5, color: T.sub }}>Đã nộp</div><div style={{ fontSize: 22, fontWeight: 800, color: T.mint }}>{fmtVND(Number(daNop) || 0)}</div></div>
          <div><div style={{ fontSize: 12.5, color: T.sub }}>Trả lại</div><div style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>{fmtVND(traLai)}</div></div>
        </div>
      </Card>

      {/* Phiếu y lệnh gần đây — lọc theo thời gian hoặc tìm theo người thanh toán */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15 }}>Phiếu y lệnh gần đây</div>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12, color: T.sub, fontWeight: 600, display: "block", marginBottom: 4 }}>Từ (ngày giờ)</span>
            <input type="datetime-local" style={{ ...inp, padding: "9px 11px" }} value={fTu} onChange={(e) => setFTu(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12, color: T.sub, fontWeight: 600, display: "block", marginBottom: 4 }}>Đến (ngày giờ)</span>
            <input type="datetime-local" style={{ ...inp, padding: "9px 11px" }} value={fDen} onChange={(e) => setFDen(e.target.value)} />
          </label>
          <label style={{ display: "block", flex: 1, minWidth: 180 }}>
            <span style={{ fontSize: 12, color: T.sub, fontWeight: 600, display: "block", marginBottom: 4 }}>Tìm (bệnh nhân, mã phiếu, bác sĩ)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1.5px solid ${T.line}`, borderRadius: 9, padding: "0 11px" }}>
              <Search size={16} color={T.sub} />
              <input value={fQ} onChange={(e) => setFQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadList()} placeholder="VD: Nguyễn / YL123 / BS Lan" style={{ flex: 1, border: "none", outline: "none", padding: "9px 0", fontSize: 13.5, fontFamily: "inherit", background: "transparent" }} />
            </div>
          </label>
          <Btn kind="ghost" onClick={() => loadList()}><Filter size={15} /> Lọc</Btn>
          <Btn kind="ghost" onClick={xoaLoc}><RotateCcw size={15} /> Xóa lọc</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr 1fr 1.1fr 1.2fr 0.9fr", gap: 12, padding: "12px 20px", background: T.bg, fontSize: 12, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .4 }} className="tableHead">
          <span>Mã phiếu</span><span>Bệnh nhân</span><span>Tổng tiền</span><span>Còn lại</span><span>Trạng thái</span><span>Thời gian</span><span></span>
        </div>
        {list.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: T.sub }}>Không có phiếu nào khớp bộ lọc.</div>
        ) : list.map((y, i) => { const st = TT[y.trang_thai] || TT.chua_nop; return (
          <div key={y.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr 1fr 1.1fr 1.2fr 0.9fr", gap: 12, padding: "12px 20px", borderBottom: i < list.length - 1 ? `1px solid ${T.line}55` : "none", alignItems: "center", fontSize: 13.5 }} className="tableRow">
            <span style={{ fontWeight: 700, color: T.ink }}>{y.ma_phieu}</span>
            <span style={{ color: T.ink }}>{y.ten_bn || "—"}</span>
            <span style={{ fontWeight: 800, color: T.ink }}>{fmtVND(y.tong_tien)}</span>
            <span style={{ fontWeight: 700, color: y.con_lai > 0 ? "#C0392B" : T.mint }}>{fmtVND(y.con_lai)}</span>
            <span><Pill tone={st.tone} soft={st.soft}>{st.label}</Pill></span>
            <span style={{ color: T.sub }}>{fmtNgay(y.ngay_tao)}</span>
            <span>{y.trang_thai !== "da_du" && <Btn kind="gold" size="sm" onClick={() => { setPayFor(y); setPaySo(String(y.con_lai || "")); }}><CreditCard size={14} /> Thu thêm</Btn>}</span>
          </div>
        ); })}
      </Card>

      {/* Modal xác nhận thu thêm tiền */}
      {payFor && (
        <div onClick={() => setPayFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 60, padding: 16 }}>
          <Card onClick={(e) => e.stopPropagation()} style={{ padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}><CreditCard size={19} color={T.gold} /> Thu thêm viện phí</div>
              <button onClick={() => setPayFor(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub }}><X size={20} /></button>
            </div>
            <div style={{ background: T.bg, borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13.5 }}>
              <div style={{ color: T.sub }}>Phiếu <b style={{ color: T.ink }}>{payFor.ma_phieu}</b> · {payFor.ten_bn || "—"}</div>
              <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}><span style={{ color: T.sub }}>Tổng / đã nộp</span><span style={{ color: T.ink }}>{fmtVND(payFor.tong_tien)} / {fmtVND(payFor.da_nop)}</span></div>
              <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}><span style={{ color: T.sub }}>Còn lại</span><b style={{ color: "#C0392B" }}>{fmtVND(payFor.con_lai)}</b></div>
            </div>
            <label style={{ display: "block", marginBottom: 18 }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Số tiền thu lần này (đ)</span>
              <input autoFocus type="number" min="1" style={{ ...inp, padding: "11px 13px", fontSize: 15 }} value={paySo} onChange={(e) => setPaySo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && xacNhanThu()} />
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn kind="ghost" onClick={() => setPayFor(null)}>Hủy</Btn>
              <Btn kind="mint" disabled={paying} onClick={xacNhanThu}><CheckCircle2 size={16} /> {paying ? "Đang thu..." : "Xác nhận thu"}</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
