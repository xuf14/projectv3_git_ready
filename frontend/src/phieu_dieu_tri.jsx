import React, { useState, useEffect } from "react";
import { ArrowRightLeft, Ban, Check, ClipboardList, Clock, Plus, Stethoscope, User } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  PHIẾU THEO DÕI ĐIỀU TRỊ — bác sĩ ghi diễn biến bệnh theo thời gian và chỉ định.
//  Chọn phiếu khám bệnh của bệnh nhân (liên kết từ thongtinbenhnhan), rồi thêm các
//  mốc diễn biến. Lưu vào bảng dien_bien_dieu_tri qua:
//    POST /treatment/progress, GET /treatment/progress/:phieuKhamId
//
//  CHUYỂN KHOA ĐIỀU TRỊ — bác sĩ hoặc lễ tân đề nghị chuyển người bệnh sang khoa
//  khác; bác sĩ của khoa đến tiếp nhận hoặc từ chối. Máy chủ chốt toàn bộ điều
//  kiện (khoa đến phải khác khoa hiện tại, mỗi phiếu khám một đề nghị đang chờ,
//  chỉ khoa đến được tiếp nhận) — giao diện chỉ phản ánh lại.
//    POST /treatment/chuyen-khoa, GET /treatment/chuyen-khoa?phieu_kham_id=
//    POST /treatment/chuyen-khoa/:id/tiep-nhan, .../ket-thuc
// ============================================================================

const inp = { ...input, padding: "11px 13px", fontSize: 14, borderRadius: 11 };
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const TONE_CK = { cho_tiep_nhan: T.gold, da_tiep_nhan: T.mint, tu_choi: T.peach, da_huy: T.sub };

export default function PhieuDieuTri() {
  const { online } = useNav();
  const live = online && !!store.token;
  const vaiTro = (store.user && store.user.vai_tro) || "";
  const laBacSi = vaiTro === "bac_si" || vaiTro === "admin";
  const [sheets, setSheets] = useState([]);
  const [phieuKhamId, setPhieuKhamId] = useState("");
  const [progress, setProgress] = useState([]);
  const [thoiDiem, setThoiDiem] = useState("");
  const [dienBien, setDienBien] = useState("");
  const [chiDinh, setChiDinh] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (live) api.examSheets().then((r) => setSheets(Array.isArray(r) ? r : [])).catch(() => {}); }, [live]);

  const loadProgress = (id) => {
    if (!id) { setProgress([]); return; }
    api.progressList(id).then((r) => setProgress(Array.isArray(r) ? r : [])).catch(() => setProgress([]));
  };
  useEffect(() => loadProgress(phieuKhamId), [phieuKhamId]);

  const sheet = sheets.find((s) => String(s.id) === String(phieuKhamId));

  const them = async () => {
    setMsg(null);
    if (!phieuKhamId) { setMsg({ type: "err", text: "Chọn bệnh nhân (phiếu khám) trước." }); return; }
    if (!dienBien.trim()) { setMsg({ type: "err", text: "Nhập diễn biến bệnh." }); return; }
    setSaving(true);
    try {
      await api.addProgress({ phieu_kham_id: phieuKhamId, thoi_diem: thoiDiem || undefined, dien_bien: dienBien, chi_dinh: chiDinh || undefined });
      setThoiDiem(""); setDienBien(""); setChiDinh("");
      setMsg({ type: "ok", text: "Đã ghi diễn biến điều trị vào hệ thống." });
      loadProgress(phieuKhamId);
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setSaving(false); }
  };

  if (!live) {
    return (<div><PageTitle title="Phiếu theo dõi điều trị" sub="Ghi diễn biến bệnh của bệnh nhân." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản bác sĩ hoặc lễ tân.</Card></div>);
  }

  return (
    <div>
      <PageTitle title="Phiếu theo dõi điều trị" sub="Diễn biến bệnh theo thời gian, chỉ định và chuyển khoa điều trị — liên kết với phiếu khám của bệnh nhân." />

      {msg && <Card style={{ padding: 14, marginBottom: 16, border: "none", fontSize: 14,
        background: msg.type === "ok" ? T.mintSoft : "#FDECEA", color: msg.type === "ok" ? "#2F8F73" : "#C0392B" }}>{msg.text}</Card>}

      <Card style={{ padding: 20, marginBottom: 16 }}>
        <label style={{ display: "block", maxWidth: 520 }}>
          <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Bệnh nhân (phiếu khám)</span>
          <select style={inp} value={phieuKhamId} onChange={(e) => setPhieuKhamId(e.target.value)}>
            <option value="">— Chọn phiếu khám bệnh —</option>
            {sheets.map((s) => <option key={s.id} value={s.id}>{s.ten_bn}{s.ma_kcb ? ` · ${s.ma_kcb}` : ` · #${s.id}`}{s.ma_benh_nhan ? ` · ${s.ma_benh_nhan}` : ""}</option>)}
          </select>
        </label>
        {sheet && <div style={{ marginTop: 12, padding: "12px 14px", background: T.bg, borderRadius: 12, fontSize: 13.5, color: T.sub, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center" }}><User size={17} /></span>
          <span><b style={{ color: T.ink }}>{sheet.ten_bn}</b>{sheet.chuyen_khoa ? ` · ${sheet.chuyen_khoa}` : ""}{sheet.chan_doan_so_bo ? ` — CĐ: ${sheet.chan_doan_so_bo}` : ""}</span>
        </div>}
      </Card>

      {phieuKhamId && <ChuyenKhoa phieuKhamId={phieuKhamId} laBacSi={laBacSi} />}

      {phieuKhamId && laBacSi && (
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Plus size={17} color={T.sky} /> Thêm diễn biến</div>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "block", maxWidth: 280 }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Thời điểm (giờ/ngày lâm sàng)</span>
              <input style={inp} value={thoiDiem} onChange={(e) => setThoiDiem(e.target.value)} placeholder="VD: 30/06 13:30" />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Diễn biến bệnh *</span>
              <textarea style={{ ...inp, resize: "vertical" }} rows={3} value={dienBien} onChange={(e) => setDienBien(e.target.value)} placeholder="Toàn trạng, dấu hiệu sinh tồn, triệu chứng..." />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Chỉ định</span>
              <textarea style={{ ...inp, resize: "vertical" }} rows={2} value={chiDinh} onChange={(e) => setChiDinh(e.target.value)} placeholder="Thuốc, xét nghiệm, theo dõi..." />
            </label>
            <div><Btn kind="mint" disabled={saving} onClick={them}><Plus size={16} /> {saving ? "Đang lưu..." : "Ghi diễn biến"}</Btn></div>
          </div>
        </Card>
      )}

      {phieuKhamId && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><ClipboardList size={17} color={T.sky} /> Diễn biến điều trị ({progress.length})</div>
          {progress.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: T.sub }}>Chưa có diễn biến nào cho bệnh nhân này.</div>
          ) : progress.map((p, i) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "180px 1.4fr 1fr", gap: 16, padding: "16px 20px", borderBottom: i < progress.length - 1 ? `1px solid ${T.line}55` : "none" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: T.ink, fontSize: 13.5 }}><Clock size={14} color={T.sky} /> {p.thoi_diem || "—"}</div>
                <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>{fmtNgay(p.ngay_tao)}</div>
                {p.bac_si && <div style={{ fontSize: 12, color: T.sub, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><Stethoscope size={12} /> {p.bac_si.ho_ten}</div>}
              </div>
              <div style={{ fontSize: 13.5, color: T.ink, whiteSpace: "pre-wrap" }}>{p.dien_bien}</div>
              <div style={{ fontSize: 13.5, color: T.sub, whiteSpace: "pre-wrap" }}>{p.chi_dinh || "—"}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  CHUYỂN KHOA ĐIỀU TRỊ — bác sĩ điều trị hoặc lễ tân lập đề nghị chuyển người
//  bệnh sang khoa khác; bác sĩ CỦA KHOA ĐẾN tiếp nhận hoặc từ chối. Mọi điều kiện
//  do máy chủ chốt, nút bấm ở đây chỉ là phản ánh trạng thái.
// ---------------------------------------------------------------------------
function ChuyenKhoa({ phieuKhamId, laBacSi }) {
  const { departments } = useNav();
  const [list, setList] = useState([]);
  const [khoaDenId, setKhoaDenId] = useState("");
  const [lyDo, setLyDo] = useState("");
  const [tinhTrang, setTinhTrang] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dong, setDong] = useState(null);        // phiếu đang chờ nhập lý do từ chối/hủy
  const [lyDoDong, setLyDoDong] = useState("");

  const nap = () => api.chuyenKhoaList({ phieu_kham_id: phieuKhamId })
    .then((r) => setList(Array.isArray(r) ? r : [])).catch(() => setList([]));
  useEffect(() => { setMsg(null); setDong(null); setLyDoDong(""); nap(); }, [phieuKhamId]);

  // Danh mục khoa lấy từ backend mới có id thật (dbId); bỏ dữ liệu mock
  const khoa = departments.filter((k) => k.dbId);
  const dangCho = list.find((c) => c.trang_thai === "cho_tiep_nhan") || null;
  const daNhan = list.find((c) => c.trang_thai === "da_tiep_nhan") || null;
  const khoaHienTai = daNhan ? daNhan.khoa_den : (list.length ? list[0].khoa_di : null);

  const chay = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ type: "ok", text: okText }); await nap(); }
    catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setBusy(false); }
  };

  const deNghi = () => {
    if (!khoaDenId) { setMsg({ type: "err", text: "Chọn khoa tiếp nhận người bệnh." }); return; }
    if (!lyDo.trim()) { setMsg({ type: "err", text: "Nhập lý do chuyển khoa." }); return; }
    chay(async () => {
      await api.chuyenKhoaTao({
        phieu_kham_id: phieuKhamId, khoa_den_id: khoaDenId,
        ly_do: lyDo, tinh_trang_nb: tinhTrang || undefined,
      });
      setKhoaDenId(""); setLyDo(""); setTinhTrang("");
    }, "Đã gửi đề nghị chuyển khoa — chờ khoa đến tiếp nhận.");
  };

  const xacNhanDong = () => {
    if (!lyDoDong.trim()) { setMsg({ type: "err", text: "Phải ghi rõ lý do." }); return; }
    const { id, trang_thai } = dong;
    chay(async () => {
      await api.chuyenKhoaKetThuc(id, { trang_thai, ly_do_ket_thuc: lyDoDong });
      setDong(null); setLyDoDong("");
    }, trang_thai === "tu_choi" ? "Đã từ chối phiếu chuyển khoa." : "Đã hủy phiếu chuyển khoa.");
  };

  return (
    <Card style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <ArrowRightLeft size={17} color={T.lav} /> Chuyển khoa điều trị
      </div>
      <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }}>
        {khoaHienTai
          ? <>Khoa đang điều trị: <b style={{ color: T.ink }}>{khoaHienTai.ten_khoa}</b>. </>
          : <>Khoa đang điều trị do máy chủ xác định theo lần khám của phiếu này. </>}
        Việc chuyển chỉ có hiệu lực khi bác sĩ của khoa đến xác nhận tiếp nhận.
      </div>

      {msg && <div style={{ padding: "10px 13px", marginBottom: 14, borderRadius: 11, fontSize: 13.5,
        background: msg.type === "ok" ? T.mintSoft : "#FDECEA", color: msg.type === "ok" ? "#2F8F73" : "#C0392B" }}>{msg.text}</div>}

      {dangCho ? (
        <div style={{ padding: "12px 14px", background: T.goldSoft, borderRadius: 12, fontSize: 13.5, color: T.ink, marginBottom: 14 }}>
          Phiếu <b>{dangCho.ma_phieu}</b> đang chờ {dangCho.khoa_den ? dangCho.khoa_den.ten_khoa : "khoa đến"} tiếp nhận.
          Xử lý xong phiếu này mới lập được đề nghị mới.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
          <label style={{ display: "block", maxWidth: 380 }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Khoa tiếp nhận *</span>
            <select style={inp} value={khoaDenId} onChange={(e) => setKhoaDenId(e.target.value)}>
              <option value="">— Chọn khoa —</option>
              {khoa.map((k) => <option key={k.dbId} value={k.dbId}>{k.name}</option>)}
            </select>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Lý do chuyển khoa *</span>
            <textarea style={{ ...inp, resize: "vertical" }} rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)}
              placeholder="VD: Cần theo dõi chuyên sâu sản bệnh lý, vượt khả năng chuyên môn của khoa hiện tại..." />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Tình trạng người bệnh khi chuyển</span>
            <textarea style={{ ...inp, resize: "vertical" }} rows={2} value={tinhTrang} onChange={(e) => setTinhTrang(e.target.value)}
              placeholder="Toàn trạng, sinh hiệu, thuốc đang dùng, lưu ý khi bàn giao..." />
          </label>
          <div><Btn kind="lav" disabled={busy} onClick={deNghi}><ArrowRightLeft size={16} /> {busy ? "Đang gửi..." : "Đề nghị chuyển khoa"}</Btn></div>
        </div>
      )}

      {list.length > 0 && (
        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
          <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, marginBottom: 10 }}>Lịch sử chuyển khoa ({list.length})</div>
          {list.map((c) => (
            <div key={c.id} style={{ padding: "12px 14px", background: T.bg, borderRadius: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <Pill tone={TONE_CK[c.trang_thai] || T.sub}>{c.nhan_trang_thai}</Pill>
                <span style={{ fontSize: 13.5, color: T.ink, fontWeight: 700 }}>
                  {c.khoa_di ? c.khoa_di.ten_khoa : "Chưa xác định"} → {c.khoa_den ? c.khoa_den.ten_khoa : "—"}
                </span>
                <span style={{ fontSize: 12, color: T.sub }}>{c.ma_phieu} · {fmtNgay(c.thoi_gian_tao)}</span>
              </div>
              <div style={{ fontSize: 13.5, color: T.ink, whiteSpace: "pre-wrap" }}>Lý do: {c.ly_do}</div>
              {c.tinh_trang_nb && <div style={{ fontSize: 13, color: T.sub, whiteSpace: "pre-wrap", marginTop: 4 }}>Tình trạng: {c.tinh_trang_nb}</div>}
              {c.ly_do_ket_thuc && <div style={{ fontSize: 13, color: T.peach, whiteSpace: "pre-wrap", marginTop: 4 }}>Lý do đóng phiếu: {c.ly_do_ket_thuc}</div>}
              <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}>
                Người lập: {c.nguoi_tao ? c.nguoi_tao.ho_ten : "—"}
                {c.nguoi_xu_ly ? ` · Người xử lý: ${c.nguoi_xu_ly.ho_ten} (${fmtNgay(c.thoi_gian_xu_ly)})` : ""}
              </div>

              {c.trang_thai === "cho_tiep_nhan" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {laBacSi && <Btn kind="mint" size="sm" disabled={busy}
                    onClick={() => chay(() => api.chuyenKhoaTiepNhan(c.id), "Đã tiếp nhận người bệnh về khoa.")}><Check size={15} /> Tiếp nhận</Btn>}
                  {laBacSi && <Btn kind="ghost" size="sm" disabled={busy}
                    onClick={() => { setDong({ id: c.id, trang_thai: "tu_choi" }); setLyDoDong(""); setMsg(null); }}><Ban size={15} /> Từ chối</Btn>}
                  <Btn kind="ghost" size="sm" disabled={busy}
                    onClick={() => { setDong({ id: c.id, trang_thai: "da_huy" }); setLyDoDong(""); setMsg(null); }}>Hủy phiếu</Btn>
                </div>
              )}

              {dong && dong.id === c.id && (
                <div style={{ marginTop: 10, padding: 12, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 11 }}>
                  <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>
                    Lý do {dong.trang_thai === "tu_choi" ? "khoa đến từ chối" : "hủy phiếu"} *
                  </span>
                  <textarea style={{ ...inp, resize: "vertical" }} rows={2} value={lyDoDong} onChange={(e) => setLyDoDong(e.target.value)} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Btn kind="primary" size="sm" disabled={busy} onClick={xacNhanDong}>Xác nhận</Btn>
                    <Btn kind="ghost" size="sm" disabled={busy} onClick={() => { setDong(null); setLyDoDong(""); }}>Bỏ qua</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
