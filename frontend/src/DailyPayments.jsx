import React, { useState, useEffect } from "react";
import { Wallet, FileSpreadsheet, User, CheckCircle2, CalendarDays } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  SỔ THU TRONG NGÀY — các thanh toán ĐÃ HOÀN THÀNH trong một ngày.
//  Dữ liệu lưu sẵn trong bảng thanh_toan (trạng thái đã thanh toán); trang này
//  truy vấn theo ngày thu tiền (GET /reception/payments/daily) và trích xuất
//  ra Excel bằng một nút (GET /reception/payments/daily/export).
// ============================================================================

const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtGio = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };

export default function DailyPayments() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [ngay, setNgay] = useState(() => ymdLocal(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.dailyPayments(ngay)
      .then((r) => setData(r))
      .catch((e) => { setErr(e.message); setData(null); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [live, ngay]);

  // Trích xuất sổ thu ra file Excel (CSV UTF-8) từ database
  const xuatExcel = async () => {
    setExporting(true); setErr(null);
    try {
      const blob = await api.exportDailyPayments(ngay);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `so-thu-${ngay}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { setErr(e.message); }
    finally { setExporting(false); }
  };

  if (!live) {
    return (
      <div>
        <PageTitle title="Sổ thu trong ngày" sub="Các thanh toán đã hoàn thành trong ngày." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần kết nối backend để xem sổ thu.</Card>
      </div>
    );
  }

  const list = (data && data.danh_sach) || [];
  return (
    <div>
      <PageTitle title="Sổ thu trong ngày" sub="Các hóa đơn dịch vụ đã thu, lưu trong hệ thống — trích xuất ra Excel khi cần."
        action={<Btn kind="mint" disabled={exporting || list.length === 0} onClick={xuatExcel}><FileSpreadsheet size={16} /> {exporting ? "Đang xuất..." : "Xuất Excel"}</Btn>} />

      <Card style={{ padding: 18, marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px" }}>
          <CalendarDays size={18} color={T.sub} />
          <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} style={{ border: "none", outline: "none", padding: "12px 0", fontSize: 15, fontFamily: "inherit", background: "transparent", color: T.ink }} />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 24 }}>
          <div><div style={{ fontSize: 12.5, color: T.sub }}>Số hóa đơn</div><div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>{data ? data.so_hoa_don : "—"}</div></div>
          <div><div style={{ fontSize: 12.5, color: T.sub }}>Tổng thu</div><div style={{ fontSize: 22, fontWeight: 800, color: T.mint }}>{data ? fmtVND(data.tong_tien) : "—"}</div></div>
        </div>
      </Card>

      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải sổ thu...</div>}
      {!loading && list.length === 0 && !err && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có khoản thu nào trong ngày này.</Card>}

      {list.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr 2fr 1fr 0.8fr", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${T.line}`, background: T.bg, fontSize: 12.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .5 }} className="tableHead">
            <span>Mã HĐ</span><span>Bệnh nhân</span><span>Dịch vụ</span><span>Thành tiền</span><span>Giờ thu</span>
          </div>
          {list.map((t, i) => (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr 2fr 1fr 0.8fr", gap: 12, padding: "14px 20px", borderBottom: i < list.length - 1 ? `1px solid ${T.line}55` : "none", alignItems: "center", fontSize: 14 }} className="tableRow">
              <span style={{ fontWeight: 700, color: T.ink }}>{t.ma_thanh_toan}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={15} /></span>
                <span style={{ color: T.ink }}>{t.lich_hen ? t.lich_hen.benh_nhan : "—"}</span>
              </div>
              <span style={{ color: T.sub, fontSize: 13 }}>{t.chi_tiet.map((c) => `${c.ten_dich_vu}${c.so_luong > 1 ? ` ×${c.so_luong}` : ""}`).join(", ")}</span>
              <span style={{ fontWeight: 800, color: T.ink }}>{fmtVND(t.tong_tien)}</span>
              <span style={{ color: T.sub }}>{fmtGio(t.ngay_thanh_toan)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: T.mintSoft }}>
            <span style={{ fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color={T.mint} /> Tổng thu ngày {ngay.split("-").reverse().join("/")}</span>
            <span style={{ fontWeight: 800, color: T.mint, fontSize: 20 }}>{fmtVND(data ? data.tong_tien : 0)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
