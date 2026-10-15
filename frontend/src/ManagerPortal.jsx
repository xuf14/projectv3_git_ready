import React, { useState, useEffect } from "react";
import {
  AlertTriangle, BarChart3, BedDouble, Pill as PillIcon, Building2, CalendarDays, CalendarRange, CalendarClock,
  ChevronLeft, ChevronRight, ClipboardList, TrendingUp, Wallet,
} from "lucide-react";
import {
  T, store, api, useNav, Btn, Card, Pill, PageTitle, PortalShell,
} from "./shared";
import { DieuPhoiQuanLy } from "./dieuphoi";
import ThuocQuanLy from "./ThuocQuanLy";
import NhapVienPage from "./nhapvien";

// ============================================================================
//  CỔNG QUẢN LÝ — màn hình GIÁM SÁT, không có thao tác nhập liệu nào.
//  Ban giám đốc xem hoạt động khám và doanh thu của từng khoa phòng theo kỳ
//  ngày / tuần / tháng, kèm chuỗi các kỳ liền trước để thấy xu hướng.
//  Toàn bộ số liệu lấy từ GET /api/quan-ly/tong-quan (vai trò quan_ly, admin);
//  không có số liệu minh họa — backend chưa chạy thì báo lỗi rõ ràng.
// ============================================================================

const KY = [
  { id: "ngay", label: "Ngày", icon: CalendarDays },
  { id: "tuan", label: "Tuần", icon: CalendarRange },
  { id: "thang", label: "Tháng", icon: CalendarClock },
];

const tien = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const ngayISO = (d) => d.toISOString().slice(0, 10);
const fmtNgay = (s) => { const [y, m, d] = String(s).split("-"); return d ? `${d}/${m}/${y}` : s; };

// Dời mốc xem đi n kỳ (âm = lùi về quá khứ). Tính bằng giờ UTC để không lệch múi giờ.
function doiMoc(ky, moc, n) {
  const d = new Date(moc + "T00:00:00Z");
  if (ky === "ngay") d.setUTCDate(d.getUTCDate() + n);
  else if (ky === "tuan") d.setUTCDate(d.getUTCDate() + 7 * n);
  else d.setUTCMonth(d.getUTCMonth() + n);
  return ngayISO(d);
}

export default function ManagerPortal() {
  const [tab, setTab] = useState("dieuphoi");
  const name = (store.user && store.user.ho_ten) || "Ban Giám đốc";
  const items = [
    { id: "dieuphoi", label: "Điều phối bệnh nhân", icon: ClipboardList },
    { id: "nhapvien", label: "Nhập viện", icon: BedDouble },
    { id: "tongquan", label: "Giám sát hoạt động", icon: BarChart3 },
    { id: "thuoc", label: "Thuốc đã dùng", icon: PillIcon },
  ];
  return (
    <PortalShell role="manager" tone={T.mint} soft={T.mintSoft} name={name} sub="Quản lý"
      items={items} tab={tab} setTab={setTab}>
      {tab === "dieuphoi" && <DieuPhoiQuanLy />}
      {tab === "nhapvien" && <NhapVienPage quanLy />}
      {tab === "tongquan" && <GiamSat />}
      {tab === "thuoc" && <ThuocQuanLy />}
    </PortalShell>
  );
}

function GiamSat() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [ky, setKy] = useState("ngay");
  const [moc, setMoc] = useState(() => ngayISO(new Date()));
  const [du, setDu] = useState(null);
  const [loi, setLoi] = useState(null);
  const [dangTai, setDangTai] = useState(false);

  useEffect(() => {
    if (!live) return;
    let huy = false;
    setDangTai(true); setLoi(null);
    api.quanLyTongQuan(ky, moc)
      .then((r) => { if (!huy) setDu(r); })
      .catch((e) => { if (!huy) { setDu(null); setLoi(e.message); } })
      .finally(() => { if (!huy) setDangTai(false); });
    return () => { huy = true; };
  }, [live, ky, moc]);

  const doiKy = (id) => { setKy(id); setMoc(ngayISO(new Date())); };

  if (!live) {
    return (<div><PageTitle title="Giám sát hoạt động" sub="Hoạt động khám và doanh thu theo khoa phòng." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản quản lý và kết nối tới máy chủ.</Card></div>);
  }

  const t = du && du.tong;
  const maxDoanhThu = du ? Math.max(1, ...du.theo_moc.map((m) => m.doanh_thu)) : 1;
  const maxKhoa = du ? Math.max(1, ...du.theo_khoa.map((k) => k.tong_doanh_thu)) : 1;

  return (
    <div>
      <PageTitle title="Giám sát hoạt động"
        sub="Hoạt động khám và doanh thu của từng khoa phòng — chọn kỳ ngày, tuần hoặc tháng." />

      {/* Chọn kỳ + điều hướng mốc thời gian */}
      <Card style={{ padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, background: T.bg, padding: 5, borderRadius: 999 }}>
          {KY.map((k) => (
            <button key={k.id} onClick={() => doiKy(k.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
              padding: "9px 18px", borderRadius: 999, fontFamily: "inherit", fontSize: 14, fontWeight: 700,
              background: ky === k.id ? T.surface : "transparent", color: ky === k.id ? T.mint : T.sub,
              boxShadow: ky === k.id ? "0 2px 8px rgba(45,58,78,.10)" : "none",
            }}><k.icon size={16} /> {k.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Btn kind="ghost" size="sm" onClick={() => setMoc(doiMoc(ky, moc, -1))}><ChevronLeft size={15} /> Kỳ trước</Btn>
          <Btn kind="ghost" size="sm" onClick={() => setMoc(doiMoc(ky, moc, 1))}>Kỳ sau <ChevronRight size={15} /></Btn>
          <Btn kind="ghost" size="sm" onClick={() => setMoc(ngayISO(new Date()))}>Hiện tại</Btn>
        </div>

        {du && <Pill tone={T.mint}>{du.nhan_ky} · {fmtNgay(du.tu)} – {fmtNgay(du.den)}</Pill>}
        {dangTai && <span style={{ fontSize: 13, color: T.sub }}>Đang tải số liệu...</span>}
      </Card>

      {loi && <Card style={{ padding: 14, marginBottom: 16, border: "none", background: "#FDECEA", color: "#C0392B", fontSize: 14 }}>{loi}</Card>}

      {du && (
        <>
          {/* Số liệu tổng hợp toàn viện trong kỳ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }} className="grid4">
            <O nhan="Tổng doanh thu" giaTri={tien(t.tong_doanh_thu)} tone={T.mint} icon={Wallet}
              phu={`Dịch vụ ${tien(t.doanh_thu_dich_vu)} · Viện phí ${tien(t.doanh_thu_vien_phi)}`} />
            <O nhan="Lượt khám" giaTri={t.da_kham} tone={T.sky} icon={TrendingUp}
              phu={`${t.luot_dat} lượt đặt · tỷ lệ đến khám ${t.ty_le_den_kham}%`} />
            <O nhan="Người bệnh" giaTri={t.so_benh_nhan} tone={T.lav} icon={Building2}
              phu={`${t.dang_cho} đang chờ khám · ${t.da_huy} đã hủy`} />
            <O nhan="Viện phí còn thiếu" giaTri={tien(t.vien_phi_con_thieu)} tone={T.peach} icon={Wallet}
              phu={`${t.so_phieu_y_lenh} phiếu y lệnh lập trong kỳ`} />
          </div>

          {/* Xu hướng các kỳ liền trước */}
          <Card style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 4 }}>
              Xu hướng doanh thu {ky === "ngay" ? "7 ngày" : ky === "tuan" ? "8 tuần" : "6 tháng"} gần nhất
            </div>
            <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 18 }}>Cột là tổng thực thu, số dưới là lượt đã khám của kỳ đó.</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 170 }}>
              {du.theo_moc.map((m) => (
                <div key={m.tu} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11.5, color: T.sub, fontWeight: 700 }}>
                    {m.doanh_thu ? Math.round(m.doanh_thu / 1000).toLocaleString("vi-VN") + "k" : "—"}
                  </span>
                  <div title={tien(m.doanh_thu)} style={{
                    width: "100%", borderRadius: "10px 10px 4px 4px", minHeight: 4,
                    height: `${Math.max(4, Math.round((m.doanh_thu / maxDoanhThu) * 110))}px`,
                    background: m.tu === du.tu ? `linear-gradient(180deg, ${T.mint}, #3FA589)` : T.mintSoft,
                  }} />
                  <span style={{ fontSize: 11.5, color: m.tu === du.tu ? T.ink : T.sub, fontWeight: m.tu === du.tu ? 800 : 600, textAlign: "center" }}>{m.nhan}</span>
                  <span style={{ fontSize: 11, color: T.sub }}>{m.da_kham} khám</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Bảng chi tiết theo khoa phòng */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={17} color={T.mint} /> Theo khoa phòng ({du.theo_khoa.length})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr style={{ background: T.bg }}>
                    {["Khoa phòng", "Lượt đặt", "Đã khám", "Đã hủy", "Tỷ lệ đến", "Doanh thu dịch vụ", "Viện phí", "Tổng thu"].map((c, i) => (
                      <th key={c} style={{ padding: "11px 16px", fontSize: 12.5, fontWeight: 700, color: T.sub, textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {du.theo_khoa.map((k) => (
                    <tr key={k.id} className="tableRow" style={{ borderTop: `1px solid ${T.line}55` }}>
                      <td style={{ padding: "13px 16px", fontSize: 13.5 }}>
                        <div style={{ fontWeight: 700, color: T.ink }}>{k.ten_khoa}</div>
                        <div style={{ height: 5, borderRadius: 999, background: T.line, marginTop: 6, maxWidth: 180 }}>
                          <div style={{ height: 5, borderRadius: 999, background: T.mint, width: `${Math.round((k.tong_doanh_thu / maxKhoa) * 100)}%` }} />
                        </div>
                      </td>
                      <Td>{k.luot_dat}</Td>
                      <Td>{k.da_kham}</Td>
                      <Td>{k.da_huy}</Td>
                      <Td>{k.luot_dat ? `${k.ty_le_den_kham}%` : "—"}</Td>
                      <Td>{tien(k.doanh_thu_dich_vu)}</Td>
                      <Td>{tien(k.doanh_thu_vien_phi)}</Td>
                      <Td dam>{tien(k.tong_doanh_thu)}</Td>
                    </tr>
                  ))}
                  {/* Khoản thu không quy được về khoa đứng thành MỘT DÒNG riêng, không
                      giấu dưới ghi chú — để không ai đọc nhầm là doanh thu bằng 0. */}
                  {t.chua_phan_bo > 0 && (
                    <tr style={{ borderTop: `1px solid ${T.line}`, background: T.goldSoft + "80" }}>
                      <td style={{ padding: "13px 16px", fontSize: 13.5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, color: "#8A5A00" }}>
                          <AlertTriangle size={15} /> Chưa quy được về khoa
                        </div>
                        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4, maxWidth: 300, lineHeight: 1.5 }}>
                          Khoản thu của phiếu y lệnh không gắn phiếu khám, hoặc phiếu khám không gắn lần khám.
                        </div>
                      </td>
                      <Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td>
                      <Td>{tien(0)}</Td>
                      <Td>{tien(t.chua_phan_bo)}</Td>
                      <Td dam>{tien(t.chua_phan_bo)}</Td>
                    </tr>
                  )}
                  {/* Dòng tổng để đối chiếu: cộng bảng phải ra đúng tổng toàn viện */}
                  <tr style={{ borderTop: `2px solid ${T.line}`, background: T.bg }}>
                    <td style={{ padding: "13px 16px", fontSize: 13.5, fontWeight: 800, color: T.ink }}>Tổng toàn viện</td>
                    <Td dam>{t.luot_dat}</Td>
                    <Td dam>{t.da_kham}</Td>
                    <Td dam>{t.da_huy}</Td>
                    <Td dam>{t.luot_dat ? `${t.ty_le_den_kham}%` : "—"}</Td>
                    <Td dam>{tien(t.doanh_thu_dich_vu)}</Td>
                    <Td dam>{tien(t.doanh_thu_vien_phi)}</Td>
                    <Td dam>{tien(t.tong_doanh_thu)}</Td>
                  </tr>
                </tbody>
              </table>
            </div>
            {du.theo_khoa.length === 0 && <div style={{ padding: 36, textAlign: "center", color: T.sub }}>Chưa có khoa phòng nào trong danh mục.</div>}
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.line}`, fontSize: 12.5, color: T.sub, lineHeight: 1.6 }}>
              Lượt khám tính theo ngày khám của khung giờ. Doanh thu tính theo ngày thực thu, gồm hóa đơn dịch vụ đã thanh toán và từng lần thu của phiếu y lệnh; quy về khoa qua lần khám tương ứng. Dòng tổng có thể lớn hơn tổng các khoa vì gồm cả phần chưa quy được về khoa.
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function O({ nhan, giaTri, phu, tone, icon: Icon }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 12, background: tone + "1A", color: tone, display: "grid", placeItems: "center" }}><Icon size={18} /></span>
        <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>{nhan}</span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: T.ink, lineHeight: 1.2 }}>{giaTri}</div>
      {phu && <div style={{ fontSize: 12, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>{phu}</div>}
    </Card>
  );
}

function Td({ children, dam }) {
  return <td style={{ padding: "13px 16px", fontSize: 13.5, textAlign: "right", whiteSpace: "nowrap", color: dam ? T.ink : T.sub, fontWeight: dam ? 800 : 600 }}>{children}</td>;
}
