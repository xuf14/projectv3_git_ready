import React, { useState, useEffect } from "react";
import {
  CheckCircle2, Clock, X, User, Search, Receipt, Plus, Minus, Wallet, CreditCard, Printer,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, SectionHead, input } from "./shared";

// ============================================================================
//  LỊCH HẸN & THANH TOÁN — dùng chung cho cổng Lễ tân và Quản trị viên.
//  - Lễ tân: xem TẤT CẢ lịch hẹn (GET /reception/appointments), xác nhận lịch
//    (POST /reception/confirm/:id), lập hóa đơn dịch vụ sau khi bệnh nhân đã
//    khám (POST /reception/appointments/:id/payment) và thu tiền.
//  - Admin: xem & quản lý toàn bộ hóa đơn (GET /admin/payments, hủy hóa đơn).
// ============================================================================

const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const fmtDate = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleDateString("vi-VN"); };
const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Xuất/in hóa đơn tổng tiền dịch vụ của một phiếu — mở cửa sổ in (lưu PDF/in giấy)
function xuatHoaDon(t) {
  const rows = (t.chi_tiet || []).map((c, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${escHtml(c.ten_dich_vu)}</td>
      <td class="r">${fmtVND(c.don_gia)}</td>
      <td class="c">${c.so_luong}</td>
      <td class="r">${fmtVND(c.thanh_tien)}</td>
    </tr>`).join("");
  const bn = t.lich_hen ? t.lich_hen.benh_nhan || "" : "";
  const maBN = t.lich_hen ? t.lich_hen.ma_benh_nhan || "" : "";
  const maLich = t.lich_hen ? t.lich_hen.ma_lich_hen || "" : "";
  const khoa = t.lich_hen ? t.lich_hen.khoa || "" : "";
  const daTra = t.trang_thai === "da_thanh_toan";
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hóa đơn ${escHtml(t.ma_thanh_toan)}</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { color: #2D3A4E; padding: 32px; max-width: 760px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #F08A7C; padding-bottom: 16px; }
    .bv { font-size: 20px; font-weight: 800; color: #F08A7C; }
    .sub { font-size: 12px; color: #7A8699; letter-spacing: 1px; }
    h1 { font-size: 24px; margin: 22px 0 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 14px; margin: 18px 0; }
    .meta b { color: #2D3A4E; } .meta span { color: #7A8699; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #E7EBF0; text-align: left; }
    th { background: #FDEDE9; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
    td.r, th.r { text-align: right; } td.c, th.c { text-align: center; }
    .total { display: flex; justify-content: flex-end; margin-top: 16px; }
    .total .box { min-width: 260px; }
    .total .line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 15px; }
    .total .grand { border-top: 2px solid #2D3A4E; margin-top: 6px; padding-top: 10px; font-size: 20px; font-weight: 800; }
    .stamp { display: inline-block; margin-top: 10px; padding: 4px 14px; border-radius: 999px; font-weight: 700; font-size: 13px;
      background: ${daTra ? "#E2F4EF" : "#FDF2DA"}; color: ${daTra ? "#3FA589" : "#B5851B"}; }
    .foot { margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px; color: #7A8699; }
    .btns { margin-top: 28px; text-align: center; }
    button { background: #F08A7C; color: #fff; border: none; padding: 11px 26px; border-radius: 999px; font-size: 15px; font-weight: 700; cursor: pointer; }
    @media print { .btns { display: none; } body { padding: 8px; } }
  </style></head><body>
    <div class="head">
      <div><div class="bv">Bệnh viện Phụ sản Hải Phòng</div><div class="sub">CHĂM SÓC MẸ & BÉ</div></div>
      <div style="text-align:right;font-size:13px;color:#7A8699">Số: <b style="color:#2D3A4E">${escHtml(t.ma_thanh_toan)}</b><br>Ngày: ${fmtDate(t.ngay_tao)}</div>
    </div>
    <h1>HÓA ĐƠN DỊCH VỤ</h1>
    <span class="stamp">${daTra ? "ĐÃ THANH TOÁN" : "CHỜ THANH TOÁN"}</span>
    <div class="meta">
      <div><span>Bệnh nhân:</span> <b>${escHtml(bn)}</b></div>
      <div><span>Mã bệnh nhân:</span> <b>${escHtml(maBN)}</b></div>
      <div><span>Mã lịch hẹn:</span> <b>${escHtml(maLich)}</b></div>
      <div><span>Khoa:</span> <b>${escHtml(khoa)}</b></div>
    </div>
    <table>
      <thead><tr><th class="c">STT</th><th>Dịch vụ</th><th class="r">Đơn giá</th><th class="c">SL</th><th class="r">Thành tiền</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total"><div class="box">
      <div class="line grand"><span>TỔNG CỘNG</span><span>${fmtVND(t.tong_tien)}</span></div>
    </div></div>
    ${t.ghi_chu ? `<div style="margin-top:14px;font-size:13px;color:#7A8699">Ghi chú: ${escHtml(t.ghi_chu)}</div>` : ""}
    <div class="foot">
      <div>Người lập: ${escHtml(t.nguoi_tao ? t.nguoi_tao.ho_ten : "")}</div>
      <div>Cảm ơn quý khách!</div>
    </div>
    <div class="btns"><button onclick="window.print()">In / Lưu PDF</button></div>
  </body></html>`;
  const w = window.open("", "_blank", "width=780,height=880");
  if (!w) { alert("Trình duyệt đã chặn cửa sổ in hóa đơn. Vui lòng cho phép popup rồi thử lại."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// Trạng thái lịch hẹn
const TT_LICH = {
  cho_xac_nhan: { l: "Chờ xác nhận", tone: T.gold, soft: T.goldSoft },
  da_xac_nhan: { l: "Đã xác nhận", tone: T.sky, soft: T.skySoft },
  da_checkin: { l: "Đã check-in", tone: T.mint, soft: T.mintSoft },
  da_kham: { l: "Đã khám", tone: T.lav, soft: T.lavSoft },
  da_huy: { l: "Đã hủy", tone: "#C0392B", soft: "#FDECEA" },
};
// Trạng thái thanh toán
const TT_TT = {
  cho_thanh_toan: { l: "Chờ thanh toán", tone: T.gold, soft: T.goldSoft },
  da_thanh_toan: { l: "Đã thanh toán", tone: T.mint, soft: T.mintSoft },
  da_huy: { l: "Đã hủy", tone: "#C0392B", soft: "#FDECEA" },
};

const FILTERS = [
  { id: "", l: "Tất cả" },
  { id: "cho_xac_nhan", l: "Chờ xác nhận" },
  { id: "da_xac_nhan", l: "Đã xác nhận" },
  { id: "da_checkin", l: "Đã check-in" },
  { id: "da_kham", l: "Đã khám" },
  { id: "da_huy", l: "Đã hủy" },
];

// ---- Lễ tân: tất cả lịch hẹn + xác nhận + lập hóa đơn ----
export function AllAppointments() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [payFor, setPayFor] = useState(null); // lịch hẹn đang lập hóa đơn

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.allAppointments(filter, q.trim())
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [live, filter]);

  const confirm = async (a) => {
    setBusyId(a.id); setErr(null);
    try { await api.confirmAppt(a.id); load(); }
    catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  if (!live) {
    return (
      <div>
        <PageTitle title="Tất cả lịch hẹn" sub="Xem và xác nhận lịch hẹn của bệnh nhân." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần kết nối backend để xem lịch hẹn thật.</Card>
      </div>
    );
  }
  if (payFor) return <PaymentForm appt={payFor} onBack={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />;

  const data = list || [];
  return (
    <div>
      <PageTitle title="Tất cả lịch hẹn" sub="Xác nhận lịch hẹn và lập thanh toán dịch vụ sau khi bệnh nhân đã khám." />
      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {FILTERS.map((fx) => (
            <button key={fx.id} onClick={() => setFilter(fx.id)} style={{
              padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              border: `1.5px solid ${filter === fx.id ? T.gold : T.line}`,
              background: filter === fx.id ? T.gold : T.surface, color: filter === fx.id ? "#fff" : T.sub,
            }}>{fx.l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px" }}>
            <Search size={18} color={T.sub} />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Tìm theo tên, mã BN hoặc mã lịch hẹn..." style={{ flex: 1, border: "none", outline: "none", padding: "12px 0", fontSize: 15, fontFamily: "inherit", background: "transparent" }} />
          </div>
          <Btn onClick={load}>Tìm</Btn>
        </div>
      </Card>

      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải lịch hẹn...</div>}
      {!loading && data.length === 0 && !err && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Không có lịch hẹn nào khớp bộ lọc.</Card>}

      <div style={{ display: "grid", gap: 12 }}>
        {data.map((a) => {
          const s = TT_LICH[a.trang_thai] || TT_LICH.cho_xac_nhan;
          const bs = a.khung_gio && a.khung_gio.bac_si ? a.khung_gio.bac_si.ho_ten : "";
          const ngay = a.khung_gio ? a.khung_gio.ngay : "";
          const gio = a.khung_gio ? a.khung_gio.gio_bat_dau : "";
          return (
            <Card key={a.id} style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: s.soft, color: s.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={22} /></span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{a.ho_so ? a.ho_so.ho_ten : "—"}</span>
                  <Pill tone={s.tone} soft={s.soft}>{s.l}</Pill>
                </div>
                <div style={{ color: T.sub, fontSize: 13.5, marginTop: 4 }}>
                  {a.ma_lich_hen}{a.khoa ? ` · ${a.khoa.ten_khoa}` : ""}{bs ? ` · ${bs}` : ""}
                  {ngay ? ` · ${fmtDate(ngay)} ${gio}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {a.trang_thai === "cho_xac_nhan" && <Btn kind="mint" size="sm" disabled={busyId === a.id} onClick={() => confirm(a)}><CheckCircle2 size={15} /> {busyId === a.id ? "..." : "Xác nhận"}</Btn>}
                {a.trang_thai === "da_kham" && <Btn kind="gold" size="sm" onClick={() => setPayFor(a)}><Receipt size={15} /> Lập thanh toán</Btn>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Form chọn dịch vụ và lập hóa đơn cho một lịch hẹn đã khám.
// Export để bước 6 của Quy trình khám (quytrinhkham.jsx) dùng lại.
export function PaymentForm({ appt, onBack, onDone }) {
  const [services, setServices] = useState(null);
  const [qty, setQty] = useState({}); // dich_vu_id -> số lượng (0 = không chọn)
  const [ghiChu, setGhiChu] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.services()
      .then((r) => setServices(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setServices([]); });
  }, []);

  const setSL = (id, v) => setQty((q) => ({ ...q, [id]: Math.max(0, v) }));
  const ds = services || [];
  const chon = ds.filter((d) => (qty[d.id] || 0) > 0);
  const tong = chon.reduce((s, d) => s + d.gia * qty[d.id], 0);

  const save = async () => {
    if (chon.length === 0) { setErr("Vui lòng chọn ít nhất một dịch vụ."); return; }
    setBusy(true); setErr(null);
    try {
      await api.createPayment(appt.id, {
        items: chon.map((d) => ({ dich_vu_id: d.id, so_luong: qty[d.id] })),
        ghi_chu: ghiChu,
      });
      onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}><X size={15} /> Hủy lập hóa đơn</button>
      <PageTitle title="Lập thanh toán dịch vụ" sub={`Bệnh nhân ${appt.ho_so ? appt.ho_so.ho_ten : ""} · Lịch hẹn ${appt.ma_lich_hen}`} />
      {err && <Card style={{ padding: 14, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      <Card style={{ padding: 22 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5, marginBottom: 14 }}>Chọn dịch vụ cần thanh toán</div>
        {!services && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải danh mục dịch vụ...</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {ds.map((d) => {
            const sl = qty[d.id] || 0;
            const on = sl > 0;
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1.5px solid ${on ? T.gold : T.line}`, borderRadius: 13, background: on ? T.goldSoft : T.surface, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, color: T.ink, fontSize: 14.5 }}>{d.ten_dich_vu}</div>
                  <div style={{ color: T.sub, fontSize: 13 }}>{fmtVND(d.gia)}{d.khoa ? ` · ${d.khoa.ten_khoa}` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => setSL(d.id, sl - 1)} style={qtyBtn}><Minus size={14} color={T.sub} /></button>
                  <span style={{ minWidth: 26, textAlign: "center", fontWeight: 800, color: T.ink }}>{sl}</span>
                  <button onClick={() => setSL(d.id, sl + 1)} style={qtyBtn}><Plus size={14} color={T.sub} /></button>
                </div>
              </div>
            );
          })}
        </div>
        {services && ds.length === 0 && <div style={{ color: T.sub, fontSize: 14 }}>Chưa có dịch vụ nào trong hệ thống.</div>}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, marginBottom: 6 }}>Ghi chú (không bắt buộc)</div>
          <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="VD: thanh toán tiền mặt tại quầy" style={input} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.line}`, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 15, color: T.sub }}>Tổng cộng: <b style={{ color: T.ink, fontSize: 20 }}>{fmtVND(tong)}</b></div>
          <Btn kind="gold" disabled={busy} onClick={save}><Receipt size={16} /> {busy ? "Đang lập..." : "Lập hóa đơn & yêu cầu thanh toán"}</Btn>
        </div>
      </Card>
    </div>
  );
}

const qtyBtn = { width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" };

// ---- Danh sách hóa đơn: mode "reception" (thu tiền) hoặc "admin" (hủy) ----
export function PaymentList({ mode }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    const fn = mode === "admin" ? api.adminPayments : api.receptionPayments;
    fn()
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [live]);

  const thu = async (t) => {
    if (!window.confirm(`Xác nhận bệnh nhân đã thanh toán hóa đơn ${t.ma_thanh_toan} (${fmtVND(t.tong_tien)})?`)) return;
    setBusyId(t.id); setErr(null);
    try { await api.payPayment(t.id); load(); }
    catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };
  const huy = async (t) => {
    if (!window.confirm(`Hủy hóa đơn ${t.ma_thanh_toan}?`)) return;
    setBusyId(t.id); setErr(null);
    try { await api.cancelPayment(t.id); load(); }
    catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  if (!live) {
    return (
      <div>
        <PageTitle title="Thanh toán" sub="Quản lý hóa đơn dịch vụ." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần kết nối backend để xem hóa đơn thật.</Card>
      </div>
    );
  }

  const data = list || [];
  const tongThu = data.filter((t) => t.trang_thai === "da_thanh_toan").reduce((s, t) => s + t.tong_tien, 0);
  const cho = data.filter((t) => t.trang_thai === "cho_thanh_toan").length;
  return (
    <div>
      <PageTitle title="Thanh toán" sub={mode === "admin" ? "Xem và quản lý toàn bộ hóa đơn dịch vụ trong hệ thống." : "Thu tiền các hóa đơn dịch vụ đã lập."} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }} className="grid3">
        <Card style={{ padding: 18 }}><div style={{ color: T.sub, fontSize: 13 }}>Tổng hóa đơn</div><div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{data.length}</div></Card>
        <Card style={{ padding: 18 }}><div style={{ color: T.sub, fontSize: 13 }}>Chờ thanh toán</div><div style={{ fontSize: 24, fontWeight: 800, color: T.gold, marginTop: 4 }}>{cho}</div></Card>
        <Card style={{ padding: 18 }}><div style={{ color: T.sub, fontSize: 13 }}>Đã thu</div><div style={{ fontSize: 24, fontWeight: 800, color: T.mint, marginTop: 4 }}>{fmtVND(tongThu)}</div></Card>
      </div>

      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải hóa đơn...</div>}
      {!loading && data.length === 0 && !err && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có hóa đơn nào.</Card>}

      <div style={{ display: "grid", gap: 12 }}>
        {data.map((t) => {
          const s = TT_TT[t.trang_thai] || TT_TT.cho_thanh_toan;
          return (
            <Card key={t.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ width: 46, height: 46, borderRadius: 13, background: s.soft, color: s.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Wallet size={21} /></span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{t.ma_thanh_toan}</span>
                    <Pill tone={s.tone} soft={s.soft}>{s.l}</Pill>
                  </div>
                  <div style={{ color: T.sub, fontSize: 13.5, marginTop: 4 }}>
                    {t.lich_hen ? `${t.lich_hen.benh_nhan || "—"} · Lịch ${t.lich_hen.ma_lich_hen}` : "—"}
                    {t.lich_hen && t.lich_hen.khoa ? ` · ${t.lich_hen.khoa}` : ""} · {fmtDate(t.ngay_tao)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: T.ink, fontSize: 18 }}>{fmtVND(t.tong_tien)}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                    {t.trang_thai !== "da_huy" && <Btn kind="ghost" size="sm" onClick={() => xuatHoaDon(t)}><Printer size={14} /> Xuất hóa đơn</Btn>}
                    {mode === "reception" && t.trang_thai === "cho_thanh_toan" && <Btn kind="mint" size="sm" disabled={busyId === t.id} onClick={() => thu(t)}><CreditCard size={14} /> {busyId === t.id ? "..." : "Thu tiền"}</Btn>}
                    {mode === "admin" && t.trang_thai === "cho_thanh_toan" && <Btn kind="ghost" size="sm" style={{ color: "#C0392B", borderColor: "#FDECEA" }} disabled={busyId === t.id} onClick={() => huy(t)}><X size={14} /> Hủy</Btn>}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}55` }}>
                {t.chi_tiet.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: T.sub, padding: "3px 0" }}>
                    <span>{c.ten_dich_vu} {c.so_luong > 1 ? `× ${c.so_luong}` : ""}</span>
                    <span style={{ color: T.ink, fontWeight: 600 }}>{fmtVND(c.thanh_tien)}</span>
                  </div>
                ))}
                {t.ghi_chu && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, fontStyle: "italic" }}>Ghi chú: {t.ghi_chu}</div>}
                {t.nguoi_tao && <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}>Lập bởi {t.nguoi_tao.ho_ten}{t.ngay_thanh_toan ? ` · Đã thu ${fmtDate(t.ngay_thanh_toan)}` : ""}</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
