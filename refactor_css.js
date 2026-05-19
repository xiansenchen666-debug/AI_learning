const fs = require('fs');

// The upgraded CSS content
const cssContent = `:root {
  --bg: #e8eef2;
  --panel: rgba(255, 255, 255, 0.48);
  --line: rgba(255, 255, 255, 0.68);
  --text: #1e293b;
  --muted: #64748b;
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --blue: #2563eb;
  --emerald: #10b981;
  --orange: #f97316;
  --radius-xl: 24px;
  --radius-2xl: 32px;
  --radius-pill: 999px;
  --shadow-soft: 0 8px 32px rgba(15, 23, 42, 0.06);
  --shadow-strong: 0 18px 48px rgba(30, 41, 59, 0.12);
  --transition: 400ms cubic-bezier(0.4, 0, 0.2, 1);
  --sidebar-width: 260px;
}

* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  min-height: 100vh;
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--text);
  background: var(--bg);
}
button, input { font: inherit; }

/* Background Ambient */
.ambient { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .75; animation: drift 18s ease-in-out infinite; }
.blob.one { top: -12%; left: -10%; width: 44rem; height: 44rem; background: rgba(99, 102, 241, .22); }
.blob.two { top: 16%; right: -12%; width: 40rem; height: 40rem; background: rgba(168, 85, 247, .2); animation-delay: -4s; }
.blob.three { bottom: -20%; left: 18%; width: 46rem; height: 46rem; background: rgba(59, 130, 246, .18); animation-delay: -8s; }

/* Animations */
@keyframes drift {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(24px, -18px, 0) scale(1.08); }
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Layout */
.app-shell { position: relative; display: flex; min-height: 100vh; overflow: hidden; }
.sidebar {
  position: relative; z-index: 2; width: var(--sidebar-width); padding: 20px 16px;
  border-right: 1px solid var(--line); background: rgba(255,255,255,.4); backdrop-filter: blur(28px);
  box-shadow: 4px 0 32px rgba(0,0,0,.02); display: flex; flex-direction: column; gap: 16px;
}
.brand { display: flex; align-items: center; gap: 14px; padding: 12px 10px; }
.brand-mark, .icon-badge { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.brand-mark {
  width: 48px; height: 48px; border-radius: 18px; color: #fff; font-size: 22px; font-weight: 700;
  background: linear-gradient(135deg, #6366f1, #2563eb); box-shadow: 0 14px 24px rgba(99,102,241,.24);
}
.brand-title { margin: 0; font-size: 22px; font-weight: 800; }
.brand-subtitle { margin: 4px 0 0; color: var(--primary); font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }

/* Buttons & Navigation */
.nav { display: flex; flex-direction: column; gap: 8px; padding: 4px; }
.nav-btn, .ghost-btn, .primary-btn, .secondary-btn, .tag-btn, .submit-btn {
  text-decoration: none; border: 0; cursor: pointer; transition: var(--transition);
}
.nav-btn {
  position: relative; display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px;
  color: var(--muted); background: transparent; border-radius: 20px; text-align: left;
}
.nav-btn:hover { color: var(--primary); transform: translateX(6px); background: rgba(255,255,255,0.5); }
.nav-btn.active {
  background: rgba(255,255,255,.72); border: 1px solid rgba(255,255,255,.82); box-shadow: 0 10px 24px rgba(79,70,229,.08);
}
.nav-btn.active::before {
  content: ""; position: absolute; left: -4px; top: 50%; width: 6px; height: 26px; border-radius: 0 999px 999px 0;
  background: var(--primary); transform: translateY(-50%); box-shadow: 0 0 12px rgba(79,70,229,.35);
}
.nav-label { font-weight: 700; }
.icon-badge {
  width: 36px; height: 36px; border-radius: 14px; background: rgba(255,255,255,.6); border: 1px solid rgba(255,255,255,.7);
  font-size: 14px; font-weight: 800;
}
.sidebar-footer { margin-top: auto; border-top: 1px solid var(--line); padding-top: 12px; }

/* Advanced Premium Buttons */
.primary-btn, .submit-btn {
  position: relative; overflow: hidden;
  background: linear-gradient(135deg, var(--primary), #3b82f6);
  color: #fff; border-radius: 18px; font-weight: 800;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.25);
}
.primary-btn::after, .submit-btn::after {
  content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
  transform: translateX(-100%); transition: 0.5s;
}
.primary-btn:hover, .submit-btn:hover {
  transform: translateY(-2px); box-shadow: 0 10px 24px rgba(79, 70, 229, 0.4);
}
.primary-btn:hover::after, .submit-btn:hover::after { animation: shimmer 1.5s infinite; }
.primary-btn:active, .submit-btn:active { transform: translateY(1px); }

.primary-btn { padding: 16px 26px; border: 1px solid rgba(255,255,255,.22); }
.submit-btn { width: 100%; padding: 16px; font-size: 16px; margin-top: 12px; }

.secondary-btn {
  padding: 12px 18px; color: var(--primary); background: rgba(255,255,255,.9);
  border: 1px solid rgba(255,255,255,1); border-radius: 18px; font-weight: 800;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.secondary-btn:hover {
  background: #fff; transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(79, 70, 229, 0.15); border-color: var(--primary);
}

.ghost-btn {
  padding: 12px 18px; color: var(--muted); background: rgba(255,255,255,.44);
  border: 1px solid rgba(255,255,255,.72); border-radius: 18px; font-weight: 800;
}
.ghost-btn:hover {
  background: rgba(255,255,255,.8); transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.tag-btn { padding: 8px 14px; color: var(--muted); background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.75); font-size: 13px; border-radius: 18px; font-weight: 800; }
.tag-btn.active { color: var(--primary); background: rgba(255,255,255,.88); }
.tag-btn:hover { transform: translateY(-1px); background: rgba(255,255,255,.9); }

/* Layout Elements */
.content { position: relative; z-index: 1; flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar {
  position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 24px;
  padding: 24px 32px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.34); backdrop-filter: blur(28px);
}
.topbar-right { display: flex; align-items: center; gap: 16px; }
.page-scroll { flex: 1; overflow: auto; padding: 28px 32px 40px; }
.page { max-width: 1500px; margin: 0 auto; display: none; }
.page.active { display: block; }
.grid { display: grid; gap: 24px; }
.dashboard-grid-top { grid-template-columns: 3fr 1.15fr; }
.dashboard-grid-main { grid-template-columns: 2.1fr 1fr; }

/* Cards */
.card, .hero-card, .guardian-card {
  position: relative; overflow: hidden; border-radius: var(--radius-2xl); border: 1px solid rgba(255,255,255,.72);
  box-shadow: var(--shadow-soft); transition: var(--transition);
}
.card { padding: 24px; background: var(--panel); backdrop-filter: blur(24px); }
.hero-card {
  padding: 32px; background: linear-gradient(120deg, rgba(49,46,129,.9), rgba(30,64,175,.84), rgba(15,23,42,.88));
  color: #fff; box-shadow: 0 24px 56px rgba(49,46,129,.18);
}
.hero-card::after {
  content: ""; position: absolute; inset: auto -90px -120px auto; width: 320px; height: 320px; border-radius: 50%; background: rgba(59,130,246,.25); filter: blur(24px);
}
.hero-body { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 28px; }

/* Pills & Chips */
.status-pill, .avatar-card, .hero-pill, .stat-chip, .mini-chip {
  border: 1px solid rgba(255,255,255,.72); background: rgba(255,255,255,.34); backdrop-filter: blur(18px);
}
.status-pill, .avatar-card { border-radius: var(--radius-pill); box-shadow: var(--shadow-soft); }
.status-pill { padding: 10px 16px; color: var(--muted); font-weight: 700; display: flex; align-items: center; gap: 10px; }
.avatar-card { display: flex; align-items: center; gap: 14px; padding: 6px 8px 6px 16px; }
.avatar {
  width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center;
  background: linear-gradient(135deg, #d8b4fe, #93c5fd); color: #fff; font-weight: 800; font-size: 16px; border: 2px solid #fff;
}
.hero-pill {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: var(--radius-pill);
  color: #dbeafe; font-size: 12px; font-weight: 800; letter-spacing: .05em; margin-bottom: 16px;
}
.mini-chip, .stat-chip { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-pill); }
.mini-chip { padding: 4px 10px; font-size: 11px; color: var(--primary); }
.stat-chip { padding: 6px 12px; font-size: 12px; font-weight: 800; }

/* Typography */
h1, h2, h3, p { margin: 0; }
.hero-title { font-size: clamp(28px, 3vw, 42px); line-height: 1.2; margin-bottom: 12px; }
.hero-title span { color: #93c5fd; }
.hero-desc { max-width: 620px; color: rgba(219,234,254,.92); line-height: 1.75; }
.section-head, .row-between { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.section-title { font-size: 22px; font-weight: 800; }
.muted { color: var(--muted); }

/* Achievements & Progress */
.achievement { display: flex; flex-direction: column; justify-content: center; min-height: 100%; }
.achievement-mark {
  width: 58px; height: 58px; border-radius: 22px; background: rgba(255,255,255,.58); display: grid; place-items: center;
  color: #f59e0b; font-size: 26px; border: 1px solid rgba(255,255,255,.8); margin: 18px 0;
}
.achievement-number { font-size: 38px; font-weight: 900; }
.achievement-number small, .metric strong small { font-size: 16px; color: var(--muted); }
.progress-track, .micro-track {
  width: 100%; overflow: hidden; background: rgba(255,255,255,.56); border: 1px solid rgba(255,255,255,.74);
  box-shadow: inset 0 2px 10px rgba(148,163,184,.12);
}
.progress-track { height: 11px; border-radius: var(--radius-pill); margin: 12px 0 8px; }
.micro-track { height: 8px; border-radius: var(--radius-pill); }
.progress-fill, .micro-fill { height: 100%; border-radius: inherit; }
.progress-fill { width: 75%; background: linear-gradient(90deg, #818cf8, #a855f7); }

/* Course Grid */
.course-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.course-card {
  padding: 20px; border-radius: 24px; background: rgba(255,255,255,.46); border: 1px solid rgba(255,255,255,.72);
  box-shadow: 0 8px 24px rgba(15,23,42,.04); transition: var(--transition);
}
.course-card:not(.locked):hover {
  transform: translateY(-6px) scale(1.02); box-shadow: 0 20px 40px rgba(15,23,42,.08); border-color: rgba(255,255,255,.9);
}
.course-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
.course-icon {
  width: 50px; height: 50px; border-radius: 16px; display: grid; place-items: center; font-size: 18px; font-weight: 900;
  border: 1px solid rgba(255,255,255,.8); background: rgba(255,255,255,.62);
}
.course-meta {
  padding: 6px 10px; border-radius: 12px; font-size: 12px; font-weight: 800; background: rgba(255,255,255,.64);
  border: 1px solid rgba(255,255,255,.8); color: var(--muted);
}
.course-card.math .course-icon, .course-card.math .micro-fill { color: var(--blue); background: rgba(219,234,254,.88); }
.course-card.math .micro-fill { width: 65%; background: linear-gradient(90deg, #60a5fa, #2563eb); }
.course-card.english .course-icon, .course-card.english .micro-fill { color: var(--emerald); background: rgba(209,250,229,.88); }
.course-card.english .micro-fill { width: 42%; background: linear-gradient(90deg, #34d399, #10b981); }
.course-card.physics .course-icon, .course-card.physics .micro-fill { color: var(--orange); background: rgba(255,237,213,.9); }
.course-card.physics .micro-fill { width: 20%; background: linear-gradient(90deg, #fb923c, #f97316); }

/* Locked */
.course-card.locked { opacity: 0.85; filter: grayscale(0.2); }
.course-card.locked .course-icon { background: rgba(226,232,240,.6); color: #94a3b8; border-color: rgba(226,232,240,.8); }
.course-card.locked .course-meta { color: #f43f5e; background: rgba(255,228,230,.8); border-color: rgba(255,228,230,.9); }
.unlock-overlay { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; padding-top: 14px; border-top: 1px dashed rgba(255,255,255,.6); }
.unlock-btn { padding: 6px 12px; font-size: 12px; font-weight: 800; color: #fff; background: var(--primary); border: none; border-radius: 12px; cursor: pointer; transition: var(--transition); }
.unlock-btn:hover { background: #4338ca; transform: translateY(-1px); }

/* Timeline */
.timeline { display: grid; gap: 16px; margin-top: 18px; }
.timeline-item { position: relative; display: grid; grid-template-columns: 52px 1fr; gap: 16px; align-items: start; }
.timeline-item::before {
  content: ""; position: absolute; left: 25px; top: 52px; bottom: -16px; width: 2px;
  background: linear-gradient(180deg, rgba(165,180,252,.7), rgba(255,255,255,0));
}
.timeline-item:last-child::before { display: none; }
.timeline-dot {
  width: 52px; height: 52px; border-radius: 50%; border: 4px solid rgba(255,255,255,.8);
  display: grid; place-items: center; font-weight: 900; box-shadow: var(--shadow-soft);
}
.timeline-dot.done { background: var(--primary); color: #fff; }
.timeline-dot.live { background: #fff; color: var(--orange); }
.timeline-content {
  padding: 18px; border-radius: 22px; border: 1px solid rgba(255,255,255,.8); background: rgba(255,255,255,.54); box-shadow: 0 8px 18px rgba(15,23,42,.04); transition: var(--transition);
}
.timeline-content:hover { transform: translateX(4px); box-shadow: var(--shadow-soft); }
.timeline-content.live { border: 2px solid rgba(251,146,60,.35); background: rgba(255,247,237,.68); }
.timeline-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 14px; font-weight: 800; }

/* Growth & Charts */
.guardian-card { padding: 24px; color: #fff; cursor: pointer; background: linear-gradient(135deg, rgba(16,185,129,.88), rgba(13,148,136,.86)); box-shadow: 0 20px 42px rgba(15,118,110,.18); }
.guardian-card::after { content: "护"; position: absolute; right: -14px; top: -18px; font-size: 120px; line-height: 1; opacity: .12; font-weight: 900; }
.guardian-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
.guardian-box { padding: 18px; border-radius: 22px; border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.12); }
.guardian-box strong { display: block; margin-top: 8px; font-size: 28px; }
.mistake-box { margin-top: 12px; padding: 18px; border-radius: 22px; background: rgba(255,255,255,.56); border: 1px solid rgba(255,255,255,.78); }
.growth-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 24px; }
.growth-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.chart-columns { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 14px; align-items: end; height: 300px; margin-top: 24px; }
.chart-item { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.chart-track {
  width: 100%; height: 100%; display: flex; align-items: end; padding: 0 4px; border-radius: 20px 20px 14px 14px;
  background: rgba(255,255,255,.38); border: 1px solid rgba(255,255,255,.56);
}
.chart-bar { position: relative; width: 100%; height: var(--height); border-radius: 16px 16px 10px 10px; background: var(--bar, rgba(129,140,248,.52)); transition: height 1s ease-out; }
.chart-bar.best::before {
  content: "优秀"; position: absolute; left: 50%; top: -32px; transform: translateX(-50%); padding: 4px 8px; border-radius: 999px;
  background: var(--primary); color: #fff; font-size: 11px; font-weight: 800;
}
.stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,.6); }
.metric strong { display: block; font-size: 36px; font-weight: 900; margin-top: 8px; }
.usage-list { display: grid; gap: 18px; }
.usage-item-head { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 800; margin-bottom: 8px; }
.usage-fill.orange { width: 60%; background: linear-gradient(90deg, #fb923c, #f97316); }
.usage-fill.blue { width: 30%; background: linear-gradient(90deg, #60a5fa, #2563eb); }
.usage-fill.green { width: 10%; background: linear-gradient(90deg, #34d399, #10b981); }
.summary-card { background: linear-gradient(135deg, rgba(238,242,255,.88), rgba(243,232,255,.84)); }
.summary-ghost { position: absolute; right: 14px; top: 8px; font-size: 86px; font-weight: 900; opacity: .08; color: var(--primary); }

/* Login specific */
.login-container {
  position: relative; z-index: 1; width: 100%; max-width: 440px; padding: 48px 40px;
  background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-2xl); box-shadow: var(--shadow-strong);
}
.form-group { margin-bottom: 20px; }
.form-label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
.form-input {
  width: 100%; padding: 14px 18px; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 16px;
  background: rgba(255, 255, 255, 0.9); outline: none; transition: var(--transition); font-size: 15px;
}
.form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }
.notice {
  margin-top: 24px; padding: 16px; border-radius: 16px; background: rgba(241, 245, 249, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.8); text-align: center;
}
.notice p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.6; }
.notice p strong { color: var(--text); }

@media (max-width: 1180px) {
  .dashboard-grid-top, .dashboard-grid-main, .growth-layout, .course-grid { grid-template-columns: 1fr; }
  .hero-body, .growth-header, .section-head, .row-between, .topbar { flex-direction: column; align-items: stretch; }
}
@media (max-width: 900px) {
  .app-shell { flex-direction: column; }
  .sidebar { width: 100%; border-right: 0; border-bottom: 1px solid var(--line); }
  .nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .page-scroll, .topbar { padding-left: 18px; padding-right: 18px; }
  .stats-grid, .guardian-stats { grid-template-columns: 1fr; }
  .chart-columns { gap: 8px; height: 240px; }
}
`;

fs.writeFileSync('assets/style.css', cssContent);

// Refactor script
const files = ['dashboard.html', 'subjects.html', 'course.html', 'mistakes.html', 'growth.html', 'login.html'];
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/assets/style.css" />');
  fs.writeFileSync(file, content);
  console.log('Replaced inline style in', file);
});
