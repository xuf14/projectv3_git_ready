import React, { useState, useEffect, useRef } from "react";
import {
  CalendarClock, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Layers,
  Pill as PillIcon, Table2, TrendingUp, Users, Wallet,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle } from "./shared";

// ============================================================================
//  THUỐC ĐÃ DÙNG CHO NGƯỜI BỆNH — mục biểu đồ của cổng Quản lý.
//  Nguồn: GET /api/quan-ly/thuoc — các dòng THUỐC của phiếu y lệnh, tức thuốc
//  thực cấp và tính tiền cho người bệnh (không phải đơn bác sĩ kê).
//
//  Quy ước biểu đồ (theo bộ nguyên tắc trực quan hóa dữ liệu của dự án):
//    - Mọi biểu đồ ở đây là MỘT chuỗi số đo độ lớn → một màu xanh duy nhất,
//      không chú giải (tiêu đề đã gọi tên chuỗi). Màu đã chạy bộ kiểm tra
//      tương phản trên nền trắng của ứng dụng.
//    - Thanh mảnh ≤ 24px, đầu dữ liệu bo 4px, gốc vuông; chữ luôn dùng màu chữ,
//      không dùng màu của thanh.
//    - Rê chuột hoặc Tab tới từng thanh để xem đủ số liệu; bảng chi tiết cuối
//      trang là cách đọc thay thế không phụ thuộc màu.
// ============================================================================

const MAU = { dam: "#2a78d6", nhat: "#86b6ef" }; // cùng một sắc xanh, hai bậc sáng
const KY = [
  { id: "ngay", label: "Ngày", icon: CalendarDays },
  { id: "tuan", label: "Tuần", icon: CalendarRange },
  { id: "thang", label: "Tháng", icon: CalendarClock },
];
const CHI_SO = [
  { id: "gia_tri", label: "Giá trị" },
  { id: "so_luot", label: "Lượt cấp" },
  { id: "so_benh_nhan", label: "Người bệnh" },
];
const SO_CUOT_TOP = 10;

const tien = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const so = (n) => (Number(n) || 0).toLocaleString("vi-VN");
const ngayISO = (d) => d.toISOString().slice(0, 10);
const fmtNgay = (s) => { const [y, m, d] = String(s).split("-"); return d ? `${d}/${m}/${y}` : s; };
// Dời mốc xem n kỳ; tính bằng giờ UTC để không lệch múi giờ
function doiMoc(ky, moc, n) {
  const d = new Date(moc + "T00:00:00Z");
  if (ky === "ngay") d.setUTCDate(d.getUTCDate() + n);
  else if (ky === "tuan") d.setUTCDate(d.getUTCDate() + 7 * n);
  else d.setUTCMonth(d.getUTCMonth() + n);
  return ngayISO(d);
}
const dinhDang = (chiSo, v) => (chiSo === "gia_tri" ? tien(v) : so(v));

export default function ThuocQuanLy() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [ky, setKy] = useState("thang");
  const [moc, setMoc] = useState(() => ngayISO(new Date()));
  const [chiSo, setChiSo] = useState("gia_tri");
  const [du, setDu] = useState(null);
  const [loi, setLoi] = useState(null);
  const [dangTai, setDangTai] = useState(false);

  useEffect(() => {
    if (!live) return;
    let huy = false;
    setDangTai(true); setLoi(null);
    api.quanLyThuoc(ky, moc)
      .then((r) => { if (!huy) setDu(r); })
      .catch((e) => { if (!huy) { setDu(null); setLoi(e.message); } })
      .finally(() => { if (!huy) setDangTai(false); });
    return () => { huy = true; };
  }, [live, ky, moc]);

  if (!live) {
    return (<div><PageTitle title="Thuốc đã dùng" sub="Tổng hợp thuốc cấp cho người bệnh." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản quản lý và kết nối tới máy chủ.</Card></div>);
  }

  const t = du && du.tong;
  const rong = du && du.theo_thuoc.length === 0;
  // Top thuốc theo chỉ số đang chọn; hòa thì xếp theo giá trị cho ổn định
  const top = du
    ? [...du.theo_thuoc].sort((a, b) => b[chiSo] - a[chiSo] || b.gia_tri - a.gia_tri).slice(0, SO_CUOT_TOP)
    : [];
  const conLai = du ? Math.max(du.theo_thuoc.length - SO_CUOT_TOP, 0) : 0;

  return (
    <div>
      <PageTitle title="Thuốc đã dùng cho người bệnh"
        sub="Thuốc thực cấp và tính tiền qua phiếu y lệnh — theo loại thuốc, nhóm thuốc, khoa và theo thời gian." />

      {/* Bộ lọc chung: một hàng, phía trên mọi biểu đồ */}
      <Card style={{ padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <PhanDoan muc={KY} dangChon={ky} onChon={(id) => { setKy(id); setMoc(ngayISO(new Date())); }} />
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }} className="grid4">
            <O nhan="Giá trị thuốc đã cấp" giaTri={tien(t.gia_tri)} icon={Wallet} phu={`${so(t.so_phieu)} phiếu y lệnh có thuốc`} />
            <O nhan="Lượt cấp thuốc" giaTri={so(t.so_luot)} icon={PillIcon} phu="Mỗi dòng thuốc trên phiếu là một lượt" />
            <O nhan="Số loại thuốc" giaTri={so(t.so_loai)} icon={Layers} phu={`${so(du.theo_nhom.length)} nhóm thuốc`} />
            <O nhan="Người bệnh dùng thuốc" giaTri={so(t.so_benh_nhan)} icon={Users}
              phu={t.so_phieu_khong_ro_bn > 0 ? `Chưa tính ${so(t.so_phieu_khong_ro_bn)} phiếu không gắn người bệnh` : "Đếm theo hồ sơ bệnh nhân"} />
          </div>

          {rong ? (
            <Card style={{ padding: 40, textAlign: "center", color: T.sub, marginBottom: 16 }}>
              Chưa có thuốc nào được cấp cho người bệnh trong kỳ này.
            </Card>
          ) : (
            <>
              <Card style={{ padding: 20, marginBottom: 16 }}>
                <TieuDe icon={PillIcon}
                  chinh={`Thuốc dùng nhiều nhất — theo ${CHI_SO.find((c) => c.id === chiSo).label.toLowerCase()}`}
                  phu={`${top.length} loại đứng đầu${conLai ? `, còn ${conLai} loại khác trong bảng chi tiết` : ""}.`}
                  phai={<PhanDoan muc={CHI_SO} dangChon={chiSo} onChon={setChiSo} nho />} />
                <ThanhNgang
                  hang={top.map((th) => ({
                    key: th.ma || th.ten,
                    nhan: th.ten,
                    phu: th.nhom || (th.ma ? th.ma : "Gõ tay, chưa có mã"),
                    giaTri: th[chiSo],
                    chiTiet: [
                      ["Giá trị", tien(th.gia_tri)],
                      ["Số lượng", `${so(th.so_luong)}${th.dvt ? ` ${th.dvt}` : ""}`],
                      ["Lượt cấp", so(th.so_luot)],
                      ["Người bệnh", so(th.so_benh_nhan)],
                      ["Nhóm", th.nhom || "Chưa phân nhóm"],
                    ],
                  }))}
                  dinhDang={(v) => dinhDang(chiSo, v)} />
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="grid2">
                <Card style={{ padding: 20 }}>
                  <TieuDe icon={Layers} chinh="Giá trị theo nhóm thuốc" phu="Nhóm lấy từ danh mục thuốc; thuốc gõ tay không có mã nằm ở “Chưa phân nhóm”." />
                  <ThanhNgang cotNhan={150}
                    hang={du.theo_nhom.map((n) => ({
                      key: n.nhom, nhan: n.nhom, giaTri: n.gia_tri, nhat: n.nhom === "Chưa phân nhóm",
                      chiTiet: [["Giá trị", tien(n.gia_tri)], ["Lượt cấp", so(n.so_luot)], ["Số loại thuốc", so(n.so_loai)]],
                    }))}
                    dinhDang={tien} />
                </Card>
                <Card style={{ padding: 20 }}>
                  <TieuDe icon={Users} chinh="Giá trị theo khoa" phu="Quy về khoa qua lần khám của phiếu; phiếu không gắn lần khám tách riêng." />
                  <ThanhNgang cotNhan={150}
                    hang={du.theo_khoa.map((k) => ({
                      key: k.id || "chua-quy", nhan: k.ten_khoa, giaTri: k.gia_tri, nhat: !k.id,
                      chiTiet: [["Giá trị", tien(k.gia_tri)], ["Lượt cấp", so(k.so_luot)]],
                    }))}
                    dinhDang={tien} />
                </Card>
              </div>
            </>
          )}

          <Card style={{ padding: 20, marginBottom: 16 }}>
            <TieuDe icon={TrendingUp}
              chinh={`Giá trị thuốc ${ky === "ngay" ? "7 ngày" : ky === "tuan" ? "8 tuần" : "6 tháng"} gần nhất`}
              phu="Cột đậm là kỳ đang xem; rê chuột lên từng cột để xem số lượt cấp." />
            <CotDoc moc={du.theo_moc} tuDangXem={du.tu} />
          </Card>

          {!rong && <BangChiTiet ds={du.theo_thuoc} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  THANH NGANG — so sánh độ lớn giữa các mục có tên dài (thuốc, nhóm, khoa).
// ---------------------------------------------------------------------------
function ThanhNgang({ hang, dinhDang, cotNhan = 230 }) {
  const khung = useRef(null);
  const [goi, setGoi] = useState(null);   // { x, y, hang }
  const max = Math.max(1, ...hang.map((h) => h.giaTri));

  const hien = (e, h) => {
    const r = khung.current.getBoundingClientRect();
    const toaDo = e.clientX != null && e.type !== "focus"
      ? { x: e.clientX - r.left, y: e.clientY - r.top }
      : { x: cotNhan + 40, y: e.currentTarget.offsetTop + 10 };
    setGoi({ ...toaDo, hang: h });
  };

  if (!hang.length) return <div style={{ padding: 24, textAlign: "center", color: T.sub, fontSize: 13.5 }}>Không có dữ liệu.</div>;

  return (
    <div ref={khung} style={{ position: "relative" }} onMouseLeave={() => setGoi(null)}>
      {hang.map((h) => {
        const tiLe = h.giaTri / max;
        return (
          <div key={h.key} tabIndex={0} role="img"
            aria-label={`${h.nhan}: ${dinhDang(h.giaTri)}`}
            onMouseMove={(e) => hien(e, h)} onFocus={(e) => hien(e, h)} onBlur={() => setGoi(null)}
            style={{ display: "grid", gridTemplateColumns: `${cotNhan}px 1fr`, alignItems: "center", gap: 12,
              padding: "5px 0", outline: "none", borderRadius: 8,
              background: goi && goi.hang.key === h.key ? T.bg : "transparent" }}>
            <div style={{ minWidth: 0 }}>
              <div title={h.nhan} style={{ fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.nhan}</div>
              {h.phu && <div title={h.phu} style={{ fontSize: 11.5, color: T.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.phu}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {/* Chừa 110px cho nhãn số để thanh dài nhất không đẩy nhãn tràn ra ngoài */}
              <div style={{
                height: 18, borderRadius: "0 4px 4px 0", flexShrink: 0,
                width: h.giaTri > 0 ? `max(3px, calc((100% - 110px) * ${tiLe}))` : 0,
                background: h.nhat ? MAU.nhat : MAU.dam,
              }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{dinhDang(h.giaTri)}</span>
            </div>
          </div>
        );
      })}
      {goi && <GoiY x={goi.x} y={goi.y} tieuDe={goi.hang.nhan} dong={goi.hang.chiTiet} khung={khung} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  CỘT DỌC — giá trị thuốc theo các kỳ liền trước; kỳ đang xem tô đậm.
// ---------------------------------------------------------------------------
function CotDoc({ moc, tuDangXem }) {
  const khung = useRef(null);
  const [goi, setGoi] = useState(null);
  const max = Math.max(1, ...moc.map((m) => m.gia_tri));
  const CAO = 150;

  const hien = (e, m) => {
    const r = khung.current.getBoundingClientRect();
    const o = e.currentTarget.getBoundingClientRect();
    setGoi({ x: o.left - r.left + o.width / 2, y: 20, m });
  };

  return (
    <div ref={khung} style={{ position: "relative" }} onMouseLeave={() => setGoi(null)}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: CAO + 24, borderBottom: `1px solid ${T.line}` }}>
        {moc.map((m) => {
          const dangXem = m.tu === tuDangXem;
          const cao = m.gia_tri > 0 ? Math.max(3, Math.round((m.gia_tri / max) * CAO)) : 0;
          return (
            // Vùng rê chuột là cả khe cột, rộng hơn thanh 24px
            <div key={m.tu} tabIndex={0} role="img" aria-label={`${m.nhan}: ${tien(m.gia_tri)}, ${m.so_luot} lượt cấp`}
              onMouseEnter={(e) => hien(e, m)} onFocus={(e) => hien(e, m)} onBlur={() => setGoi(null)}
              style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", outline: "none",
                background: goi && goi.m.tu === m.tu ? T.bg : "transparent", borderRadius: "8px 8px 0 0" }}>
              {dangXem && m.gia_tri > 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, marginBottom: 4, whiteSpace: "nowrap" }}>{tien(m.gia_tri)}</span>
              )}
              <div style={{ width: 24, height: cao, borderRadius: "4px 4px 0 0", background: dangXem ? MAU.dam : MAU.nhat }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {moc.map((m) => (
          <span key={m.tu} style={{ flex: 1, textAlign: "center", fontSize: 11.5, color: m.tu === tuDangXem ? T.ink : T.sub, fontWeight: m.tu === tuDangXem ? 800 : 600 }}>{m.nhan}</span>
        ))}
      </div>
      {goi && <GoiY x={goi.x} y={goi.y} tieuDe={goi.m.nhan} khung={khung}
        dong={[["Giá trị", tien(goi.m.gia_tri)], ["Lượt cấp", so(goi.m.so_luot)]]} />}
    </div>
  );
}

// Hộp gợi ý khi rê chuột — tự lật sang trái khi sát mép phải của biểu đồ
function GoiY({ x, y, tieuDe, dong, khung }) {
  const rong = khung.current ? khung.current.clientWidth : 600;
  const trai = x + 250 > rong ? Math.max(0, x - 240) : x + 14;
  return (
    <div role="tooltip" style={{
      position: "absolute", left: trai, top: y + 12, zIndex: 5, pointerEvents: "none",
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12,
      boxShadow: "0 12px 30px rgba(45,58,78,.14)", padding: "10px 12px", minWidth: 190, maxWidth: 240,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{tieuDe}</div>
      {dong.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "2px 0" }}>
          <span style={{ color: T.sub }}>{k}</span><b style={{ color: T.ink, textAlign: "right" }}>{v}</b>
        </div>
      ))}
    </div>
  );
}

function BangChiTiet({ ds }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
        <Table2 size={17} color={T.sub} /> Bảng chi tiết ({ds.length} loại thuốc)
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: T.bg }}>
              {["Thuốc", "Nhóm", "Số lượng", "Lượt cấp", "Người bệnh", "Giá trị"].map((c, i) => (
                <th key={c} style={{ padding: "11px 16px", fontSize: 12.5, fontWeight: 700, color: T.sub, textAlign: i < 2 ? "left" : "right", whiteSpace: "nowrap" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ds.map((th) => (
              <tr key={th.ma || th.ten} className="tableRow" style={{ borderTop: `1px solid ${T.line}55` }}>
                <td style={{ padding: "11px 16px", fontSize: 13.5 }}>
                  <div style={{ fontWeight: 700, color: T.ink }}>{th.ten}</div>
                  <div style={{ fontSize: 11.5, color: T.sub }}>{th.ma || "Gõ tay, chưa có mã"}</div>
                </td>
                <td style={{ padding: "11px 16px", fontSize: 13, color: T.sub }}>{th.nhom || "Chưa phân nhóm"}</td>
                <Td>{so(th.so_luong)}{th.dvt ? ` ${th.dvt}` : ""}</Td>
                <Td>{so(th.so_luot)}</Td>
                <Td>{so(th.so_benh_nhan)}</Td>
                <Td dam>{tien(th.gia_tri)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PhanDoan({ muc, dangChon, onChon, nho }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 4, background: T.bg, padding: 4, borderRadius: 999, flexWrap: "wrap" }}>
      {muc.map((m) => {
        const on = dangChon === m.id;
        return (
          <button key={m.id} role="tab" aria-selected={on} onClick={() => onChon(m.id)} style={{
            display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
            padding: nho ? "6px 12px" : "9px 18px", borderRadius: 999, fontFamily: "inherit",
            fontSize: nho ? 12.5 : 14, fontWeight: 700,
            background: on ? T.surface : "transparent", color: on ? T.ink : T.sub,
            boxShadow: on ? "0 2px 8px rgba(45,58,78,.10)" : "none",
          }}>{m.icon ? <m.icon size={15} /> : null}{m.label}</button>
        );
      })}
    </div>
  );
}

function TieuDe({ icon: Icon, chinh, phu, phai }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
      <div>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={17} color={T.sub} /> {chinh}
        </div>
        {phu && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>{phu}</div>}
      </div>
      {phai}
    </div>
  );
}

function O({ nhan, giaTri, phu, icon: Icon }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 12, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center" }}><Icon size={18} /></span>
        <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>{nhan}</span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: T.ink, lineHeight: 1.2 }}>{giaTri}</div>
      {phu && <div style={{ fontSize: 12, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>{phu}</div>}
    </Card>
  );
}

function Td({ children, dam }) {
  return <td style={{ padding: "11px 16px", fontSize: 13.5, textAlign: "right", whiteSpace: "nowrap", color: dam ? T.ink : T.sub, fontWeight: dam ? 800 : 600 }}>{children}</td>;
}
