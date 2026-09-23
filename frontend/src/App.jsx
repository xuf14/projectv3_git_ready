import React, { useState, useMemo, useEffect } from "react";
import {
  Heart, Stethoscope, Calendar, Clock, CheckCircle2, ChevronRight, ChevronLeft, MapPin, Phone, User, Baby, Activity, Star, ArrowLeft, Menu, X, Home as HomeIcon, FileText, Users, LayoutDashboard, ClipboardList, Settings, Plus, Edit3, Trash2, UserCheck, Paperclip, Pill as PillIcon, CalendarCheck, CircleUser, Mail, Lock, Shield, Sparkles, ArrowUpRight, Newspaper, ChevronDown, BadgeCheck
} from "lucide-react";
import { T, store, api, Nav, useNav, Btn, Card, Pill, Avatar, Stars, SectionHead, StatCard, PageTitle, FormField, input, pickRow, PortalShell, NEWS } from "./shared";
import DoctorPortal from "./DoctorPortal";
import ReceptionPortal from "./ReceptionPortal";
import AdminPortal from "./AdminPortal";
import TruyenThongPage, { ArticleTab } from "./truyenthong";

// ============================================================================
//  FRONTEND — Website BV Phụ sản Hải Phòng
//  Phong cách: tươi sáng, thân thiện cho mẹ & bé
//  Render inline, nhiều màn hình, điều hướng bằng state.
//  Dữ liệu mẫu (mock) — backend sẽ làm sau.
// ============================================================================

// Icon + tông màu gán theo mã khoa (backend chỉ trả text, UI cần icon/màu)
const DEPT_STYLE = {
  san: { icon: Baby, tone: "#F08A7C", soft: "#FDEDE9" },
  phu: { icon: Heart, tone: "#9B7EDE", soft: "#EFE9FB" },
  ivf: { icon: Activity, tone: "#4FB89A", soft: "#E2F4EF" },
  sosinh: { icon: Stethoscope, tone: "#5BA8D0", soft: "#E4F1F8" },
};
const DEFAULT_STYLE = { icon: Stethoscope, tone: "#5BA8D0", soft: "#E4F1F8" };

// Chuẩn hóa dữ liệu API → cấu trúc mà UI đang dùng (name, desc, tone, icon...)
function mapDept(d) {
  const s = DEPT_STYLE[d.ma] || DEFAULT_STYLE;
  return { id: d.ma || d.id, dbId: d.id, name: d.ten_khoa, desc: d.mo_ta, viTri: d.vi_tri,
    icon: s.icon, tone: s.tone, soft: s.soft, services: (d.dich_vu && d.dich_vu.length) || 0,
    docCount: (d.bac_si && d.bac_si.length) || 0 };
}
function mapDoctor(b) {
  const maKhoa = b.khoa && b.khoa.ma;
  return { id: b.id, dept: maKhoa, name: b.ho_ten, title: b.chuyen_mon || b.hoc_ham,
    exp: b.so_nam_kn, rating: b.danh_gia, reviews: 0 };
}
function mapAppt(a) {
  const st = { cho_xac_nhan: "pending", da_xac_nhan: "confirmed", da_checkin: "confirmed", da_kham: "done", da_huy: "cancelled" };
  const ngay = a.khung_gio && a.khung_gio.ngay ? new Date(a.khung_gio.ngay) : null;
  return { id: a.ma_lich_hen, dbId: a.id, dept: a.khoa && a.khoa.ten_khoa,
    doctor: a.khung_gio && a.khung_gio.bac_si ? a.khung_gio.bac_si.ho_ten : "—",
    date: ngay && !isNaN(ngay) ? ngay.toLocaleDateString("vi-VN") : "",
    time: a.khung_gio && a.khung_gio.gio_bat_dau,
    status: st[a.trang_thai] || "pending", queue: a.so_thu_tu };
}
// ---------- MOCK DATA (dùng làm dữ liệu dự phòng khi chưa bật backend) ----------
const DEPARTMENTS = [
  { id: "san", name: "Khoa Sản", icon: Baby, tone: T.peach, soft: T.peachSoft, desc: "Theo dõi thai kỳ, sinh thường & sinh mổ, chăm sóc sau sinh.", services: 12 },
  { id: "phu", name: "Khoa Phụ", icon: Heart, tone: T.lav, soft: T.lavSoft, desc: "Khám và điều trị bệnh lý phụ khoa, tầm soát ung thư cổ tử cung.", services: 9 },
  { id: "ivf", name: "Hỗ trợ sinh sản (IVF)", icon: Activity, tone: T.mint, soft: T.mintSoft, desc: "Tư vấn hiếm muộn, thụ tinh ống nghiệm, bơm tinh trùng (IUI).", services: 7 },
  { id: "sosinh", name: "Sơ sinh", icon: Stethoscope, tone: T.sky, soft: T.skySoft, desc: "Chăm sóc & hồi sức sơ sinh, sàng lọc sau sinh, tiêm chủng.", services: 8 },
];

const DOCTORS = [
  { id: 1, dept: "san", name: "BS.CKII Nguyễn Thị Lan", title: "Trưởng khoa Sản", exp: 22, rating: 4.9, reviews: 312 },
  { id: 2, dept: "san", name: "BS.CKI Trần Văn Minh", title: "Bác sĩ Sản khoa", exp: 12, rating: 4.7, reviews: 145 },
  { id: 3, dept: "phu", name: "TS.BS Phạm Thu Hà", title: "Phụ khoa", exp: 18, rating: 4.8, reviews: 208 },
  { id: 4, dept: "ivf", name: "BS.CKII Lê Hữu Phúc", title: "Trung tâm IVF", exp: 15, rating: 4.9, reviews: 176 },
  { id: 5, dept: "sosinh", name: "BS.CKI Vũ Mai Anh", title: "Sơ sinh", exp: 10, rating: 4.6, reviews: 98 },
  { id: 6, dept: "phu", name: "BS.CKI Đỗ Khánh Linh", title: "Phụ khoa", exp: 9, rating: 4.7, reviews: 84 },
];

const SLOTS = ["07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "13:30", "14:00", "14:30", "15:00", "15:30"];

const MY_APPTS = [
  { id: "BV3K9XA", dept: "Khoa Sản", doctor: "BS.CKII Nguyễn Thị Lan", date: "02/07/2026", time: "08:30", status: "confirmed", queue: 7 },
  { id: "BV7M2QP", dept: "Khoa Phụ", doctor: "TS.BS Phạm Thu Hà", date: "10/07/2026", time: "14:00", status: "pending", queue: null },
  { id: "BV1F8LD", dept: "Hỗ trợ sinh sản (IVF)", doctor: "BS.CKII Lê Hữu Phúc", date: "12/06/2026", time: "09:00", status: "done", queue: 3 },
];

const fmtDate = (d) => d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
// ============================================================================
//  PHẦN 2 — CỔNG THÔNG TIN (PUBLIC SITE)
// ============================================================================

const PUBLIC_TABS = [
  { id: "home", label: "Trang chủ" },
  { id: "departments", label: "Khoa phòng" },
  { id: "doctors", label: "Bác sĩ" },
  { id: "news", label: "Tin tức" },
  { id: "media", label: "Truyền thông" },
];

function PublicHeader() {
  const { go, page, portal } = useNav();
  const [open, setOpen] = useState(false);
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,247,244,.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => go("home")} style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: "none", cursor: "pointer" }}>
          <span style={{ width: 40, height: 40, borderRadius: 14, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "grid", placeItems: "center", boxShadow: "0 6px 16px rgba(240,138,124,.3)" }}>
            <Heart size={20} fill="#fff" color="#fff" />
          </span>
          <span style={{ textAlign: "left", lineHeight: 1.15 }}>
            <b style={{ color: T.ink, fontSize: 15.5 }}>Phụ sản Hải Phòng</b><br />
            <small style={{ color: T.peach, fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>CHĂM SÓC MẸ & BÉ</small>
          </span>
        </button>

        <nav style={{ display: "flex", alignItems: "center", gap: 4 }} className="desktopNav">
          {PUBLIC_TABS.map((t) => (
            <button key={t.id} onClick={() => go(t.id)}
              style={{ background: page === t.id ? T.surface : "none", color: page === t.id ? T.peach : T.sub, border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: page === t.id ? "0 4px 12px rgba(0,0,0,.05)" : "none" }}>
              {t.label}
            </button>
          ))}
          <div style={{ width: 1, height: 22, background: T.line, margin: "0 8px" }} />
          <Btn kind="ghost" size="sm" onClick={() => portal("patient")}><CircleUser size={16} /> Đăng nhập</Btn>
          <Btn size="sm" onClick={() => go("booking")}><Calendar size={16} /> Đặt lịch</Btn>
        </nav>

        <button className="mobileBtn" onClick={() => setOpen(!open)} style={{ display: "none", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 9, cursor: "pointer" }}>
          {open ? <X size={20} color={T.ink} /> : <Menu size={20} color={T.ink} />}
        </button>
      </div>
      {open && (
        <div className="mobileMenu" style={{ padding: "8px 22px 18px", display: "none", flexDirection: "column", gap: 6 }}>
          {PUBLIC_TABS.map((t) => <button key={t.id} onClick={() => { go(t.id); setOpen(false); }} style={{ textAlign: "left", background: "none", border: "none", padding: "11px 12px", fontSize: 15, fontWeight: 700, color: page === t.id ? T.peach : T.ink, borderRadius: 12 }}>{t.label}</button>)}
          <Btn full onClick={() => { go("booking"); setOpen(false); }}><Calendar size={16} /> Đặt lịch khám</Btn>
          <Btn kind="ghost" full onClick={() => { portal("patient"); setOpen(false); }}><CircleUser size={16} /> Đăng nhập</Btn>
        </div>
      )}
    </header>
  );
}

function Home() {
  const { go, departments, doctors } = useNav();
  return (
    <div>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -100, right: -60, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${T.peach}26, transparent 70%)` }} />
        <div style={{ position: "absolute", bottom: -120, left: -80, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${T.lav}22, transparent 70%)` }} />
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "64px 22px 56px", position: "relative", display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 40, alignItems: "center" }} className="heroGrid">
          <div>
            <Pill tone={T.lav} soft={T.lavSoft}><Sparkles size={13} /> Hơn 40 năm đồng hành cùng các mẹ</Pill>
            <h1 style={{ fontSize: 46, lineHeight: 1.1, margin: "20px 0 16px", color: T.ink, fontWeight: 800, letterSpacing: -1 }}>
              Hành trình làm mẹ,<br /><span style={{ background: `linear-gradient(120deg, ${T.peach}, ${T.lav})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>bắt đầu từ sự an tâm</span>
            </h1>
            <p style={{ fontSize: 17, color: T.sub, lineHeight: 1.65, margin: "0 0 28px", maxWidth: 480 }}>
              Đặt lịch khám trực tuyến với bác sĩ chuyên khoa chỉ trong vài bước. Không xếp hàng, không chờ đợi — dành trọn thời gian cho mẹ và bé yêu.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Btn size="lg" onClick={() => go("booking")}><Calendar size={18} /> Đặt lịch ngay</Btn>
              <Btn kind="ghost" size="lg" onClick={() => go("departments")}>Khám phá khoa phòng <ChevronRight size={18} /></Btn>
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 36 }}>
              {[["40+", "Năm kinh nghiệm"], ["120+", "Bác sĩ chuyên khoa"], ["15K+", "Ca sinh mỗi năm"]].map(([n, l]) => (
                <div key={l}><div style={{ fontSize: 26, fontWeight: 800, color: T.peach }}>{n}</div><div style={{ fontSize: 13, color: T.sub }}>{l}</div></div>
              ))}
            </div>
          </div>
          {/* Hero card collage */}
          <div style={{ position: "relative", height: 380 }} className="heroArt">
            <Card style={{ position: "absolute", top: 0, right: 10, width: 230, padding: 20, boxShadow: "0 24px 60px rgba(45,58,78,.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar tone={T.peachSoft} color={T.peach} icon={Baby} />
                <div><div style={{ fontWeight: 800, color: T.ink }}>Khám thai định kỳ</div><div style={{ fontSize: 12.5, color: T.sub }}>Theo dõi từng tuần thai</div></div>
              </div>
              <div style={{ marginTop: 14, height: 8, borderRadius: 99, background: T.peachSoft, overflow: "hidden" }}><div style={{ width: "72%", height: "100%", background: T.peach }} /></div>
              <div style={{ fontSize: 12, color: T.sub, marginTop: 7 }}>Tuần 28 / 40 · Bé phát triển tốt</div>
            </Card>
            <Card style={{ position: "absolute", top: 130, left: 0, width: 210, padding: 18, boxShadow: "0 24px 60px rgba(45,58,78,.12)" }}>
              <Pill tone={T.mint} soft={T.mintSoft}><CheckCircle2 size={13} /> Đã xác nhận</Pill>
              <div style={{ fontWeight: 800, color: T.ink, marginTop: 12, fontSize: 15 }}>Lịch hẹn của bạn</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: T.sub, fontSize: 13 }}><Clock size={14} /> 08:30 · Thứ 4, 02/07</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, color: T.sub, fontSize: 13 }}><User size={14} /> BS. Nguyễn Thị Lan</div>
            </Card>
            <Card style={{ position: "absolute", bottom: 0, right: 30, width: 180, padding: 16, boxShadow: "0 24px 60px rgba(45,58,78,.12)", display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: T.goldSoft, display: "grid", placeItems: "center" }}><Star size={20} fill={T.gold} color={T.gold} /></span>
              <div><div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>4.9/5</div><div style={{ fontSize: 11.5, color: T.sub }}>10.000+ đánh giá</div></div>
            </Card>
          </div>
        </div>
      </section>

      {/* QUICK SERVICES */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 22px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="grid4">
          {[
            { icon: Calendar, t: "Đặt lịch online", d: "Chọn giờ phù hợp", tone: T.peach, soft: T.peachSoft, go: "booking" },
            { icon: Stethoscope, t: "Khoa phòng", d: "4 chuyên khoa chính", tone: T.lav, soft: T.lavSoft, go: "departments" },
            { icon: Users, t: "Đội ngũ bác sĩ", d: "120+ chuyên gia", tone: T.mint, soft: T.mintSoft, go: "doctors" },
            { icon: Newspaper, t: "Cẩm nang mẹ bầu", d: "Kiến thức hữu ích", tone: T.sky, soft: T.skySoft, go: "news" },
          ].map((s) => (
            <Card key={s.t} hover onClick={() => go(s.go)} style={{ padding: 22, cursor: "pointer" }}>
              <span style={{ width: 50, height: 50, borderRadius: 15, background: s.soft, color: s.tone, display: "grid", placeItems: "center" }}><s.icon size={24} /></span>
              <div style={{ fontWeight: 800, color: T.ink, marginTop: 14, fontSize: 16 }}>{s.t}</div>
              <div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>{s.d}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* DEPARTMENTS PREVIEW */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "44px 22px" }}>
        <SectionHead kicker="Khoa phòng" title="Chọn nơi bạn cần khám" sub="Mỗi khoa phòng được dẫn dắt bởi đội ngũ bác sĩ giàu kinh nghiệm."
          action={<Btn kind="ghost" size="sm" onClick={() => go("departments")}>Xem tất cả <ArrowUpRight size={15} /></Btn>} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="grid4">
          {departments.map((d) => <DeptCard key={d.id} d={d} onClick={() => go("booking", { dept: d.id })} />)}
        </div>
      </section>

      {/* DOCTORS PREVIEW */}
      <section style={{ background: T.surface, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "52px 22px" }}>
          <SectionHead kicker="Đội ngũ" title="Bác sĩ tiêu biểu"
            action={<Btn kind="ghost" size="sm" onClick={() => go("doctors")}>Xem tất cả <ArrowUpRight size={15} /></Btn>} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="grid4">
            {doctors.slice(0, 4).map((doc) => <DoctorCard key={doc.id} doc={doc} onBook={() => go("booking", { dept: doc.dept, doctor: doc })} />)}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "56px 22px" }}>
        <SectionHead kicker="Quy trình" title="Đặt lịch chỉ trong 4 bước" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="grid4">
          {[
            { i: "01", t: "Chọn khoa", d: "Chọn chuyên khoa cần khám", tone: T.peach, soft: T.peachSoft },
            { i: "02", t: "Chọn bác sĩ", d: "Xem hồ sơ & chọn bác sĩ", tone: T.lav, soft: T.lavSoft },
            { i: "03", t: "Chọn giờ", d: "Chọn ngày & khung giờ trống", tone: T.mint, soft: T.mintSoft },
            { i: "04", t: "Xác nhận", d: "Nhận mã & số thứ tự", tone: T.sky, soft: T.skySoft },
          ].map((p) => (
            <Card key={p.i} style={{ padding: 24 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: p.tone, background: p.soft, borderRadius: 12, padding: "6px 12px" }}>{p.i}</span>
              <div style={{ fontWeight: 800, color: T.ink, marginTop: 16, fontSize: 17 }}>{p.t}</div>
              <div style={{ color: T.sub, fontSize: 14, marginTop: 5 }}>{p.d}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1140, margin: "0 auto 56px", padding: "0 22px" }}>
        <div style={{ borderRadius: 30, padding: "48px 44px", background: `linear-gradient(120deg, ${T.peach}, ${T.lav})`, position: "relative", overflow: "hidden", textAlign: "center" }}>
          <div style={{ position: "absolute", top: -40, right: -20, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.12)" }} />
          <h2 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: "0 0 12px", position: "relative" }}>Sẵn sàng cho buổi khám đầu tiên?</h2>
          <p style={{ color: "rgba(255,255,255,.9)", fontSize: 16.5, margin: "0 0 26px", position: "relative" }}>Đặt lịch ngay hôm nay và để chúng tôi chăm sóc bạn.</p>
          <Btn kind="dark" size="lg" onClick={() => go("booking")} style={{ background: "#fff", color: T.peach }}><Calendar size={18} /> Đặt lịch khám miễn phí</Btn>
        </div>
      </section>
    </div>
  );
}

function DeptCard({ d, onClick }) {
  const Icon = d.icon;
  return (
    <Card hover onClick={onClick} style={{ padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ width: 54, height: 54, borderRadius: 16, background: d.soft, color: d.tone, display: "grid", placeItems: "center" }}><Icon size={26} /></span>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 17, marginTop: 4 }}>{d.name}</div>
      <p style={{ color: T.sub, fontSize: 14, lineHeight: 1.55, margin: 0, flex: 1 }}>{d.desc}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 12.5, color: T.sub }}>{d.services} dịch vụ</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: d.tone, display: "flex", alignItems: "center", gap: 3 }}>Đặt lịch <ChevronRight size={15} /></span>
      </div>
    </Card>
  );
}

function DoctorCard({ doc, onBook }) {
  const { departments } = useNav();
  const dept = departments.find((x) => x.id === doc.dept) || departments[0] || { tone: T.peach, soft: T.peachSoft };
  return (
    <Card style={{ padding: 22, textAlign: "center" }}>
      <div style={{ position: "relative", width: 76, height: 76, margin: "0 auto 14px" }}>
        <Avatar size={76} tone={dept.soft} color={dept.tone} icon={User} />
        <span style={{ position: "absolute", bottom: 0, right: 0, background: T.mint, borderRadius: "50%", padding: 4, border: "3px solid #fff" }}><BadgeCheck size={13} color="#fff" /></span>
      </div>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{doc.name}</div>
      <div style={{ color: dept.tone, fontSize: 13, fontWeight: 700, marginTop: 3 }}>{doc.title}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", margin: "10px 0 14px", fontSize: 13, color: T.sub }}>
        <Stars r={doc.rating} /><span>· {doc.exp} năm KN</span>
      </div>
      <Btn kind="soft" size="sm" full onClick={onBook}>Đặt lịch khám</Btn>
    </Card>
  );
}

function DepartmentsPage() {
  const { go, departments, doctors } = useNav();
  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "44px 22px 64px" }}>
      <Pill tone={T.lav} soft={T.lavSoft}>Khoa phòng</Pill>
      <h1 style={{ fontSize: 38, fontWeight: 800, color: T.ink, margin: "16px 0 8px", letterSpacing: -0.8 }}>Các chuyên khoa của chúng tôi</h1>
      <p style={{ color: T.sub, fontSize: 16, maxWidth: 560, margin: "0 0 36px" }}>Bệnh viện Phụ sản Hải Phòng cung cấp dịch vụ chăm sóc toàn diện cho mẹ và bé qua các chuyên khoa sau.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }} className="grid2">
        {departments.map((d) => {
          const Icon = d.icon;
          const docs = doctors.filter((x) => x.dept === d.id);
          return (
            <Card key={d.id} style={{ padding: 28, display: "flex", gap: 20 }}>
              <span style={{ width: 64, height: 64, borderRadius: 18, background: d.soft, color: d.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={30} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 19 }}>{d.name}</div>
                <p style={{ color: T.sub, fontSize: 14.5, lineHeight: 1.6, margin: "8px 0 14px" }}>{d.desc}</p>
                <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 13, color: T.sub }}>
                  <span><b style={{ color: T.ink }}>{d.services}</b> dịch vụ</span>
                  <span><b style={{ color: T.ink }}>{docs.length}</b> bác sĩ</span>
                </div>
                <Btn size="sm" onClick={() => go("booking", { dept: d.id })}>Đặt lịch khoa này <ChevronRight size={15} /></Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DoctorsPage() {
  const { go, departments, doctors } = useNav();
  const [filter, setFilter] = useState("all");
  const list = useMemo(() => filter === "all" ? doctors : doctors.filter((d) => d.dept === filter), [filter, doctors]);
  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "44px 22px 64px" }}>
      <Pill tone={T.mint} soft={T.mintSoft}>Đội ngũ</Pill>
      <h1 style={{ fontSize: 38, fontWeight: 800, color: T.ink, margin: "16px 0 8px", letterSpacing: -0.8 }}>Bác sĩ chuyên khoa</h1>
      <p style={{ color: T.sub, fontSize: 16, maxWidth: 560, margin: "0 0 28px" }}>Đội ngũ bác sĩ tận tâm, giàu kinh nghiệm luôn sẵn sàng đồng hành cùng bạn.</p>
      <div style={{ display: "flex", gap: 9, marginBottom: 28, flexWrap: "wrap" }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Tất cả</FilterChip>
        {departments.map((d) => <FilterChip key={d.id} active={filter === d.id} tone={d.tone} onClick={() => setFilter(d.id)}>{d.name}</FilterChip>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="grid3">
        {list.map((doc) => <DoctorCard key={doc.id} doc={doc} onBook={() => go("booking", { dept: doc.dept, doctor: doc })} />)}
      </div>
    </div>
  );
}

function FilterChip({ children, active, tone = T.peach, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "9px 18px", borderRadius: 999, border: `1.5px solid ${active ? tone : T.line}`, background: active ? tone : T.surface, color: active ? "#fff" : T.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{children}</button>
  );
}

function NewsPage() {
  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "44px 22px 64px" }}>
      <Pill tone={T.sky} soft={T.skySoft}>Cẩm nang</Pill>
      <h1 style={{ fontSize: 38, fontWeight: 800, color: T.ink, margin: "16px 0 8px", letterSpacing: -0.8 }}>Tin tức & kiến thức mẹ bầu</h1>
      <p style={{ color: T.sub, fontSize: 16, maxWidth: 560, margin: "0 0 36px" }}>Cập nhật thông tin từ bệnh viện và những kiến thức hữu ích cho hành trình làm mẹ.</p>
      {/* Featured */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 28, display: "grid", gridTemplateColumns: "1.1fr 1fr" }} className="featGrid">
        <div style={{ background: `linear-gradient(135deg, ${T.peachSoft}, ${T.lavSoft})`, minHeight: 240, display: "grid", placeItems: "center" }}>
          <Baby size={80} color={T.peach} strokeWidth={1.3} />
        </div>
        <div style={{ padding: 32, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Pill tone={T.peach} soft={T.peachSoft}>Nổi bật</Pill>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "14px 0 10px", lineHeight: 1.25 }}>10 dấu hiệu chuyển dạ mẹ bầu cần biết</h2>
          <p style={{ color: T.sub, fontSize: 15, lineHeight: 1.6, margin: "0 0 18px" }}>Nhận biết sớm các dấu hiệu chuyển dạ giúp mẹ chuẩn bị tâm lý và đến viện kịp thời, đảm bảo an toàn cho cả mẹ và bé.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: T.sub }}><span>24/06/2026</span><span>· 5 phút đọc</span></div>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="grid3">
        {NEWS.map((n) => (
          <Card key={n.id} hover style={{ overflow: "hidden", cursor: "pointer" }}>
            <div style={{ height: 130, background: n.tone + "1A", display: "grid", placeItems: "center" }}><Newspaper size={40} color={n.tone} strokeWidth={1.4} /></div>
            <div style={{ padding: 20 }}>
              <Pill tone={n.tone} soft={n.tone + "1A"}>{n.tag}</Pill>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, margin: "12px 0 10px", lineHeight: 1.35 }}>{n.title}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12.5, color: T.sub }}><span>{n.date}</span><span>· {n.read} phút đọc</span></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PublicFooter() {
  const { go } = useNav();
  return (
    <footer style={{ background: T.ink, marginTop: 40 }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "48px 22px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 32 }} className="footGrid">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <span style={{ width: 38, height: 38, borderRadius: 13, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "grid", placeItems: "center" }}><Heart size={18} fill="#fff" color="#fff" /></span>
              <b style={{ color: "#fff", fontSize: 16 }}>Phụ sản Hải Phòng</b>
            </div>
            <p style={{ color: "#9AA7BC", fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 280 }}>Đồng hành cùng các mẹ trên hành trình mang thai và làm mẹ trọn vẹn.</p>
          </div>
          {[
            ["Khám phá", [["Trang chủ", "home"], ["Khoa phòng", "departments"], ["Bác sĩ", "doctors"], ["Tin tức", "news"]]],
            ["Dịch vụ", [["Đặt lịch khám", "booking"], ["Khám thai", "booking"], ["Hỗ trợ IVF", "booking"], ["Sơ sinh", "booking"]]],
          ].map(([h, items]) => (
            <div key={h}>
              <div style={{ color: "#fff", fontWeight: 700, marginBottom: 14, fontSize: 15 }}>{h}</div>
              {items.map(([l, p]) => <button key={l} onClick={() => go(p)} style={{ display: "block", background: "none", border: "none", color: "#9AA7BC", fontSize: 14, padding: "6px 0", cursor: "pointer", textAlign: "left" }}>{l}</button>)}
            </div>
          ))}
          <div>
            <div style={{ color: "#fff", fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Liên hệ</div>
            <div style={{ color: "#9AA7BC", fontSize: 14, display: "grid", gap: 10 }}>
              <span style={{ display: "flex", gap: 8 }}><MapPin size={16} /> 19 Trần Quang Khải, Hải Phòng</span>
              <span style={{ display: "flex", gap: 8 }}><Phone size={16} /> 0225 xxx xxx</span>
              <span style={{ display: "flex", gap: 8 }}><Mail size={16} /> lienhe@phusanhp.vn</span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #3A4658", marginTop: 32, paddingTop: 20, textAlign: "center", color: "#6B7689", fontSize: 12.5 }}>© 2026 Bệnh viện Phụ sản Hải Phòng · Prototype phục vụ đồ án tốt nghiệp</div>
      </div>
    </footer>
  );
}
// ============================================================================
//  PHẦN 3 — ĐẶT LỊCH + KHU VỰC BỆNH NHÂN
// ============================================================================

function BookingFlow() {
  const { go, params, departments, doctors, online } = useNav();
  const [step, setStep] = useState(params.dept ? (params.doctor ? 3 : 2) : 1);
  const [sel, setSel] = useState({ dept: params.dept || null, doctor: params.doctor || null, date: null, slot: null });
  const [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState(null);
  const [queue, setQueue] = useState(null);
  const [demo, setDemo] = useState(false); // true = lịch demo, chưa lưu vào hệ thống
  const [err, setErr] = useState(null);

  const dept = departments.find((d) => d.id === sel.dept);
  const docs = useMemo(() => doctors.filter((d) => !sel.dept || d.dept === sel.dept), [sel.dept, doctors]);

  // Khi backend online: mọi lịch hẹn phải được lưu thật vào database (bắt buộc đăng nhập).
  // Chế độ demo chỉ tồn tại khi backend chưa chạy.
  const doConfirm = async (info) => {
    setErr(null);
    if (online) {
      if (!store.token) { setErr("Bạn cần đăng nhập để đặt lịch. Lịch hẹn chỉ được lưu khi có tài khoản."); return; }
      if (!(sel.slot && sel.slot.id)) { setErr("Khung giờ không hợp lệ. Vui lòng quay lại chọn lại thời gian."); return; }
      try {
        const r = await api.createAppt({
          khung_gio_id: sel.slot.id, ho_ten: info.name, sdt: info.phone, so_bhyt: info.bhyt,
        });
        setCode(r.ma_lich_hen); setQueue(r.so_thu_tu); setDemo(false); setConfirmed(true);
      } catch (e) { setErr(e.message); }
      return;
    }
    // Backend chưa chạy → demo, có nhãn cảnh báo rõ ràng
    setCode("BV" + Math.random().toString(36).slice(2, 7).toUpperCase());
    setQueue(Math.floor(Math.random() * 25) + 1);
    setDemo(true);
    setConfirmed(true);
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 22px 64px" }}>
      <button onClick={() => go("home")} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}><ArrowLeft size={15} /> Về trang chủ</button>
      <Card style={{ padding: "30px 32px" }}>
        <BookingSteps step={confirmed ? 5 : step} />
        {step === 1 && <PickDept onPick={(id) => { setSel({ ...sel, dept: id, doctor: null }); setStep(2); }} />}
        {step === 2 && <PickDoctor dept={dept} docs={docs} onBack={() => setStep(1)} onPick={(doc) => { setSel({ ...sel, doctor: doc }); setStep(3); }} />}
        {step === 3 && <PickTime doctor={sel.doctor} online={online} onBack={() => setStep(2)} onPick={(date, slot) => { setSel({ ...sel, date, slot }); setStep(4); }} />}
        {step === 4 && !confirmed && <Confirm sel={sel} dept={dept} err={err} onBack={() => setStep(3)} onConfirm={doConfirm} />}
        {confirmed && <BookingSuccess sel={sel} dept={dept} code={code} queue={queue} demo={demo} onDone={() => go("home")} />}
      </Card>
    </div>
  );
}

function BookingSteps({ step }) {
  const labels = ["Khoa", "Bác sĩ", "Thời gian", "Xác nhận"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
      {labels.map((l, i) => {
        const n = i + 1, done = n < step, cur = n === step;
        return (
          <React.Fragment key={l}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800, background: done ? T.mint : cur ? T.peach : T.line, color: done || cur ? "#fff" : T.sub }}>
                {done ? <CheckCircle2 size={16} /> : n}
              </span>
              <span style={{ fontSize: 13.5, color: cur ? T.ink : T.sub, fontWeight: cur ? 800 : 600 }} className="stepLabel">{l}</span>
            </div>
            {i < labels.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 10px", background: done ? T.mint : T.line }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const BackLink = ({ onBack }) => <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}><ArrowLeft size={15} /> Quay lại</button>;

function PickDept({ onPick }) {
  const { departments } = useNav();
  return (
    <div>
      <h3 style={{ fontSize: 21, color: T.ink, margin: "0 0 18px", fontWeight: 800 }}>Bạn muốn khám khoa nào?</h3>
      <div style={{ display: "grid", gap: 12 }}>
        {departments.map((d) => {
          const Icon = d.icon;
          return (
            <button key={d.id} onClick={() => onPick(d.id)} className="pickRow" style={pickRow}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: d.soft, color: d.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={23} /></span>
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{d.name}</div>
                <div style={{ fontSize: 13.5, color: T.sub, marginTop: 2 }}>{d.desc}</div>
              </div>
              <ChevronRight size={20} color={T.sub} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PickDoctor({ dept, docs, onBack, onPick }) {
  const { departments, online } = useNav();
  return (
    <div>
      <BackLink onBack={onBack} />
      <h3 style={{ fontSize: 21, color: T.ink, margin: "0 0 18px", fontWeight: 800 }}>Chọn bác sĩ {dept ? `· ${dept.name}` : ""}</h3>
      <div style={{ display: "grid", gap: 12 }}>
        {/* "Bác sĩ bất kỳ" chỉ có ở chế độ demo — dữ liệu thật cần chọn bác sĩ cụ thể để lấy khung giờ */}
        {!online && <button onClick={() => onPick({ id: 0, name: "Bác sĩ bất kỳ", title: dept?.name })} className="pickRow" style={pickRow}>
          <span style={{ width: 48, height: 48, borderRadius: 14, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center" }}><Sparkles size={22} /></span>
          <div style={{ textAlign: "left", flex: 1 }}><div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>Bác sĩ bất kỳ</div><div style={{ fontSize: 13.5, color: T.sub }}>Hệ thống tự sắp xếp bác sĩ phù hợp & sớm nhất</div></div>
          <ChevronRight size={20} color={T.sub} />
        </button>}
        {docs.map((doc) => {
          const dd = departments.find((x) => x.id === doc.dept) || { soft: T.peachSoft, tone: T.peach };
          return (
            <button key={doc.id} onClick={() => onPick(doc)} className="pickRow" style={pickRow}>
              <Avatar size={48} tone={dd.soft} color={dd.tone} icon={User} />
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{doc.name}</div>
                <div style={{ fontSize: 13, color: T.sub, marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>{doc.title} <Stars r={doc.rating} /> <span>· {doc.exp}n KN</span></div>
              </div>
              <ChevronRight size={20} color={T.sub} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PickTime({ doctor, online, onBack, onPick }) {
  // Chọn ngày trên calendar tháng: đặt được từ ngày mai đến 1 năm tới
  const today0 = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const minDate = useMemo(() => { const d = new Date(today0); d.setDate(d.getDate() + 1); return d; }, [today0]);
  const maxDate = useMemo(() => { const d = new Date(today0); d.setFullYear(d.getFullYear() + 1); return d; }, [today0]);
  const [date, setDate] = useState(minDate);
  const [ym, setYm] = useState({ y: minDate.getFullYear(), m: minDate.getMonth() });
  const [slot, setSlot] = useState(null);      // slot object đã chọn
  const [apiSlots, setApiSlots] = useState(null); // slot thật từ backend
  const [loading, setLoading] = useState(false);

  // Định dạng theo giờ địa phương — toISOString() lùi 1 ngày với múi giờ UTC+7
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Tải slot thật khi đổi ngày (chỉ khi online và đã chọn 1 bác sĩ cụ thể)
  useEffect(() => {
    setSlot(null);
    if (online && doctor && doctor.id) {
      setLoading(true);
      api.slots(doctor.id, ymd(date))
        .then((s) => setApiSlots(Array.isArray(s) ? s : []))
        .catch(() => setApiSlots(null))
        .finally(() => setLoading(false));
    } else {
      setApiSlots(null);
    }
  }, [date, doctor, online]);

  // Nếu có slot thật → dùng; nếu không → dùng danh sách giờ mẫu
  const useReal = apiSlots !== null;
  const takenMock = useMemo(() => new Set(SLOTS.filter((_, i) => (date.getDate() + i) % 3 === 0)), [date]);

  return (
    <div>
      <BackLink onBack={onBack} />
      <h3 style={{ fontSize: 21, color: T.ink, margin: "0 0 16px", fontWeight: 800 }}>Chọn ngày & giờ khám</h3>
      {(() => {
        const startIdx = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7; // tuần bắt đầu Thứ 2
        const soNgay = new Date(ym.y, ym.m + 1, 0).getDate();
        const doiThang = (dir) => setYm(({ y, m }) => { const d = new Date(y, m + dir, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
        const navBtn = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 7, cursor: "pointer", display: "grid", placeItems: "center" };
        return (
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <button onClick={() => doiThang(-1)} style={navBtn}><ChevronLeft size={17} color={T.sub} /></button>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>Tháng {ym.m + 1} / {ym.y}</div>
              <button onClick={() => doiThang(1)} style={navBtn}><ChevronRight size={17} color={T.sub} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((t) => (
                <div key={t} style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: T.sub, padding: "3px 0" }}>{t}</div>
              ))}
              {Array.from({ length: startIdx }).map((_, i) => <div key={"e" + i} />)}
              {Array.from({ length: soNgay }, (_, i) => i + 1).map((d) => {
                const day = new Date(ym.y, ym.m, d);
                const disabled = day < minDate || day > maxDate;
                const on = day.toDateString() === date.toDateString();
                const isToday = day.toDateString() === today0.toDateString();
                return (
                  <button key={d} disabled={disabled} onClick={() => { setDate(day); setSlot(null); }} style={{
                    aspectRatio: "1", borderRadius: 12, fontFamily: "inherit", fontSize: 13.5, cursor: disabled ? "not-allowed" : "pointer",
                    border: on ? `2px solid ${T.peach}` : `1.5px solid ${isToday ? T.sky : T.line + "88"}`,
                    background: on ? T.peach : disabled ? "#F7F7F7" : T.surface,
                    color: on ? "#fff" : disabled ? "#C5CAD3" : T.ink, fontWeight: on || isToday ? 800 : 600,
                  }}>{d}</button>
                );
              })}
            </div>
          </Card>
        );
      })()}
      <div style={{ fontSize: 13.5, color: T.sub, margin: "20px 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
        <Clock size={15} /> Khung giờ còn trống · <b style={{ color: T.ink }}>{fmtDate(date)}</b> {loading && "· đang tải..."}
      </div>

      {useReal ? (
        apiSlots.length === 0 ? (
          <div style={{ color: T.sub, fontSize: 14, padding: "10px 0" }}>Không còn khung giờ trống trong ngày này. Vui lòng chọn ngày khác.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 10 }}>
            {apiSlots.map((s) => {
              const on = slot && slot.id === s.id;
              return <button key={s.id} onClick={() => setSlot(s)} style={{ padding: "13px 0", borderRadius: 14, border: `1.5px solid ${on ? T.peach : T.line}`, background: on ? T.peach : T.surface, color: on ? "#fff" : T.ink, fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>{s.gio_bat_dau}<div style={{ fontSize: 10, fontWeight: 600, color: on ? "#fff" : T.sub }}>còn {s.con_lai}</div></button>;
            })}
          </div>
        )
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 10 }}>
          {SLOTS.map((t) => {
            const full = takenMock.has(t), on = slot === t;
            return <button key={t} disabled={full} onClick={() => setSlot(t)} style={{ padding: "13px 0", borderRadius: 14, border: `1.5px solid ${on ? T.peach : full ? "#F2F2F2" : T.line}`, background: on ? T.peach : full ? "#F7F7F7" : T.surface, color: on ? "#fff" : full ? "#C5CAD3" : T.ink, fontWeight: 700, fontSize: 14.5, cursor: full ? "not-allowed" : "pointer" }}>{t}{full && <div style={{ fontSize: 10, fontWeight: 600 }}>Hết</div>}</button>;
          })}
        </div>
      )}

      <Btn full size="lg" disabled={!slot} onClick={() => onPick(date, slot)} style={{ marginTop: 24, ...(slot ? {} : { opacity: .45, cursor: "not-allowed" }) }}>Tiếp tục <ChevronRight size={17} /></Btn>
    </div>
  );
}

function Confirm({ sel, dept, err, onBack, onConfirm }) {
  const { online, portal } = useNav();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bhyt, setBhyt] = useState("");
  const [busy, setBusy] = useState(false);
  const needLogin = online && !store.token;
  // SĐT Việt Nam: 10-11 chữ số, bắt đầu bằng 0 (bỏ qua khoảng trắng/dấu chấm khi nhập)
  const ok = !needLogin && name.trim() && /^0\d{9,10}$/.test(phone.replace(/[\s.]/g, ""));
  const gio = sel.slot && typeof sel.slot === "object" ? sel.slot.gio_bat_dau : sel.slot;
  const submit = async () => { setBusy(true); await onConfirm({ name, phone, bhyt }); setBusy(false); };
  return (
    <div>
      <BackLink onBack={onBack} />
      <h3 style={{ fontSize: 21, color: T.ink, margin: "0 0 18px", fontWeight: 800 }}>Xác nhận thông tin</h3>
      {needLogin && (
        <div style={{ background: T.goldSoft, borderRadius: 14, padding: "14px 18px", marginBottom: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, fontSize: 14, color: "#8A5A00" }}>Lịch hẹn sẽ được lưu vào hồ sơ của bạn — vui lòng đăng nhập trước khi xác nhận.</div>
          <Btn size="sm" onClick={() => portal("patient")}><CircleUser size={15} /> Đăng nhập</Btn>
        </div>
      )}
      <div style={{ background: T.bg, borderRadius: 16, padding: "16px 20px", marginBottom: 20 }}>
        <SummaryRow k="Khoa phòng" v={dept?.name} />
        <SummaryRow k="Bác sĩ" v={sel.doctor?.name} />
        <SummaryRow k="Ngày khám" v={fmtDate(sel.date)} />
        <SummaryRow k="Giờ khám" v={gio} last />
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <FormField label="Họ và tên bệnh nhân *"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" style={input} /></FormField>
        <FormField label="Số điện thoại *"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" style={input} /></FormField>
        <FormField label="Số thẻ BHYT (tùy chọn)"><input value={bhyt} onChange={(e) => setBhyt(e.target.value)} placeholder="GD4 79 xxxxxxxxx" style={input} /></FormField>
      </div>
      {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
      <Btn full size="lg" disabled={!ok || busy} onClick={submit} style={{ marginTop: 18, ...(ok && !busy ? {} : { opacity: .45, cursor: "not-allowed" }) }}>{busy ? "Đang xử lý..." : "Xác nhận đặt lịch"}</Btn>
    </div>
  );
}

function BookingSuccess({ sel, dept, code, queue, demo, onDone }) {
  const { portal } = useNav();
  const gio = sel.slot && typeof sel.slot === "object" ? sel.slot.gio_bat_dau : sel.slot;
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div style={{ width: 84, height: 84, borderRadius: "50%", background: T.mintSoft, display: "grid", placeItems: "center", margin: "0 auto 16px" }}><CheckCircle2 size={46} color={T.mint} /></div>
      <h3 style={{ fontSize: 24, color: T.ink, margin: "0 0 6px", fontWeight: 800 }}>{demo ? "Đặt lịch thử nghiệm thành công!" : "Đặt lịch thành công! 🎉"}</h3>
      {demo ? (
        <p style={{ color: "#C0392B", background: "#FDECEA", fontSize: 14, margin: "0 auto", padding: "8px 16px", borderRadius: 12, maxWidth: 400 }}>
          Đây là lịch hẹn demo — <b>chưa được lưu vào hệ thống</b> vì backend chưa chạy.
        </p>
      ) : (
        <p style={{ color: T.sub, fontSize: 15, margin: "0 0 4px" }}>Thông tin lịch hẹn đã được gửi tới điện thoại của bạn.</p>
      )}
      <div style={{ background: T.bg, border: `1px dashed ${T.peach}`, borderRadius: 18, padding: 22, maxWidth: 360, margin: "22px auto 0", textAlign: "left" }}>
        <div style={{ borderBottom: `1px dashed ${T.line}`, paddingBottom: 14, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.sub, fontWeight: 700 }}>MÃ LỊCH HẸN</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.peach, letterSpacing: 3 }}>{code}</div>
        </div>
        <SummaryRow k="Khoa" v={dept?.name} />
        <SummaryRow k="Bác sĩ" v={sel.doctor?.name} />
        <SummaryRow k="Thời gian" v={`${gio} · ${fmtDate(sel.date)}`} />
        <SummaryRow k="Số thứ tự dự kiến" v={"#" + (queue || 1)} last />
      </div>
      <div style={{ display: "flex", gap: 12, maxWidth: 360, margin: "22px auto 0" }}>
        <Btn kind="ghost" full onClick={onDone}>Về trang chủ</Btn>
        <Btn full onClick={() => portal("patient", !!store.token)}>Xem lịch hẹn</Btn>
      </div>
    </div>
  );
}

const SummaryRow = ({ k, v, last }) => <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: last ? "none" : `1px solid ${T.line}55`, fontSize: 14 }}><span style={{ color: T.sub }}>{k}</span><span style={{ fontWeight: 700, color: T.ink }}>{v}</span></div>;

// ---------- AUTH ----------
function AuthScreen({ role }) {
  const { go, portal, online } = useNav();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ ho_ten: "", tk: "", mat_khau: "", otp: "", ngay_sinh: "", gioi_tinh: "", dia_chi: "", so_bhyt: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const cfg = {
    patient: { tone: T.peach, soft: T.peachSoft, title: "Bệnh nhân", icon: CircleUser },
    doctor: { tone: T.sky, soft: T.skySoft, title: "Bác sĩ", icon: Stethoscope },
    reception: { tone: T.gold, soft: T.goldSoft, title: "Lễ tân", icon: UserCheck },
    admin: { tone: T.lav, soft: T.lavSoft, title: "Quản trị viên", icon: Shield },
  }[role];
  const Icon = cfg.icon;

  const demoAcc = { patient: "benhnhan@demo.vn", doctor: "bacsi@demo.vn", reception: "letan@demo.vn", admin: "admin@demo.vn" }[role];

  const getOtp = async () => {
    setErr(null);
    if (!f.tk) { setErr("Nhập số điện thoại trước khi lấy OTP"); return; }
    try { const r = await api.requestOtp(f.tk); setOtpSent(true); setMsg(`Mã OTP (demo): ${r.otp_demo}`); }
    catch (e) { setErr(e.message); }
  };

  // Vai trò backend nào được phép vào cổng nào
  const allowedRoles = {
    patient: ["benh_nhan"],
    doctor: ["bac_si"],
    reception: ["le_tan"],
    admin: ["admin"],
  }[role];
  const roleLabel = { benh_nhan: "Bệnh nhân", le_tan: "Lễ tân", bac_si: "Bác sĩ", admin: "Quản trị viên" };

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      if (!online) {
        // offline: vào thẳng chế độ demo
        portal(role, true); return;
      }
      let r;
      if (mode === "login") {
        r = await api.login(f.tk, f.mat_khau);
      } else {
        // Đăng ký: thông tin bệnh nhân được lưu vào cả tài khoản lẫn hồ sơ bệnh nhân
        r = await api.register({
          ho_ten: f.ho_ten, sdt: f.tk, mat_khau: f.mat_khau, otp: f.otp,
          ngay_sinh: f.ngay_sinh, gioi_tinh: f.gioi_tinh, dia_chi: f.dia_chi, so_bhyt: f.so_bhyt,
        });
      }
      // Kiểm tra vai trò tài khoản có khớp cổng đang chọn không
      const vt = String((r.user && r.user.vai_tro) || "").trim().toLowerCase();
      if (vt && !allowedRoles.includes(vt)) {
        setErr(`Tài khoản này là "${roleLabel[vt] || vt}", không dùng để đăng nhập cổng ${cfg.title}. Vui lòng chọn đúng cổng ở nút góc dưới bên phải.`);
        return;
      }
      store.set(r.access_token, r.user);
      portal(role, true);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 22, background: `radial-gradient(circle at 30% 20%, ${cfg.soft}, ${T.bg} 60%)` }}>
      <Card style={{ padding: "38px 36px", width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(45,58,78,.12)" }}>
        <button onClick={() => go("home")} style={{ background: "none", border: "none", color: T.sub, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 22 }}><ArrowLeft size={15} /> Trang chủ</button>
        <span style={{ width: 58, height: 58, borderRadius: 18, background: cfg.soft, color: cfg.tone, display: "grid", placeItems: "center", marginBottom: 16 }}><Icon size={28} /></span>
        <h2 style={{ fontSize: 25, color: T.ink, margin: "0 0 4px", fontWeight: 800 }}>{mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản"}</h2>
        <p style={{ color: T.sub, fontSize: 14.5, margin: "0 0 20px" }}>Đăng nhập với vai trò <b style={{ color: cfg.tone }}>{cfg.title}</b></p>

        {online && mode === "login" && (
          <div style={{ background: cfg.soft, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: T.ink }}>
            Tài khoản demo: <b>{demoAcc}</b> · mật khẩu <b>123456</b>
            <button onClick={() => setF({ ...f, tk: demoAcc, mat_khau: "123456" })} style={{ marginLeft: 8, background: "none", border: "none", color: cfg.tone, fontWeight: 800, cursor: "pointer", fontSize: 13 }}>Điền nhanh</button>
          </div>
        )}
        {!online && <div style={{ background: T.goldSoft, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#8A5A00" }}>Chưa kết nối backend — sẽ vào chế độ xem thử (demo).</div>}

        <div style={{ display: "grid", gap: 13 }}>
          {mode === "register" && <InputWithIcon icon={User} placeholder="Họ và tên" value={f.ho_ten} onChange={upd("ho_ten")} />}
          <InputWithIcon icon={role === "patient" ? Phone : Mail} placeholder={role === "patient" ? "Số điện thoại" : "Email"} value={f.tk} onChange={upd("tk")} />
          <InputWithIcon icon={Lock} placeholder="Mật khẩu" type="password" value={f.mat_khau} onChange={upd("mat_khau")} />
          {mode === "register" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <InputWithIcon icon={Calendar} type="date" title="Ngày sinh" value={f.ngay_sinh} onChange={upd("ngay_sinh")} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px", background: T.surface }}>
                  <User size={18} color={T.sub} />
                  <select value={f.gioi_tinh} onChange={upd("gioi_tinh")} style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontSize: 15, fontFamily: "inherit", background: "transparent", color: f.gioi_tinh ? T.ink : "#B5BCC8" }}>
                    <option value="">Giới tính</option><option>Nữ</option><option>Nam</option><option>Khác</option>
                  </select>
                </div>
              </div>
              <InputWithIcon icon={MapPin} placeholder="Địa chỉ" value={f.dia_chi} onChange={upd("dia_chi")} />
              <InputWithIcon icon={BadgeCheck} placeholder="Số thẻ BHYT (không bắt buộc)" value={f.so_bhyt} onChange={upd("so_bhyt")} />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}><InputWithIcon icon={Shield} placeholder="Mã OTP" value={f.otp} onChange={upd("otp")} /></div>
                <Btn kind="ghost" size="sm" onClick={getOtp} style={{ whiteSpace: "nowrap" }}>Lấy OTP</Btn>
              </div>
            </>
          )}
        </div>

        {msg && <div style={{ color: T.mint, fontSize: 13, marginTop: 12, fontWeight: 700 }}>{msg}</div>}
        {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 12 }}>{err}</div>}

        <Btn full size="lg" onClick={submit} disabled={busy} style={{ marginTop: 18, background: `linear-gradient(135deg, ${cfg.tone}, ${cfg.tone}CC)`, boxShadow: `0 8px 20px ${cfg.tone}40`, ...(busy ? { opacity: .6 } : {}) }}>
          {busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký"} <ChevronRight size={17} />
        </Btn>
        {role === "patient" && (
          <div style={{ textAlign: "center", marginTop: 18, fontSize: 14, color: T.sub }}>
            {mode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(null); setMsg(null); }} style={{ background: "none", border: "none", color: cfg.tone, fontWeight: 800, cursor: "pointer", fontSize: 14 }}>{mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}</button>
          </div>
        )}
      </Card>
    </div>
  );
}

function InputWithIcon({ icon: Icon, ...p }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px", background: T.surface }}>
      <Icon size={18} color={T.sub} />
      <input {...p} style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontSize: 15, fontFamily: "inherit", background: "transparent", color: T.ink }} />
    </div>
  );
}

// ---------- PATIENT PORTAL ----------
function PatientPortal() {
  const [tab, setTab] = useState("dash");
  const items = [
    { id: "dash", label: "Tổng quan", icon: LayoutDashboard },
    { id: "appts", label: "Lịch hẹn của tôi", icon: CalendarCheck },
    { id: "records", label: "Lịch sử khám", icon: FileText },
    { id: "profile", label: "Hồ sơ cá nhân", icon: CircleUser },
  ];
  const name = (store.user && store.user.ho_ten) || "Trần Mai Phương";
  return (
    <PortalShell role="patient" tone={T.peach} soft={T.peachSoft} name={name} sub="Bệnh nhân" items={items} tab={tab} setTab={setTab}>
      {tab === "dash" && <PatientDash setTab={setTab} />}
      {tab === "appts" && <PatientAppts />}
      {tab === "records" && <PatientRecords />}
      {tab === "profile" && <PatientProfile />}
    </PortalShell>
  );
}

// Tổng quan bệnh nhân: số liệu đếm trực tiếp từ database khi backend chạy
function PatientDash({ setTab }) {
  const { go, online } = useNav();
  const live = online && !!store.token;
  const [d, setD] = useState(null); // { appts, kham, hoSo }

  useEffect(() => {
    if (!live) return;
    Promise.all([api.myAppts(), api.myHistory(), api.profileRecords()])
      .then(([a, h, r]) => setD({
        appts: (Array.isArray(a) ? a : []).map(mapAppt),
        kham: Array.isArray(h) ? h.length : 0,
        hoSo: Array.isArray(r) ? r.length : 0,
      }))
      .catch(() => setD({ appts: [], kham: 0, hoSo: 0 }));
  }, [online]);

  const ten = (store.user && store.user.ho_ten) || "Mai Phương";
  const appts = live ? ((d && d.appts) || []) : MY_APPTS;
  const upcoming = appts.filter((a) => a.status === "confirmed" || a.status === "pending");
  const next = upcoming[0];
  return (
    <div>
      <PageTitle title={`Xin chào, ${ten} 👋`} sub={live ? "Số liệu bên dưới lấy trực tiếp từ hệ thống." : "Chúc bạn và bé luôn khỏe mạnh."} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }} className="grid3">
        <StatCard icon={CalendarCheck} tone={T.peach} soft={T.peachSoft} n={upcoming.length} l="Lịch hẹn sắp tới" />
        <StatCard icon={FileText} tone={T.mint} soft={T.mintSoft} n={live ? (d ? d.kham : "...") : 8} l="Lần khám đã hoàn thành" />
        <StatCard icon={Users} tone={T.lav} soft={T.lavSoft} n={live ? (d ? d.hoSo : "...") : 2} l="Hồ sơ trong tài khoản" />
      </div>
      <Card style={{ padding: 26, marginBottom: 20, background: `linear-gradient(120deg, ${T.peachSoft}, ${T.lavSoft})`, border: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          {next ? (
            <div>
              <Pill tone={T.peach} soft="#fff"><Clock size={13} /> Lịch hẹn gần nhất</Pill>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "12px 0 6px" }}>{next.dept} · {next.doctor}</div>
              <div style={{ color: T.ink, opacity: .7, fontSize: 14.5 }}>{next.time} · {next.date}{next.queue ? ` · Số thứ tự #${next.queue}` : ""} · Mã {next.id}</div>
            </div>
          ) : (
            <div>
              <Pill tone={T.peach} soft="#fff"><Clock size={13} /> Lịch hẹn</Pill>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "12px 0 6px" }}>Bạn chưa có lịch hẹn sắp tới</div>
              <div style={{ color: T.ink, opacity: .7, fontSize: 14.5 }}>Đặt lịch khám để được phục vụ nhanh chóng, không chờ đợi.</div>
            </div>
          )}
          {next
            ? <Btn onClick={() => setTab("appts")}>Xem chi tiết <ChevronRight size={16} /></Btn>
            : <Btn onClick={() => go("booking")}><Plus size={16} /> Đặt lịch ngay</Btn>}
        </div>
      </Card>
      <SectionHead title="Thao tác nhanh" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="grid3">
        {[
          { icon: Plus, t: "Đặt lịch mới", tone: T.peach, soft: T.peachSoft, fn: () => go("booking") },
          { icon: FileText, t: "Lịch sử khám", tone: T.mint, soft: T.mintSoft, fn: () => setTab("records") },
          { icon: CircleUser, t: "Cập nhật hồ sơ", tone: T.lav, soft: T.lavSoft, fn: () => setTab("profile") },
        ].map((a) => (
          <Card key={a.t} hover onClick={a.fn} style={{ padding: 22, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 46, height: 46, borderRadius: 14, background: a.soft, color: a.tone, display: "grid", placeItems: "center" }}><a.icon size={22} /></span>
            <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{a.t}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PatientAppts() {
  const { go, online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(live ? null : MY_APPTS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [docsFor, setDocsFor] = useState(null); // dbId lịch hẹn đang mở panel bệnh án
  const [payments, setPayments] = useState({}); // dbId lịch hẹn -> hóa đơn (nếu có)

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.myAppts()
      .then((r) => setList(Array.isArray(r) ? r.map(mapAppt) : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
    // Hóa đơn lễ tân lập cho bệnh nhân — hiển thị yêu cầu thanh toán
    api.myPayments()
      .then((r) => {
        const m = {};
        (Array.isArray(r) ? r : []).forEach((t) => {
          const id = t.lich_hen && t.lich_hen.id;
          if (id && t.trang_thai !== "da_huy" && !m[id]) m[id] = t;
        });
        setPayments(m);
      })
      .catch(() => setPayments({}));
  };
  useEffect(load, [online]);

  // Hủy = cập nhật trạng thái trong database; Xóa = xóa hẳn bản ghi (chỉ lịch đã hủy)
  const cancel = async (a) => {
    if (a.dbId && live) {
      try { await api.cancelAppt(a.dbId); load(); } catch (e) { alert(e.message); }
    }
  };
  const remove = async (a) => {
    if (!(a.dbId && live)) return;
    if (!window.confirm(`Xóa vĩnh viễn lịch hẹn ${a.id} khỏi hệ thống?`)) return;
    try { await api.deleteAppt(a.dbId); load(); } catch (e) { alert(e.message); }
  };

  const data = list || [];
  return (
    <div>
      <PageTitle title="Lịch hẹn của tôi" sub={live ? "Quản lý các lịch hẹn khám của bạn." : "Dữ liệu demo — đăng nhập với backend để xem lịch thật."} action={<Btn onClick={() => go("booking")}><Plus size={16} /> Đặt lịch mới</Btn>} />
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải lịch hẹn...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {!loading && !err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Bạn chưa có lịch hẹn nào. Hãy đặt lịch mới.</Card>}
      <div style={{ display: "grid", gap: 14 }}>
        {data.map((a) => (
          <div key={a.id}>
            <ApptRow a={a} onCancel={() => cancel(a)} onDelete={live ? () => remove(a) : undefined}
              onDocs={live && a.dbId ? () => setDocsFor(docsFor === a.dbId ? null : a.dbId) : undefined} />
            {a.dbId && payments[a.dbId] && <PaymentNotice t={payments[a.dbId]} />}
            {docsFor === a.dbId && <ApptDocs lichId={a.dbId} />}
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS = {
  confirmed: { l: "Đã xác nhận", tone: T.mint, soft: T.mintSoft },
  pending: { l: "Chờ xác nhận", tone: T.gold, soft: T.goldSoft },
  done: { l: "Đã khám", tone: T.sub, soft: "#F0F0F2" },
  cancelled: { l: "Đã hủy", tone: "#C0392B", soft: "#FDECEA" },
};

function ApptRow({ a, onCancel, onDelete, onDocs }) {
  const s = STATUS[a.status] || STATUS.pending;
  const active = a.status !== "done" && a.status !== "cancelled";
  return (
    <Card style={{ padding: 22, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <span style={{ width: 56, height: 56, borderRadius: 16, background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center", flexShrink: 0 }}><Calendar size={26} /></span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{a.dept}</span>
          <Pill tone={s.tone} soft={s.soft}>{s.l}</Pill>
        </div>
        <div style={{ color: T.sub, fontSize: 14, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span><User size={13} style={{ verticalAlign: -2 }} /> {a.doctor}</span>
          <span><Clock size={13} style={{ verticalAlign: -2 }} /> {a.time} · {a.date}</span>
          {a.queue && <span><ClipboardList size={13} style={{ verticalAlign: -2 }} /> STT #{a.queue}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <span style={{ fontSize: 12.5, color: T.sub, alignSelf: "center" }}>Mã: <b style={{ color: T.ink }}>{a.id}</b></span>
        {onDocs && <Btn kind="ghost" size="sm" onClick={onDocs}><Paperclip size={14} /> Bệnh án</Btn>}
        {active && <Btn kind="ghost" size="sm" style={{ color: T.peach, borderColor: T.peachSoft }} onClick={onCancel}>Hủy</Btn>}
        {a.status === "cancelled" && onDelete && <Btn kind="ghost" size="sm" style={{ color: "#C0392B", borderColor: "#FDECEA" }} onClick={onDelete}><Trash2 size={14} /> Xóa</Btn>}
      </div>
    </Card>
  );
}

// Yêu cầu thanh toán do lễ tân lập cho lịch hẹn — bệnh nhân xem ngay tại đây
function PaymentNotice({ t }) {
  const daTra = t.trang_thai === "da_thanh_toan";
  const tone = daTra ? T.mint : T.gold;
  const soft = daTra ? T.mintSoft : T.goldSoft;
  const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
  return (
    <Card style={{ padding: 16, marginTop: 8, background: soft, border: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 14.5 }}>
            {daTra ? "✓ Đã thanh toán" : "Yêu cầu thanh toán dịch vụ"} · {t.ma_thanh_toan}
          </div>
          <div style={{ fontSize: 13, color: T.ink, opacity: .75, marginTop: 4 }}>
            {t.chi_tiet.map((c) => `${c.ten_dich_vu}${c.so_luong > 1 ? ` ×${c.so_luong}` : ""}`).join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800, color: tone, fontSize: 19 }}>{fmtVND(t.tong_tien)}</div>
          {!daTra && <div style={{ fontSize: 12, color: T.ink, opacity: .7 }}>Vui lòng thanh toán tại quầy lễ tân</div>}
        </div>
      </div>
    </Card>
  );
}

// Mẫu bệnh án đính kèm một lịch hẹn: bệnh nhân tải lên PDF/Word (lưu nhị phân
// trong database), xem lại danh sách, tải về hoặc xóa tệp của chính mình.
function ApptDocs({ lichId }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.documents(lichId)
    .then((r) => setList(Array.isArray(r) ? r : []))
    .catch((e) => { setErr(e.message); setList([]); });
  useEffect(() => { load(); }, [lichId]);

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // cho phép chọn lại cùng một tệp
    if (!file) return;
    setBusy(true); setErr(null);
    try { await api.uploadDocument(lichId, file); await load(); }
    catch (er) { setErr(er.message); }
    finally { setBusy(false); }
  };

  const download = async (d) => {
    setErr(null);
    try {
      const blob = await api.downloadDocument(d.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = d.ten_tep; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (er) { setErr(er.message); }
  };

  const remove = async (d) => {
    if (!window.confirm(`Xóa tệp "${d.ten_tep}" khỏi hệ thống?`)) return;
    setErr(null);
    try { await api.deleteDocument(d.id); await load(); }
    catch (er) { setErr(er.message); }
  };

  const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  const fmtTime = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleDateString("vi-VN"); };
  const data = list || [];
  return (
    <Card style={{ padding: 18, marginTop: 8, background: T.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 14.5 }}><Paperclip size={14} style={{ verticalAlign: -2 }} /> Mẫu bệnh án đính kèm</div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, background: T.peachSoft, color: T.peach, fontWeight: 700, fontSize: 13.5, cursor: busy ? "wait" : "pointer" }}>
          <input type="file" accept=".pdf,.doc,.docx,application/pdf" style={{ display: "none" }} onChange={pick} disabled={busy} />
          <Plus size={15} /> {busy ? "Đang tải lên..." : "Tải tệp lên (PDF/Word)"}
        </label>
      </div>
      {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13, padding: "8px 12px", borderRadius: 10, marginTop: 10 }}>{err}</div>}
      {list && data.length === 0 && !err && <div style={{ color: T.sub, fontSize: 13.5, marginTop: 10 }}>Chưa có tệp nào — tải lên mẫu bệnh án để bác sĩ xem trước buổi khám.</div>}
      <div style={{ display: "grid", gap: 8, marginTop: data.length ? 12 : 0 }}>
        {data.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 14px", flexWrap: "wrap" }}>
            <FileText size={17} color={T.peach} />
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontWeight: 700, color: T.ink, fontSize: 13.5 }}>{d.ten_tep}</div>
              <div style={{ fontSize: 12, color: T.sub }}>{d.loai_tep === "application/pdf" ? "PDF" : "Word"} · {fmtSize(d.kich_thuoc)} · {fmtTime(d.thoi_gian)}</div>
            </div>
            <Btn kind="ghost" size="sm" onClick={() => download(d)}>Tải về</Btn>
            <Btn kind="ghost" size="sm" style={{ color: "#C0392B", borderColor: "#FDECEA" }} onClick={() => remove(d)}><Trash2 size={13} /></Btn>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Lịch sử khám của bệnh nhân: lượt khám + đơn thuốc do bác sĩ ghi,
// lấy từ database qua GET /profile/history (chỉ hồ sơ thuộc tài khoản này)
const RECS_DEMO = [
  { date: "12/06/2026", dept: "IVF", doctor: "BS. Lê Hữu Phúc", diag: "Theo dõi sau chuyển phôi, tiến triển tốt" },
  { date: "20/05/2026", dept: "Khoa Sản", doctor: "BS. Nguyễn Thị Lan", diag: "Khám thai 24 tuần, thai phát triển bình thường" },
  { date: "02/04/2026", dept: "Khoa Phụ", doctor: "BS. Phạm Thu Hà", diag: "Tầm soát định kỳ, kết quả bình thường" },
];

function PatientRecords() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.myHistory()
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  }, [online]);

  if (!live) {
    return (
      <div>
        <PageTitle title="Lịch sử khám" sub="Dữ liệu demo — đăng nhập với backend để xem kết quả khám thật." />
        <div style={{ display: "grid", gap: 14 }}>
          {RECS_DEMO.map((r, i) => (
            <Card key={i} style={{ padding: 22 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Pill tone={T.sky} soft={T.skySoft}>{r.dept}</Pill><span style={{ fontSize: 13, color: T.sub }}>{r.date}</span></div>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, margin: "10px 0 4px" }}>{r.diag}</div>
              <div style={{ color: T.sub, fontSize: 13.5 }}><User size={13} style={{ verticalAlign: -2 }} /> {r.doctor}</div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const fmt = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleDateString("vi-VN"); };
  const data = list || [];
  return (
    <div>
      <PageTitle title="Lịch sử khám" sub="Toàn bộ kết quả khám và đơn thuốc của bạn, lưu trong hệ thống." />
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải lịch sử khám...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {!loading && !err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Bạn chưa có lượt khám nào trong hệ thống.</Card>}
      <div style={{ display: "grid", gap: 14 }}>
        {data.map((r) => (
          <Card key={r.id} style={{ padding: 22 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {r.lich_hen && r.lich_hen.khoa && <Pill tone={T.sky} soft={T.skySoft}>{r.lich_hen.khoa.ten_khoa}</Pill>}
              <span style={{ fontSize: 13, color: T.sub }}>{fmt(r.thoi_gian)}</span>
              {r.lich_hen && <span style={{ fontSize: 12.5, color: T.sub }}>Mã lịch: <b style={{ color: T.ink }}>{r.lich_hen.ma_lich_hen}</b></span>}
              {r.lich_hen && r.lich_hen.ho_so && <span style={{ fontSize: 12.5, color: T.sub }}>Hồ sơ: <b style={{ color: T.ink }}>{r.lich_hen.ho_so.ho_ten}</b></span>}
            </div>
            <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, margin: "10px 0 4px" }}>{r.chan_doan || "(Chưa ghi chẩn đoán)"}</div>
            {r.bac_si && <div style={{ color: T.sub, fontSize: 13.5 }}><User size={13} style={{ verticalAlign: -2 }} /> {r.bac_si.ho_ten}</div>}
            {r.chi_dinh && <div style={{ color: T.sub, fontSize: 14, marginTop: 6 }}><b style={{ color: T.ink }}>Chỉ định:</b> {r.chi_dinh}</div>}
            {r.don_thuoc && r.don_thuoc.danh_sach_thuoc && (
              <div style={{ color: T.sub, fontSize: 14, marginTop: 4 }}>
                <PillIcon size={13} style={{ verticalAlign: -2 }} /> <b style={{ color: T.ink }}>Đơn thuốc:</b> {r.don_thuoc.danh_sach_thuoc}{r.don_thuoc.lieu_dung ? ` — ${r.don_thuoc.lieu_dung}` : ""}
              </div>
            )}
            {r.ghi_chu && <div style={{ color: T.sub, fontSize: 14, marginTop: 4 }}><b style={{ color: T.ink }}>Ghi chú:</b> {r.ghi_chu}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// Hồ sơ cá nhân: đọc/ghi thẳng vào bảng ho_so_benh_nhan qua API.
// Mọi thao tác tạo/sửa/xóa được backend ghi nhật ký kèm timestamp cho quản trị viên.
function PatientProfile() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState(null); // { hs } khi sửa, {} khi thêm mới

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.profileRecords()
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [online]);

  const remove = async (hs) => {
    if (!window.confirm(`Xóa vĩnh viễn hồ sơ ${hs.ma_benh_nhan} (${hs.ho_ten}) khỏi hệ thống?`)) return;
    try { await api.deleteProfileRecord(hs.id); load(); }
    catch (e) { alert(e.message); }
  };

  const fmtNS = (ns) => { if (!ns) return "—"; const d = new Date(ns); return isNaN(d) ? "—" : d.toLocaleDateString("vi-VN"); };
  const fieldsOf = (hs) => [
    ["Họ và tên", hs.ho_ten], ["Ngày sinh", fmtNS(hs.ngay_sinh)], ["Giới tính", hs.gioi_tinh || "—"],
    ["Số điện thoại", hs.sdt || "—"], ["Email (tài khoản)", (store.user && store.user.email) || "—"],
    ["Địa chỉ", hs.dia_chi || "—"], ["Số thẻ BHYT", hs.so_bhyt || "—"], ["Mã bệnh nhân", hs.ma_benh_nhan],
  ];

  if (!live) {
    return (
      <div>
        <PageTitle title="Hồ sơ cá nhân" sub="Quản lý thông tin của bạn và người thân." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa kết nối backend — đăng nhập với backend để xem và chỉnh sửa hồ sơ thật.</Card>
      </div>
    );
  }
  if (form) return <HoSoForm init={form.hs} onBack={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />;

  const data = list || [];
  const [chinh, ...nguoiThan] = data;
  return (
    <div>
      <PageTitle title="Hồ sơ cá nhân" sub="Thông tin lưu trong hệ thống — chỉnh sửa, cập nhật hoặc xóa tại đây." />
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải hồ sơ...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {!loading && !err && !chinh && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          Bạn chưa có hồ sơ bệnh nhân nào.
          <div style={{ marginTop: 16 }}><Btn onClick={() => setForm({})}><Plus size={16} /> Tạo hồ sơ</Btn></div>
        </Card>
      )}
      {chinh && (
        <Card style={{ padding: 28, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
            <Avatar size={72} tone={T.peachSoft} color={T.peach} icon={User} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.ink }}>{chinh.ho_ten}</div>
              <div style={{ color: T.sub, fontSize: 14 }}>Mã BN: {chinh.ma_benh_nhan}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn kind="ghost" size="sm" onClick={() => setForm({ hs: chinh })}><Edit3 size={15} /> Chỉnh sửa</Btn>
              <Btn kind="ghost" size="sm" style={{ color: "#C0392B", borderColor: "#FDECEA" }} onClick={() => remove(chinh)}><Trash2 size={15} /> Xóa</Btn>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px 28px" }} className="grid2">
            {fieldsOf(chinh).map(([k, v]) => <div key={k}><div style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>{k}</div><div style={{ fontSize: 15.5, color: T.ink, fontWeight: 700, marginTop: 3 }}>{v}</div></div>)}
          </div>
        </Card>
      )}
      {chinh && (
        <Card style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div><div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>Hồ sơ người thân</div><div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>Quản lý lịch khám cho con và người thân.</div></div>
            <Btn kind="soft" size="sm" onClick={() => setForm({})}><Plus size={15} /> Thêm hồ sơ</Btn>
          </div>
          {nguoiThan.length > 0 && (
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {nguoiThan.map((hs) => (
                <div key={hs.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: `1.5px solid ${T.line}`, borderRadius: 14, flexWrap: "wrap" }}>
                  <Avatar size={44} tone={T.lavSoft} color={T.lav} icon={User} />
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontWeight: 800, color: T.ink, fontSize: 15 }}>{hs.ho_ten}</div>
                    <div style={{ color: T.sub, fontSize: 13 }}>{hs.ma_benh_nhan} · {fmtNS(hs.ngay_sinh)}{hs.sdt ? ` · ${hs.sdt}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn kind="ghost" size="sm" onClick={() => setForm({ hs })}><Edit3 size={14} /> Sửa</Btn>
                    <Btn kind="ghost" size="sm" style={{ color: "#C0392B", borderColor: "#FDECEA" }} onClick={() => remove(hs)}><Trash2 size={14} /> Xóa</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// Form thêm/sửa hồ sơ — gửi lên PATCH/POST /profile/records (backend ghi nhật ký)
function HoSoForm({ init, onBack, onSaved }) {
  const [f, setF] = useState({
    ho_ten: (init && init.ho_ten) || "", ngay_sinh: (init && init.ngay_sinh) || "",
    gioi_tinh: (init && init.gioi_tinh) || "", sdt: (init && init.sdt) || "",
    dia_chi: (init && init.dia_chi) || "", so_bhyt: (init && init.so_bhyt) || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.ho_ten.trim()) { setErr("Vui lòng nhập họ và tên."); return; }
    if (f.sdt && !/^0\d{9,10}$/.test(f.sdt.replace(/[\s.]/g, ""))) { setErr("Số điện thoại không hợp lệ."); return; }
    setBusy(true); setErr(null);
    try {
      if (init) await api.updateProfileRecord(init.id, f);
      else await api.createProfileRecord(f);
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}><ArrowLeft size={15} /> Về hồ sơ</button>
      <PageTitle title={init ? `Chỉnh sửa hồ sơ: ${init.ho_ten}` : "Thêm hồ sơ mới"} sub={init ? `Mã BN: ${init.ma_benh_nhan}` : "Hồ sơ cho con hoặc người thân trong gia đình."} />
      <Card style={{ padding: 26, maxWidth: 640 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <FormField label="Họ và tên *"><input value={f.ho_ten} onChange={upd("ho_ten")} placeholder="Nhập họ và tên" style={input} /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid2">
            <FormField label="Ngày sinh"><input type="date" value={f.ngay_sinh} onChange={upd("ngay_sinh")} style={input} /></FormField>
            <FormField label="Giới tính">
              <select value={f.gioi_tinh} onChange={upd("gioi_tinh")} style={{ ...input, background: T.surface }}>
                <option value="">— Chọn —</option><option>Nữ</option><option>Nam</option><option>Khác</option>
              </select>
            </FormField>
          </div>
          <FormField label="Số điện thoại"><input value={f.sdt} onChange={upd("sdt")} placeholder="VD: 0912345678" style={input} /></FormField>
          <FormField label="Địa chỉ"><input value={f.dia_chi} onChange={upd("dia_chi")} placeholder="Quận/huyện, tỉnh/thành phố" style={input} /></FormField>
          <FormField label="Số thẻ BHYT"><input value={f.so_bhyt} onChange={upd("so_bhyt")} placeholder="Không bắt buộc" style={input} /></FormField>
        </div>
        {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <Btn kind="ghost" onClick={onBack}>Hủy bỏ</Btn>
          <Btn kind="mint" disabled={busy} onClick={save}><CheckCircle2 size={16} /> {busy ? "Đang lưu..." : init ? "Cập nhật" : "Tạo hồ sơ"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
//  PHẦN 4 — APP ROOT (cổng Bác sĩ, Lễ tân, Admin đã tách ra file riêng)
// ============================================================================

// ============================================================================
//  APP ROOT
// ============================================================================
// Đọc id bài truyền thông từ hash "#/truyen-thong/<id>" — mỗi bài một tab riêng
const docHashBai = () => {
  const m = window.location.hash.match(/^#\/truyen-thong\/(\d+)$/);
  return m ? +m[1] : null;
};

export default function App() {
  const [page, setPage] = useState("home");     // public pages + booking
  const [params, setParams] = useState({});
  const [portalRole, setPortalRole] = useState(null); // patient | doctor | reception | admin
  const [authed, setAuthed] = useState(false);
  // Tab bài truyền thông: window.open("#/truyen-thong/<id>") mở tab trình duyệt
  // mới; tab đó render riêng trang bài viết, không đi qua điều hướng thường.
  const [baiTabId, setBaiTabId] = useState(docHashBai);
  useEffect(() => {
    const onHash = () => setBaiTabId(docHashBai());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Dữ liệu thật từ backend (fallback về mock nếu backend chưa chạy)
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [doctors, setDoctors] = useState(DOCTORS);
  const [online, setOnline] = useState(false); // đã kết nối backend?

  useEffect(() => {
    (async () => {
      try {
        const [deps, docs] = await Promise.all([api.departments(), api.doctors()]);
        if (Array.isArray(deps) && deps.length) setDepartments(deps.map(mapDept));
        if (Array.isArray(docs) && docs.length) setDoctors(docs.map(mapDoctor));
        setOnline(true);
      } catch {
        setOnline(false); // giữ nguyên mock data
      }
    })();
  }, []);

  const go = (p, ps = {}) => { setPortalRole(null); setPage(p); setParams(ps); window.scrollTo(0, 0); };
  const portal = (role, isAuthed = false) => {
    if (isAuthed) { setAuthed(true); setPortalRole(role); }
    else { setAuthed(false); setPortalRole(role); }
    window.scrollTo(0, 0);
  };

  const ctx = { go, portal, page, params, departments, doctors, online };

  // Tab bài truyền thông đứng độc lập — render trước mọi điều hướng khác
  if (baiTabId) {
    return (
      <Nav.Provider value={ctx}>
        <style>{CSS}</style>
        <ArticleTab id={baiTabId} />
      </Nav.Provider>
    );
  }

  let body;
  if (portalRole && !authed) body = <AuthScreen role={portalRole} />;
  else if (portalRole === "patient") body = <PatientPortal />;
  else if (portalRole === "doctor") body = <DoctorPortal />;
  else if (portalRole === "reception") body = <ReceptionPortal />;
  else if (portalRole === "admin") body = <AdminPortal />;
  else if (page === "booking") body = <PublicWrap><BookingFlow /></PublicWrap>;
  else if (page === "departments") body = <PublicWrap><DepartmentsPage /></PublicWrap>;
  else if (page === "doctors") body = <PublicWrap><DoctorsPage /></PublicWrap>;
  else if (page === "news") body = <PublicWrap><NewsPage /></PublicWrap>;
  else if (page === "media") body = <PublicWrap><TruyenThongPage /></PublicWrap>;
  else body = <PublicWrap><Home /></PublicWrap>;

  return (
    <Nav.Provider value={ctx}>
      <style>{CSS}</style>
      <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif", color: T.ink }}>
        {body}
        {/* Role switcher (demo helper) */}
        {!portalRole && <RoleSwitcher portal={portal} />}
      </div>
    </Nav.Provider>
  );
}

function PublicWrap({ children }) {
  return <><PublicHeader />{children}<PublicFooter /></>;
}

function RoleSwitcher({ portal }) {
  const [open, setOpen] = useState(false);
  const roles = [
    { id: "patient", label: "Bệnh nhân", icon: CircleUser, tone: T.peach },
    { id: "doctor", label: "Bác sĩ", icon: Stethoscope, tone: T.sky },
    { id: "reception", label: "Lễ tân", icon: UserCheck, tone: T.gold },
    { id: "admin", label: "Quản trị viên", icon: Shield, tone: T.lav },
  ];
  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60 }}>
      {open && (
        <Card style={{ padding: 10, marginBottom: 12, boxShadow: "0 20px 50px rgba(45,58,78,.18)", width: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.sub, padding: "6px 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>Xem giao diện theo vai trò</div>
          {roles.map((r) => (
            <button key={r.id} onClick={() => { portal(r.id); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "11px 12px", border: "none", background: "none", borderRadius: 12, cursor: "pointer", fontSize: 14.5, fontWeight: 700, color: T.ink, textAlign: "left" }} className="rsItem">
              <span style={{ width: 34, height: 34, borderRadius: 10, background: r.tone + "1A", color: r.tone, display: "grid", placeItems: "center" }}><r.icon size={17} /></span>
              {r.label}
            </button>
          ))}
        </Card>
      )}
      <button onClick={() => setOpen(!open)} style={{ width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, color: "#fff", boxShadow: "0 12px 30px rgba(240,138,124,.4)", display: "grid", placeItems: "center", float: "right" }}>
        {open ? <X size={24} /> : <LayoutDashboard size={24} />}
      </button>
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  .hoverCard { transition: transform .15s, box-shadow .15s, border-color .15s; }
  .hoverCard:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(45,58,78,.10); border-color: ${T.peach}66; }
  .pickRow:hover { border-color: ${T.peach}; transform: translateY(-1px); box-shadow: 0 8px 22px rgba(240,138,124,.12); }
  .rsItem:hover { background: ${T.bg}; }
  .tableRow:hover { background: ${T.bg}; }
  input::placeholder, textarea::placeholder { color: #B5BCC8; }
  @media (max-width: 920px) {
    .heroGrid, .examGrid, .featGrid { grid-template-columns: 1fr !important; }
    .heroArt { display: none !important; }
    .grid4 { grid-template-columns: repeat(2, 1fr) !important; }
    .grid3 { grid-template-columns: repeat(2, 1fr) !important; }
    .footGrid { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 760px) {
    .desktopNav { display: none !important; }
    .mobileBtn { display: block !important; }
    .mobileMenu { display: flex !important; }
    .grid2 { grid-template-columns: 1fr !important; }
    .sidebar { position: fixed !important; left: 0; top: 0; z-index: 50; transform: translateX(-100%); transition: transform .25s; }
    .sidebarOpen { transform: translateX(0) !important; }
    .overlay { display: block !important; }
    .hamb { display: block !important; }
    .tableHead, .tableRow { grid-template-columns: 2fr 1fr auto !important; }
    .tableHead span:nth-child(3), .tableRow > span:nth-child(3), .tableHead span:nth-child(4), .tableRow > span:nth-child(4) { display: none !important; }
  }
  @media (max-width: 560px) {
    .grid4, .grid3 { grid-template-columns: 1fr !important; }
    .footGrid { grid-template-columns: 1fr !important; }
    .stepLabel { display: none !important; }
  }
`;
