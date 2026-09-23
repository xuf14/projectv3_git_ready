import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Stethoscope, Calendar, Newspaper, Users, TrendingUp,
  CalendarCheck, UserCheck, Activity, User, Plus, Edit3, Trash2, FileText, X, Clock, Wallet,
} from "lucide-react";
import {
  T, store, api, useNav, Btn, Card, Pill, Avatar, Stars, SectionHead, StatCard,
  PageTitle, PortalShell, NEWS,
} from "./shared";
import AdminUsers from "./AdminUsers";
import AdminSlots from "./AdminSlots";
import { PaymentList } from "./Billing";
import { MediaAdmin } from "./truyenthong";

// ============================================================================
//  CỔNG QUẢN TRỊ VIÊN — tách riêng khỏi App.jsx.
//  Các trang nạp dữ liệu từ database qua API với quyền admin:
//  - Báo cáo:            GET /admin/reports      (admin)
//  - Tin tức & Nội dung: GET /news               (công khai, nguồn bảng tin_tuc)
//  - Khoa & Bác sĩ:      danh mục từ /departments, /doctors qua Nav context
// ============================================================================

function AdminPortal() {
  const [tab, setTab] = useState("dash");
  const items = [
    { id: "dash", label: "Tổng quan", icon: LayoutDashboard },
    { id: "depts", label: "Khoa & Bác sĩ", icon: Stethoscope },
    { id: "schedule", label: "Khung giờ", icon: Calendar },
    { id: "content", label: "Tin tức & Nội dung", icon: Newspaper },
    { id: "media", label: "Truyền thông", icon: Newspaper },
    { id: "users", label: "Người dùng", icon: Users },
    { id: "payments", label: "Thanh toán", icon: Wallet },
    { id: "activity", label: "Nhật ký hoạt động", icon: Clock },
    { id: "reports", label: "Báo cáo", icon: TrendingUp },
  ];
  const name = (store.user && store.user.ho_ten) || "Quản trị viên";
  return (
    <PortalShell role="admin" tone={T.lav} soft={T.lavSoft} name={name} sub="Admin" items={items} tab={tab} setTab={setTab}>
      {tab === "dash" && <AdminDash />}
      {tab === "depts" && <AdminDepts />}
      {tab === "reports" && <AdminReports />}
      {tab === "activity" && <AdminActivity />}
      {tab === "content" && <AdminContent />}
      {tab === "media" && <MediaAdmin />}
      {tab === "users" && <AdminUsers />}
      {tab === "payments" && <PaymentList mode="admin" />}
      {tab === "schedule" && <AdminSlots />}
    </PortalShell>
  );
}

function AdminDash() {
  const { departments, doctors } = useNav();
  return (
    <div>
      <PageTitle title="Bảng điều khiển" sub="Tổng quan hoạt động hệ thống · Tháng 6/2026" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 26 }} className="grid4">
        <StatCardTrend icon={CalendarCheck} tone={T.peach} soft={T.peachSoft} n="1.284" l="Lượt đặt lịch" up="+12%" />
        <StatCardTrend icon={UserCheck} tone={T.mint} soft={T.mintSoft} n="1.156" l="Đã đến khám" up="+8%" />
        <StatCardTrend icon={Users} tone={T.sky} soft={T.skySoft} n="3.420" l="Bệnh nhân" up="+5%" />
        <StatCardTrend icon={Activity} tone={T.lav} soft={T.lavSoft} n="90%" l="Tỷ lệ đến khám" up="+2%" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }} className="examGrid">
        <Card style={{ padding: 26 }}>
          <SectionHead title="Lượt đặt theo khoa" />
          {departments.map((d) => {
            const pct = [78, 55, 40, 62][departments.indexOf(d)] || 50;
            return (
              <div key={d.id} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 7 }}><span style={{ color: T.ink, fontWeight: 700 }}>{d.name}</span><span style={{ color: T.sub }}>{pct}%</span></div>
                <div style={{ height: 9, borderRadius: 99, background: d.soft }}><div style={{ width: pct + "%", height: "100%", borderRadius: 99, background: d.tone }} /></div>
              </div>
            );
          })}
        </Card>
        <Card style={{ padding: 26 }}>
          <SectionHead title="Bác sĩ nổi bật" />
          {doctors.slice(0, 4).map((doc, i) => (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 3 ? `1px solid ${T.line}55` : "none" }}>
              <span style={{ fontWeight: 800, color: T.lav, width: 22 }}>{i + 1}</span>
              <Avatar size={36} tone={T.lavSoft} color={T.lav} icon={User} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{doc.name}</div><div style={{ fontSize: 12.5, color: T.sub }}>{doc.reviews} lượt khám</div></div>
              <Stars r={doc.rating} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function StatCardTrend({ icon: Icon, tone, soft, n, l, up }) {
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: soft, color: tone, display: "grid", placeItems: "center" }}><Icon size={21} /></span>
        <Pill tone={T.mint} soft={T.mintSoft}><TrendingUp size={12} /> {up}</Pill>
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, color: T.ink, marginTop: 14 }}>{n}</div>
      <div style={{ color: T.sub, fontSize: 13.5, marginTop: 2 }}>{l}</div>
    </Card>
  );
}

function AdminDepts() {
  const { departments, doctors } = useNav();
  return (
    <div>
      <PageTitle title="Khoa phòng & Bác sĩ" sub="Quản lý danh mục khoa phòng và đội ngũ bác sĩ." action={<Btn kind="lav"><Plus size={16} /> Thêm khoa</Btn>} />
      <div style={{ display: "grid", gap: 14 }}>
        {departments.map((d) => {
          const Icon = d.icon;
          const docs = doctors.filter((x) => x.dept === d.id);
          return (
            <Card key={d.id} style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ width: 50, height: 50, borderRadius: 15, background: d.soft, color: d.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={24} /></span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{d.name}</div>
                <div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>{docs.length} bác sĩ · {d.services} dịch vụ</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={iconBtn}><Edit3 size={17} color={T.sub} /></button>
                <button style={iconBtn}><Trash2 size={17} color={T.peach} /></button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Tin tức: nạp từ bảng tin_tuc trong database (GET /news); offline dùng mock
function AdminContent() {
  const { online } = useNav();
  const tones = [T.peach, T.sky, T.mint, T.lav];
  const [list, setList] = useState(online ? null : NEWS);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!online) { setList(NEWS); return; }
    api.news()
      .then((r) => setList(Array.isArray(r) ? r.map((n, i) => ({
        id: n.id, title: n.tieu_de, tag: n.tag || "Tin tức",
        date: new Date(n.ngay_dang).toLocaleDateString("vi-VN"), tone: tones[i % tones.length],
      })) : []))
      .catch((e) => { setErr(e.message); setList([]); });
  }, [online]);

  const data = list || [];
  return (
    <div>
      <PageTitle title="Tin tức & Nội dung" sub={online ? "Bài viết đang lưu trong hệ thống (bảng tin_tuc)." : "Dữ liệu demo — bật backend để xem bài viết thật."} action={<Btn kind="lav"><Plus size={16} /> Viết bài mới</Btn>} />
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {!err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có bài viết nào trong hệ thống.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((n) => (
          <Card key={n.id} style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ width: 48, height: 48, borderRadius: 13, background: n.tone + "1A", color: n.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Newspaper size={22} /></span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 15 }}>{n.title}</div>
              <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>{n.tag} · {n.date}</div>
            </div>
            <Pill tone={T.mint} soft={T.mintSoft}>Đã đăng</Pill>
            <div style={{ display: "flex", gap: 8 }}><button style={iconBtn}><Edit3 size={16} color={T.sub} /></button><button style={iconBtn}><Trash2 size={16} color={T.peach} /></button></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdminReports() {
  const { online } = useNav();
  const months = [["T1", 60], ["T2", 72], ["T3", 68], ["T4", 85], ["T5", 78], ["T6", 92]];
  const [rep, setRep] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [expErr, setExpErr] = useState(null);
  useEffect(() => {
    if (online && store.token) api.reports().then(setRep).catch(() => setRep(null));
  }, [online]);

  // Tải báo cáo CSV (mở bằng Excel) tổng hợp từ dữ liệu thật trong database
  const xuatBaoCao = async () => {
    setExporting(true); setExpErr(null);
    try {
      const blob = await api.exportReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao-cao-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { setExpErr(e.message); }
    finally { setExporting(false); }
  };

  return (
    <div>
      <PageTitle title="Báo cáo & Thống kê" sub="Phân tích hoạt động khám chữa bệnh." action={<Btn kind="ghost" onClick={xuatBaoCao} disabled={exporting}><FileText size={15} /> {exporting ? "Đang xuất..." : "Xuất báo cáo"}</Btn>} />
      {expErr && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{expErr}</Card>}
      {rep && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }} className="grid4">
          <StatCard icon={CalendarCheck} tone={T.peach} soft={T.peachSoft} n={rep.tong_luot_dat} l="Tổng lượt đặt (thật)" />
          <StatCard icon={UserCheck} tone={T.mint} soft={T.mintSoft} n={rep.da_kham} l="Đã khám" />
          <StatCard icon={X} tone={"#C0392B"} soft={"#FDECEA"} n={rep.da_huy} l="Đã hủy" />
          <StatCard icon={Activity} tone={T.lav} soft={T.lavSoft} n={rep.ty_le_den_kham + "%"} l="Tỷ lệ đến khám" />
        </div>
      )}
      <Card style={{ padding: 28, marginBottom: 20 }}>
        <SectionHead title="Lượt đặt lịch theo tháng" sub="6 tháng đầu năm 2026 (dữ liệu minh họa)" />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 200, padding: "0 8px" }}>
          {months.map(([m, v]) => (
            <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ width: "100%", maxWidth: 56, height: v * 1.8, borderRadius: "12px 12px 6px 6px", background: `linear-gradient(180deg, ${T.lav}, ${T.peach})`, transition: "height .3s" }} />
              <span style={{ fontSize: 13, color: T.sub, fontWeight: 700 }}>{m}</span>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="grid3">
        <StatCard icon={CalendarCheck} tone={T.peach} soft={T.peachSoft} n="7.842" l="Tổng lượt đặt (6 tháng)" />
        <StatCard icon={Activity} tone={T.mint} soft={T.mintSoft} n="88%" l="Công suất bác sĩ TB" />
        <StatCard icon={TrendingUp} tone={T.lav} soft={T.lavSoft} n="2.1 tỷ" l="Doanh thu dịch vụ" />
      </div>
    </div>
  );
}

// Nhật ký hoạt động: timestamp từng thao tác tạo/sửa/xóa hồ sơ bệnh nhân
// do backend ghi lại (bảng nhat_ky_hoat_dong, GET /admin/activity)
function AdminActivity() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.activityLogs()
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  }, [online]);

  const ACT = {
    tao_ho_so: { l: "Tạo hồ sơ", tone: T.mint, soft: T.mintSoft },
    cap_nhat_ho_so: { l: "Cập nhật hồ sơ", tone: T.gold, soft: T.goldSoft },
    xoa_ho_so: { l: "Xóa hồ sơ", tone: "#C0392B", soft: "#FDECEA" },
  };
  const fmt = (t) => {
    const d = new Date(t);
    return isNaN(d) ? "" : d.toLocaleDateString("vi-VN") + " · " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const data = list || [];
  return (
    <div>
      <PageTitle title="Nhật ký hoạt động" sub={live ? "Thời điểm và nội dung từng thao tác trên hồ sơ bệnh nhân." : "Cần kết nối backend để xem nhật ký thật."} />
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải nhật ký...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {live && !loading && !err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có hoạt động nào được ghi lại.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((l) => {
          const a = ACT[l.hanh_dong] || { l: l.hanh_dong, tone: T.sub, soft: "#F0F0F2" };
          return (
            <Card key={l.id} style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: a.soft, color: a.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Clock size={20} /></span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill tone={a.tone} soft={a.soft}>{a.l}</Pill>
                  <span style={{ fontSize: 13, color: T.sub, fontWeight: 700 }}>{fmt(l.thoi_gian)}</span>
                </div>
                <div style={{ fontSize: 14.5, color: T.ink, fontWeight: 700, marginTop: 6 }}>{l.noi_dung}</div>
                {l.nguoi_dung && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}><User size={12} style={{ verticalAlign: -2 }} /> {l.nguoi_dung.ho_ten} ({l.nguoi_dung.email})</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const iconBtn = { background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 9, cursor: "pointer", display: "grid", placeItems: "center" };

export default AdminPortal;
