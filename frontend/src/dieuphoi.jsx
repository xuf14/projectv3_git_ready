import React, { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, ArrowRight, CalendarClock, Check, ClipboardList, DoorOpen,
  RefreshCw, Search, Stethoscope, User, X,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  ĐIỀU PHỐI BỆNH NHÂN VÀO KHOA PHÒNG — dùng chung cho hai cổng:
//    DieuPhoiQuanLy — quản lý duyệt khoa tiếp nhận và chỉ định bác sĩ
//    DieuPhoiLeTan  — lễ tân xác nhận đã đưa người bệnh tới phòng
//  Cả hai mở CÙNG một popup chi tiết; nút thao tác trong popup hiện theo vai trò.
//  Mọi điều kiện đều do máy chủ chốt (bác sĩ phải thuộc khoa vừa duyệt, chưa
//  chỉ định thì không chuyển phòng được, đã tới phòng thì không sửa nữa).
//    GET /dieu-phoi · GET /dieu-phoi/:id · POST /dieu-phoi/:id/{chi-dinh,
//    tu-choi, chuyen-phong}
// ============================================================================

const inp = { ...input, padding: "10px 12px", fontSize: 14, borderRadius: 10 };
const TONE = {
  cho_duyet: T.gold, da_chi_dinh: T.sky, da_chuyen_phong: T.mint, tu_choi: T.sub,
};
const gio = (d) => { const x = new Date(d); return isNaN(x) ? "—" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
const ngaySinh = (s) => { const x = new Date(s); return isNaN(x) ? "—" : x.toLocaleDateString("vi-VN"); };
const tuoi = (s) => { if (!s) return ""; const d = new Date(s); if (isNaN(d)) return ""; const t = new Date(); let a = t.getFullYear() - d.getFullYear(); const m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--; return a >= 0 ? `${a} tuổi` : ""; };

export function DieuPhoiQuanLy() { return <DieuPhoi vaiTro="quan_ly" />; }
export function DieuPhoiLeTan() { return <DieuPhoi vaiTro="le_tan" />; }

function DieuPhoi({ vaiTro }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const laQuanLy = vaiTro === "quan_ly";
  // Lễ tân chỉ quan tâm người đã được chỉ định, đang chờ đưa tới phòng
  const [loc, setLoc] = useState(laQuanLy ? "cho_duyet" : "da_chi_dinh");
  const [tuKhoa, setTuKhoa] = useState("");
  const [list, setList] = useState([]);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState(null);
  const [moId, setMoId] = useState(null);

  const nap = useCallback(() => {
    if (!live) return;
    setDangTai(true); setLoi(null);
    api.dieuPhoiList({ trang_thai: loc, q: tuKhoa || undefined })
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setList([]); setLoi(e.message); })
      .finally(() => setDangTai(false));
  }, [live, loc, tuKhoa]);
  useEffect(() => { nap(); }, [nap]);

  const BO_LOC = laQuanLy
    ? [["cho_duyet", "Chờ duyệt"], ["da_chi_dinh", "Chờ chuyển phòng"], ["da_chuyen_phong", "Đã tới phòng"], ["tat_ca", "Tất cả"]]
    : [["da_chi_dinh", "Chờ chuyển phòng"], ["da_chuyen_phong", "Đã tới phòng"], ["cho_duyet", "Chờ quản lý duyệt"], ["tat_ca", "Tất cả"]];

  if (!live) {
    return (<div><PageTitle title="Điều phối bệnh nhân" sub="Phân khoa và chỉ định bác sĩ sau khi tiếp đón." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập và kết nối tới máy chủ.</Card></div>);
  }

  return (
    <div>
      <PageTitle title="Điều phối bệnh nhân"
        sub={laQuanLy
          ? "Người bệnh đã tiếp đón đang chờ phân khoa — duyệt khoa tiếp nhận và chỉ định bác sĩ phụ trách."
          : "Người bệnh đã được quản lý chỉ định — xác nhận khi đã đưa tới phòng khám."} />

      <Card style={{ padding: 16, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, background: T.bg, padding: 5, borderRadius: 999, flexWrap: "wrap" }}>
          {BO_LOC.map(([id, label]) => (
            <button key={id} onClick={() => setLoc(id)} style={{
              border: "none", cursor: "pointer", padding: "8px 16px", borderRadius: 999,
              fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
              background: loc === id ? T.surface : "transparent", color: loc === id ? T.ink : T.sub,
              boxShadow: loc === id ? "0 2px 8px rgba(45,58,78,.10)" : "none",
            }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 190, display: "flex", alignItems: "center", gap: 9, border: `1.5px solid ${T.line}`, borderRadius: 11, padding: "0 12px" }}>
          <Search size={16} color={T.sub} />
          <input value={tuKhoa} onChange={(e) => setTuKhoa(e.target.value)} placeholder="Tên, mã bệnh nhân hoặc mã lịch hẹn"
            style={{ flex: 1, border: "none", outline: "none", padding: "10px 0", fontSize: 14, fontFamily: "inherit", background: "transparent" }} />
        </div>
        <Btn kind="ghost" size="sm" onClick={nap}><RefreshCw size={15} /> Tải lại</Btn>
      </Card>

      {loi && <Card style={{ padding: 14, marginBottom: 16, border: "none", background: "#FDECEA", color: "#C0392B", fontSize: 14 }}>{loi}</Card>}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
          <ClipboardList size={17} color={laQuanLy ? T.mint : T.gold} /> Danh sách ({list.length})
          {dangTai && <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>· đang tải...</span>}
        </div>
        {list.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: T.sub }}>
            {dangTai ? "Đang tải..." : "Không có người bệnh nào ở trạng thái này."}
          </div>
        ) : list.map((d, i) => (
          <button key={d.id} type="button" onClick={() => setMoId(d.id)} className="rsItem"
            style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
              border: "none", borderTop: i ? `1px solid ${T.line}55` : "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: (TONE[d.trang_thai] || T.sub) + "1A", color: TONE[d.trang_thai] || T.sub, display: "grid", placeItems: "center", flexShrink: 0 }}>
              {d.lich_hen && d.lich_hen.so_thu_tu
                ? <b style={{ fontSize: 14 }}>{d.lich_hen.so_thu_tu}</b>
                : <User size={18} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700, color: T.ink, fontSize: 14.5 }}>
                {d.benh_nhan ? d.benh_nhan.ho_ten : "—"}
                {d.benh_nhan && d.benh_nhan.ma_benh_nhan ? <span style={{ color: T.sub, fontWeight: 600, fontSize: 13 }}> · {d.benh_nhan.ma_benh_nhan}</span> : null}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: T.sub, marginTop: 3 }}>
                Tiếp đón {gio(d.thoi_gian_tiep_don)}
                {d.lich_hen && d.lich_hen.gio ? ` · hẹn ${d.lich_hen.gio}` : ""}
                {d.khoa ? ` · ${d.khoa.ten_khoa}` : d.lich_hen && d.lich_hen.khoa_dat_lich ? ` · ${d.lich_hen.khoa_dat_lich} (đặt lịch)` : ""}
                {d.bac_si ? ` · ${d.bac_si.ho_ten}` : ""}
                {d.phong ? ` · ${d.phong}` : ""}
              </span>
            </span>
            <Pill tone={TONE[d.trang_thai] || T.sub}>{d.nhan_trang_thai}</Pill>
          </button>
        ))}
      </Card>

      {moId && <PopupChiTiet id={moId} vaiTro={vaiTro} onClose={() => setMoId(null)} onChanged={nap} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  POPUP — hồ sơ đầy đủ + dòng thời gian trạng thái + thao tác theo vai trò.
// ---------------------------------------------------------------------------
function PopupChiTiet({ id, vaiTro, onClose, onChanged }) {
  const { departments } = useNav();
  const laQuanLy = vaiTro === "quan_ly";
  const [d, setD] = useState(null);
  const [loi, setLoi] = useState(null);
  const [busy, setBusy] = useState(false);
  const [khoaId, setKhoaId] = useState("");
  const [bacSiId, setBacSiId] = useState("");
  const [bacSis, setBacSis] = useState([]);
  const [ghiChu, setGhiChu] = useState("");
  const [phong, setPhong] = useState("");
  const [hoan, setHoan] = useState(false);
  const [lyDo, setLyDo] = useState("");

  const nap = useCallback(() => api.dieuPhoiChiTiet(id)
    .then((r) => {
      setD(r);
      setKhoaId(r.khoa ? String(r.khoa.id) : "");
      setBacSiId(r.bac_si ? String(r.bac_si.id) : "");
      setGhiChu(r.ghi_chu || "");
      setPhong(r.phong || "");
    })
    .catch((e) => setLoi(e.message)), [id]);
  useEffect(() => { nap(); }, [nap]);

  // Danh sách bác sĩ đổi theo khoa đang chọn; đổi khoa thì bỏ bác sĩ đã chọn
  useEffect(() => {
    if (!khoaId) { setBacSis([]); return; }
    let song = true;
    api.dieuPhoiBacSi(khoaId)
      .then((r) => {
        if (!song) return;
        const ds = Array.isArray(r) ? r : [];
        setBacSis(ds);
        setBacSiId((cu) => (ds.some((b) => String(b.id) === String(cu)) ? cu : ""));
      })
      .catch(() => { if (song) setBacSis([]); });
    return () => { song = false; };
  }, [khoaId]);

  const chay = async (fn) => {
    setBusy(true); setLoi(null);
    try { const r = await fn(); setD(r); onChanged(); }
    catch (e) { setLoi(e.message); }
    finally { setBusy(false); }
  };

  const chiDinh = () => {
    if (!khoaId) { setLoi("Chọn khoa tiếp nhận."); return; }
    if (!bacSiId) { setLoi("Chọn bác sĩ phụ trách."); return; }
    chay(() => api.dieuPhoiChiDinh(id, { khoa_id: khoaId, bac_si_id: bacSiId, ghi_chu: ghiChu || undefined }));
  };
  const chuyenPhong = () => {
    if (!phong.trim()) { setLoi("Ghi rõ phòng đã đưa người bệnh tới."); return; }
    chay(() => api.dieuPhoiChuyenPhong(id, { phong }));
  };
  const xacNhanHoan = () => {
    if (!lyDo.trim()) { setLoi("Ghi rõ lý do hoãn."); return; }
    chay(async () => { const r = await api.dieuPhoiTuChoi(id, { ly_do_tu_choi: lyDo }); setHoan(false); setLyDo(""); return r; });
  };

  const bn = d && d.benh_nhan;
  const lh = d && d.lich_hen;
  const khoa = departments.filter((k) => k.dbId);
  const daTiepNhan = d && d.trang_thai === "da_chuyen_phong";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,58,78,.42)", display: "grid", placeItems: "center", padding: 20, zIndex: 60 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto", padding: 0 }}>
        <div style={{ position: "sticky", top: 0, background: T.surface, borderBottom: `1px solid ${T.line}`, padding: "16px 22px", display: "flex", alignItems: "center", gap: 12, zIndex: 1 }}>
          <span style={{ width: 40, height: 40, borderRadius: 13, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center" }}><User size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: T.ink, fontSize: 17 }}>{bn ? bn.ho_ten : "Đang tải..."}</div>
            <div style={{ fontSize: 12.5, color: T.sub }}>
              {bn ? `${bn.ma_benh_nhan}${bn.ngay_sinh ? ` · ${ngaySinh(bn.ngay_sinh)} (${tuoi(bn.ngay_sinh)})` : ""}${bn.gioi_tinh ? ` · ${bn.gioi_tinh}` : ""}` : ""}
            </div>
          </div>
          {d && <Pill tone={TONE[d.trang_thai] || T.sub}>{d.nhan_trang_thai}</Pill>}
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: T.sub, padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ padding: 22 }}>
          {loi && <div style={{ padding: "10px 13px", marginBottom: 14, borderRadius: 11, fontSize: 13.5, background: "#FDECEA", color: "#C0392B" }}>{loi}</div>}
          {!d ? <div style={{ padding: 30, textAlign: "center", color: T.sub }}>Đang tải hồ sơ...</div> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }} className="grid2">
                <Khoi tieuDe="Hành chính">
                  <Dong nhan="Số điện thoại" gt={bn && bn.sdt} />
                  <Dong nhan="Địa chỉ" gt={bn && bn.dia_chi} />
                  <Dong nhan="Số thẻ BHYT" gt={bn && bn.so_bhyt} />
                  <Dong nhan="Số lần đã khám" gt={d.so_lan_da_kham != null ? `${d.so_lan_da_kham} lần` : null} />
                </Khoi>
                <Khoi tieuDe="Lần khám">
                  <Dong nhan="Mã lịch hẹn" gt={lh && lh.ma_lich_hen} />
                  <Dong nhan="Khung giờ" gt={lh ? `${lh.ngay ? new Date(lh.ngay).toLocaleDateString("vi-VN") : "—"}${lh.gio ? ` · ${lh.gio}` : ""}` : null} />
                  <Dong nhan="Số thứ tự" gt={lh && lh.so_thu_tu ? `#${lh.so_thu_tu}` : null} />
                  <Dong nhan="Đặt lịch ban đầu" gt={lh ? `${lh.khoa_dat_lich || "—"}${lh.bac_si_dat_lich ? ` · ${lh.bac_si_dat_lich}` : ""}` : null} />
                </Khoi>
              </div>

              {/* Dòng thời gian — ai làm gì, lúc nào */}
              <Khoi tieuDe="Tiến trình" style={{ marginBottom: 18 }}>
                <Moc xong nhan="Lễ tân tiếp đón" phu={gio(d.thoi_gian_tiep_don)} />
                <Moc xong={!!d.thoi_gian_chi_dinh} nhan={d.trang_thai === "tu_choi" ? "Quản lý hoãn / từ chối" : "Quản lý duyệt khoa và chỉ định bác sĩ"}
                  phu={d.thoi_gian_chi_dinh
                    ? `${gio(d.thoi_gian_chi_dinh)}${d.nguoi_duyet ? ` · ${d.nguoi_duyet.ho_ten}` : ""}${d.khoa ? ` · ${d.khoa.ten_khoa}` : ""}${d.bac_si ? ` · ${d.bac_si.ho_ten}` : ""}`
                    : "Chưa thực hiện"} />
                <Moc xong={!!d.thoi_gian_chuyen_phong} cuoi nhan="Lễ tân xác nhận đã tới phòng"
                  phu={d.thoi_gian_chuyen_phong
                    ? `${gio(d.thoi_gian_chuyen_phong)}${d.nguoi_chuyen_phong ? ` · ${d.nguoi_chuyen_phong.ho_ten}` : ""}${d.phong ? ` · ${d.phong}` : ""}`
                    : "Chưa thực hiện"} />
                {d.ghi_chu && <div style={{ fontSize: 13, color: T.sub, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>Ghi chú của quản lý: <span style={{ color: T.ink }}>{d.ghi_chu}</span></div>}
                {d.ly_do_tu_choi && <div style={{ fontSize: 13, color: T.peach, marginTop: 10 }}>Lý do hoãn: {d.ly_do_tu_choi}</div>}
              </Khoi>

              {d.phieu_kham_gan_day && d.phieu_kham_gan_day.length > 0 && (
                <Khoi tieuDe={`Phiếu khám gần đây (${d.phieu_kham_gan_day.length})`} style={{ marginBottom: 18 }}>
                  {d.phieu_kham_gan_day.map((p) => (
                    <div key={p.id} style={{ fontSize: 13, color: T.sub, padding: "5px 0" }}>
                      <b style={{ color: T.ink }}>{p.ma_kcb || `#${p.id}`}</b> · {gio(p.ngay_tao)}
                      {p.chuyen_khoa ? ` · ${p.chuyen_khoa}` : ""}
                      {p.chan_doan_so_bo ? ` — ${p.chan_doan_so_bo}` : ""}
                    </div>
                  ))}
                </Khoi>
              )}

              {/* --- Thao tác của QUẢN LÝ --- */}
              {laQuanLy && !daTiepNhan && (
                <Khoi tieuDe="Duyệt khoa và chỉ định bác sĩ" nen={T.mintSoft}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }} className="grid2">
                    <label style={{ display: "block" }}>
                      <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, display: "block", marginBottom: 5 }}>Khoa tiếp nhận *</span>
                      <select value={khoaId} onChange={(e) => setKhoaId(e.target.value)} style={{ ...inp, background: "#fff" }}>
                        <option value="">— Chọn khoa —</option>
                        {khoa.map((k) => <option key={k.dbId} value={k.dbId}>{k.name}</option>)}
                      </select>
                    </label>
                    <label style={{ display: "block" }}>
                      <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, display: "block", marginBottom: 5 }}>Bác sĩ phụ trách *</span>
                      <select value={bacSiId} onChange={(e) => setBacSiId(e.target.value)} style={{ ...inp, background: "#fff" }} disabled={!khoaId}>
                        <option value="">{khoaId ? (bacSis.length ? "— Chọn bác sĩ —" : "Khoa này chưa có bác sĩ") : "Chọn khoa trước"}</option>
                        {bacSis.map((b) => <option key={b.id} value={b.id}>{b.ho_ten}{b.chuyen_mon ? ` · ${b.chuyen_mon}` : ""}</option>)}
                      </select>
                    </label>
                  </div>
                  <label style={{ display: "block", marginBottom: 12 }}>
                    <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, display: "block", marginBottom: 5 }}>Ghi chú cho lễ tân và bác sĩ</span>
                    <textarea value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} rows={2}
                      style={{ ...inp, background: "#fff", resize: "vertical" }} placeholder="VD: ưu tiên khám trước, người bệnh đi lại khó khăn..." />
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn kind="mint" size="sm" disabled={busy} onClick={chiDinh}>
                      <Check size={15} /> {d.trang_thai === "cho_duyet" ? "Duyệt và chỉ định" : "Cập nhật chỉ định"}
                    </Btn>
                    <Btn kind="ghost" size="sm" disabled={busy} onClick={() => { setHoan((v) => !v); setLoi(null); }}>
                      <AlertTriangle size={15} /> Hoãn / từ chối
                    </Btn>
                  </div>
                  {hoan && (
                    <div style={{ marginTop: 12, padding: 12, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 11 }}>
                      <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, display: "block", marginBottom: 5 }}>Lý do hoãn / từ chối *</span>
                      <textarea value={lyDo} onChange={(e) => setLyDo(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <Btn kind="primary" size="sm" disabled={busy} onClick={xacNhanHoan}>Xác nhận hoãn</Btn>
                        <Btn kind="ghost" size="sm" disabled={busy} onClick={() => { setHoan(false); setLyDo(""); }}>Bỏ qua</Btn>
                      </div>
                    </div>
                  )}
                </Khoi>
              )}

              {/* --- Thao tác của LỄ TÂN --- */}
              {!laQuanLy && !daTiepNhan && (
                <Khoi tieuDe="Xác nhận đã đưa tới phòng" nen={T.goldSoft}>
                  {d.trang_thai === "cho_duyet" ? (
                    <div style={{ fontSize: 13.5, color: "#8A5A00" }}>
                      Quản lý chưa phân khoa cho người bệnh này. Chờ quản lý duyệt rồi mới xác nhận chuyển phòng được.
                    </div>
                  ) : d.trang_thai === "tu_choi" ? (
                    <div style={{ fontSize: 13.5, color: "#8A5A00" }}>Phiếu đã bị hoãn/từ chối: {d.ly_do_tu_choi}</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 13.5, color: T.ink, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Stethoscope size={15} color={T.sky} />
                        <b>{d.khoa ? d.khoa.ten_khoa : "—"}</b> <ArrowRight size={14} color={T.sub} /> <b>{d.bac_si ? d.bac_si.ho_ten : "—"}</b>
                      </div>
                      <label style={{ display: "block", maxWidth: 320, marginBottom: 12 }}>
                        <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, display: "block", marginBottom: 5 }}>Phòng khám đã đưa tới *</span>
                        <input value={phong} onChange={(e) => setPhong(e.target.value)} style={{ ...inp, background: "#fff" }} placeholder="VD: Phòng 204 - Tầng 2 Tòa A" />
                      </label>
                      <Btn kind="gold" size="sm" disabled={busy} onClick={chuyenPhong}><DoorOpen size={15} /> Xác nhận đã tới phòng</Btn>
                    </>
                  )}
                </Khoi>
              )}

              {daTiepNhan && (
                <Khoi tieuDe="Hoàn tất" nen={T.mintSoft}>
                  <div style={{ fontSize: 13.5, color: "#2F8F73", display: "flex", alignItems: "center", gap: 8 }}>
                    <Check size={16} /> Người bệnh đã tới <b>{d.phong}</b>
                    {d.bac_si ? <> · bác sĩ <b>{d.bac_si.ho_ten}</b></> : null}
                    {d.khoa ? <> · {d.khoa.ten_khoa}</> : null}
                  </div>
                </Khoi>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function Khoi({ tieuDe, children, nen, style }) {
  return (
    <div style={{ background: nen || T.bg, borderRadius: 13, padding: "14px 16px", ...style }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
        <CalendarClock size={14} color={T.sub} /> {tieuDe}
      </div>
      {children}
    </div>
  );
}

function Dong({ nhan, gt }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 13, padding: "3px 0" }}>
      <span style={{ color: T.sub, minWidth: 118 }}>{nhan}</span>
      <span style={{ color: T.ink, fontWeight: 600, flex: 1, wordBreak: "break-word" }}>{gt || "—"}</span>
    </div>
  );
}

function Moc({ xong, nhan, phu, cuoi }) {
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: xong ? T.mint : T.line, color: "#fff", display: "grid", placeItems: "center", marginTop: 2 }}>
          {xong ? <Check size={11} /> : null}
        </span>
        {!cuoi && <span style={{ width: 2, flex: 1, minHeight: 18, background: T.line }} />}
      </div>
      <div style={{ paddingBottom: cuoi ? 0 : 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: xong ? T.ink : T.sub }}>{nhan}</div>
        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>{phu}</div>
      </div>
    </div>
  );
}
