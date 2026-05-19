import os

css_content = """<style>
:root {
  --bg: #F5F5F7;
  --panel: rgba(255, 255, 255, 0.7);
  --line: rgba(26, 43, 60, 0.08);
  --text: #1D1D1F;
  --muted: #86868B;
  --primary: #1A2B3C;
  --primary-hover: #C5A059;
  --accent: #C5A059;
  --blue: #0066CC;
  --emerald: #34C759;
  --orange: #FF9500;
  --cyan: #32ADE6;
  --purple: #AF52DE;
  --hairline: rgba(0, 0, 0, 0.05);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-pill: 999px;
  --shadow-soft: 0 8px 32px rgba(26, 43, 60, 0.04);
  --shadow-strong: 0 18px 48px rgba(26, 43, 60, 0.08);
  --transition: 400ms cubic-bezier(0.4, 0, 0.2, 1);
  --sidebar-width: 260px;
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body { min-height: 100vh; font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif; color: var(--text); background: var(--bg); }
button, input { font: inherit; }
.ambient { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .75; animation: drift 18s ease-in-out infinite; }
.blob.one { top: -12%; left: -10%; width: 44rem; height: 44rem; background: rgba(99, 102, 241, .22); }
.blob.two { top: 16%; right: -12%; width: 40rem; height: 40rem; background: rgba(168, 85, 247, .2); animation-delay: -4s; }
.blob.three { bottom: -20%; left: 18%; width: 46rem; height: 46rem; background: rgba(59, 130, 246, .18); animation-delay: -8s; }
@keyframes drift { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(24px, -18px, 0) scale(1.08); } }
@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
.avatar-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 240px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); border: 1px solid var(--hairline); border-radius: var(--radius-lg); box-shadow: rgba(0, 0, 0, 0.08) 0px 4px 24px, rgba(0, 0, 0, 0.04) 0px 1px 4px; padding: 8px; opacity: 0; visibility: hidden; transform: translateY(-10px) scale(0.98); transform-origin: top right; transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s; z-index: 100; }
.avatar-dropdown.active { opacity: 1; visibility: visible; transform: translateY(0) scale(1); }
.dropdown-header { display: flex; align-items: center; gap: 12px; padding: 12px 8px; }
.dropdown-divider { height: 1px; background: var(--hairline); margin: 8px 0; }
.dropdown-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; background: transparent; border: none; border-radius: var(--radius-sm); color: var(--text); font-size: 14px; text-align: left; cursor: pointer; transition: background 0.2s ease, transform 0.2s ease; }
.dropdown-item:hover { background: rgba(0, 0, 0, 0.04); }
.dropdown-item:active { transform: scale(0.98); background: rgba(0, 0, 0, 0.06); }
@keyframes float { 0% { transform: translateY(0px) scale(1); filter: drop-shadow(0 0 4px rgba(197, 160, 89, 0.3)); } 50% { transform: translateY(-12px) scale(1.15); filter: drop-shadow(0 0 16px rgba(197, 160, 89, 0.8)); } 100% { transform: translateY(0px) scale(1); filter: drop-shadow(0 0 4px rgba(197, 160, 89, 0.3)); } }
@keyframes slideUpFade { 0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }
.slide-up-1 { animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.slide-up-2 { animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards; opacity: 0; }
.slide-up-3 { animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards; opacity: 0; }
.slide-up-4 { animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards; opacity: 0; }
.slide-up-5 { animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards; opacity: 0; }
.glass-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(31, 38, 135, 0.08) !important; background: rgba(255, 255, 255, 0.5) !important; }
.glass-card:hover .badge-icon { transform: scale(1.1) rotate(-5deg); }
.app-shell { position: relative; display: flex; min-height: 100vh; overflow: hidden; }
.sidebar { position: relative; z-index: 2; width: var(--sidebar-width); padding: 20px 16px; border-right: 1px solid var(--line); background: rgba(255,255,255,.4); backdrop-filter: blur(28px); box-shadow: 4px 0 32px rgba(0,0,0,.02); display: flex; flex-direction: column; gap: 16px; }
.brand { display: flex; align-items: center; gap: 14px; padding: 12px 10px; }
.brand-mark, .icon-badge { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.brand-mark { width: 48px; height: 48px; border-radius: 18px; color: #fff; font-size: 22px; font-weight: 700; background: linear-gradient(135deg, #24384d, #1A2B3C); box-shadow: 0 14px 24px rgba(26,43,60,.18); }
.brand-title { margin: 0; font-size: 22px; font-weight: 800; }
.brand-subtitle { margin: 4px 0 0; color: var(--primary); font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
.nav { display: flex; flex-direction: column; gap: 8px; padding: 4px; }
.nav-btn, .ghost-btn, .primary-btn, .secondary-btn, .tag-btn, .submit-btn { text-decoration: none; border: 0; cursor: pointer; transition: var(--transition); }
.nav-btn { position: relative; display: flex; align-items: center; gap: 14px; width: 100%; padding: 16px 18px; color: var(--text); background: transparent; border-radius: 16px; text-align: left; font-weight: 600; font-size: 15px; opacity: 0.85; }
.nav-btn:hover { opacity: 1; transform: translateX(4px); background: rgba(26, 43, 60, 0.05); }
.nav-btn.active { background: #fff; border: 1px solid rgba(26, 43, 60, 0.08); box-shadow: 0 4px 12px rgba(26, 43, 60, 0.05); font-weight: 800; color: var(--primary); opacity: 1; }
.nav-btn.active::before { content: ""; position: absolute; left: -4px; top: 50%; width: 4px; height: 20px; border-radius: 0 4px 4px 0; background: var(--accent); transform: translateY(-50%); box-shadow: 0 0 8px rgba(197, 160, 89, 0.4); }
.nav-label { font-weight: inherit; }
.icon-badge { width: 36px; height: 36px; border-radius: 14px; background: rgba(255,255,255,.6); border: 1px solid rgba(255,255,255,.7); font-size: 14px; font-weight: 800; }
.sidebar-footer { margin-top: auto; border-top: 1px solid var(--line); padding-top: 12px; }
.primary-btn, .submit-btn { position: relative; overflow: hidden; background: linear-gradient(135deg, #24384d, var(--primary)); color: #fff; border-radius: 18px; font-weight: 800; box-shadow: 0 8px 18px rgba(26, 43, 60, 0.16); }
.primary-btn::after, .submit-btn::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent); transform: translateX(-100%); transition: 0.5s; }
.primary-btn:hover, .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(197, 160, 89, 0.18); }
.primary-btn:hover::after, .submit-btn:hover::after { animation: shimmer 1.5s infinite; }
.primary-btn:active, .submit-btn:active { transform: translateY(1px); }
.primary-btn { padding: 16px 26px; border: 1px solid rgba(255,255,255,.22); }
.submit-btn { width: 100%; padding: 16px; font-size: 16px; margin-top: 12px; }
.secondary-btn { padding: 12px 18px; color: var(--primary); background: rgba(255,255,255,.9); border: 1px solid rgba(255,255,255,1); border-radius: 18px; font-weight: 800; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.secondary-btn:hover { background: #fff; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(26, 43, 60, 0.08); border-color: var(--accent); }
.ghost-btn { padding: 12px 18px; color: var(--muted); background: rgba(255,255,255,.44); border: 1px solid rgba(255,255,255,.72); border-radius: 18px; font-weight: 800; }
.ghost-btn:hover { background: rgba(255,255,255,.8); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.tag-btn { padding: 8px 14px; color: var(--muted); background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.75); font-size: 13px; border-radius: 18px; font-weight: 800; }
.tag-btn.active { color: var(--primary); background: rgba(255,255,255,.88); }
.tag-btn:hover { transform: translateY(-1px); background: rgba(255,255,255,.9); }
.content { position: relative; z-index: 1; flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 24px 32px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.34); backdrop-filter: blur(28px); }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.page-scroll { flex: 1; overflow: auto; padding: 28px 32px 40px; }
.page { max-width: 1500px; margin: 0 auto; display: none; }
.page.active { display: block; }
.grid { display: grid; gap: 24px; }
.dashboard-grid-top { grid-template-columns: 3fr 1.15fr; }
.dashboard-grid-main { grid-template-columns: 2.1fr 1fr; }
.card, .hero-card, .guardian-card { position: relative; overflow: hidden; border-radius: var(--radius-2xl); border: 1px solid rgba(255,255,255,.72); box-shadow: var(--shadow-soft); transition: var(--transition); }
.card { padding: 24px; background: var(--panel); backdrop-filter: blur(24px); }
.hero-card { padding: 32px; background: linear-gradient(135deg, #1A2B3C, #0F172A); color: #fff; box-shadow: 0 20px 40px rgba(26, 43, 60, 0.15); border: 1px solid rgba(197, 160, 89, 0.2); }
.hero-card::after { content: ""; position: absolute; inset: auto -90px -120px auto; width: 320px; height: 320px; border-radius: 50%; background: rgba(197, 160, 89, 0.15); filter: blur(32px); }
.hero-body { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 28px; }
.status-pill, .avatar-card, .hero-pill, .stat-chip, .mini-chip { border: 1px solid rgba(255,255,255,.72); background: rgba(255,255,255,.34); backdrop-filter: blur(18px); }
.status-pill, .avatar-card { border-radius: var(--radius-pill); box-shadow: var(--shadow-soft); }
.status-pill { padding: 10px 16px; color: var(--muted); font-weight: 700; display: flex; align-items: center; gap: 10px; }
.avatar-card { display: flex; align-items: center; gap: 14px; padding: 6px 8px 6px 16px; }
.avatar { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, var(--accent), #9A7B3E); color: #fff; font-weight: 800; font-size: 16px; border: 2px solid #fff; }
.hero-pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: var(--radius-pill); color: var(--accent); background: rgba(197, 160, 89, 0.1); border: 1px solid rgba(197, 160, 89, 0.3); font-size: 12px; font-weight: 800; letter-spacing: .05em; margin-bottom: 16px; }
.mini-chip, .stat-chip { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-pill); }
.mini-chip { padding: 4px 10px; font-size: 11px; color: var(--primary); }
.stat-chip { padding: 6px 12px; font-size: 12px; font-weight: 800; }
h1, h2, h3, p { margin: 0; }
.hero-title { font-size: clamp(28px, 3vw, 42px); line-height: 1.2; margin-bottom: 12px; font-weight: 800; }
.hero-title span { color: var(--accent); }
.hero-desc { max-width: 620px; color: rgba(255,255,255,.75); line-height: 1.75; font-size: 15px; }
.section-head, .row-between { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.section-title { font-size: 22px; font-weight: 800; }
.muted { color: var(--muted); }
.achievement { display: flex; flex-direction: column; justify-content: center; min-height: 100%; }
.achievement-mark { width: 58px; height: 58px; border-radius: 22px; background: rgba(255,255,255,.58); display: grid; place-items: center; color: #f59e0b; font-size: 26px; border: 1px solid rgba(255,255,255,.8); margin: 18px 0; }
.achievement-number { font-size: 38px; font-weight: 900; }
.achievement-number small, .metric strong small { font-size: 16px; color: var(--muted); }
.progress-track, .micro-track { width: 100%; overflow: hidden; background: rgba(255,255,255,.56); border: 1px solid rgba(255,255,255,.74); box-shadow: inset 0 2px 10px rgba(148,163,184,.12); }
.progress-track { height: 11px; border-radius: var(--radius-pill); margin: 12px 0 8px; }
.micro-track { height: 8px; border-radius: var(--radius-pill); }
.progress-fill, .micro-fill { height: 100%; border-radius: inherit; }
.progress-fill { width: 75%; background: linear-gradient(90deg, #818cf8, #a855f7); }
.course-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.course-card { padding: 20px; border-radius: 24px; background: rgba(255,255,255,.46); border: 1px solid rgba(255,255,255,.72); box-shadow: 0 8px 24px rgba(15,23,42,.04); transition: var(--transition); }
.course-card:not(.locked):hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 20px 40px rgba(15,23,42,.08); border-color: rgba(255,255,255,.9); }
.course-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
.course-icon { width: 50px; height: 50px; border-radius: 16px; display: grid; place-items: center; font-size: 18px; font-weight: 900; border: 1px solid rgba(255,255,255,.8); background: rgba(255,255,255,.62); }
.course-meta { padding: 6px 10px; border-radius: 12px; font-size: 12px; font-weight: 800; background: rgba(255,255,255,.64); border: 1px solid rgba(255,255,255,.8); color: var(--muted); }
.course-card.math .course-icon, .course-card.math .micro-fill { color: var(--primary); background: rgba(26,43,60,.08); }
.course-card.math .micro-fill { width: 65%; background: linear-gradient(90deg, #54697d, var(--primary)); }
.course-card.english .course-icon, .course-card.english .micro-fill { color: var(--emerald); background: rgba(74,124,89,.12); }
.course-card.english .micro-fill { width: 42%; background: linear-gradient(90deg, #7ca184, var(--emerald)); }
.course-card.physics .course-icon, .course-card.physics .micro-fill { color: var(--accent); background: rgba(197,160,89,.12); }
.course-card.physics .micro-fill { width: 20%; background: linear-gradient(90deg, #d6bc83, var(--accent)); }
.course-card.locked { opacity: 0.85; filter: grayscale(0.2); }
.course-card.locked .course-icon { background: rgba(226,232,240,.6); color: #94a3b8; border-color: rgba(226,232,240,.8); }
.course-card.locked .course-meta { color: #f43f5e; background: rgba(255,228,230,.8); border-color: rgba(255,228,230,.9); }
.chapter-list { list-style: none; padding: 0; margin: 12px 0 0 0; flex-grow: 1; }
.chapter-list li { font-size: 13px; color: var(--muted); padding: 6px 0; border-bottom: 1px dashed var(--hairline); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chapter-list li:last-child { border-bottom: none; }
.unlock-overlay { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; padding-top: 14px; border-top: 1px dashed rgba(255,255,255,.6); }
.unlock-btn { padding: 6px 12px; font-size: 12px; font-weight: 800; color: #fff; background: var(--primary); border: none; border-radius: 12px; cursor: pointer; transition: var(--transition); }
.unlock-btn:hover { background: #4338ca; transform: translateY(-1px); }
.timeline { display: grid; gap: 16px; margin-top: 18px; }
.timeline-item { position: relative; display: grid; grid-template-columns: 52px 1fr; gap: 16px; align-items: start; }
.timeline-item::before { content: ""; position: absolute; left: 25px; top: 52px; bottom: -16px; width: 2px; background: linear-gradient(180deg, rgba(197,160,89,.4), rgba(255,255,255,0)); }
.timeline-item:last-child::before { display: none; }
.timeline-dot { width: 52px; height: 52px; border-radius: 50%; border: 4px solid rgba(255,255,255,.8); display: grid; place-items: center; font-weight: 900; box-shadow: var(--shadow-soft); }
.timeline-dot.done { background: var(--primary); color: #fff; }
.timeline-dot.live { background: #fff; color: var(--orange); }
.timeline-content { padding: 18px; border-radius: 22px; border: 1px solid rgba(255,255,255,.8); background: rgba(255,255,255,.54); box-shadow: 0 8px 18px rgba(15,23,42,.04); transition: var(--transition); }
.timeline-content:hover { transform: translateX(4px); box-shadow: var(--shadow-soft); }
.timeline-content.live { border: 2px solid rgba(251,146,60,.35); background: rgba(255,247,237,.68); }
.timeline-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 14px; font-weight: 800; }
.guardian-card { padding: 24px; color: #fff; cursor: pointer; background: linear-gradient(135deg, rgba(26,43,60,.92), rgba(74,124,89,.82)); box-shadow: 0 20px 42px rgba(26,43,60,.16); }
.guardian-card::after { content: "护"; position: absolute; right: -14px; top: -18px; font-size: 120px; line-height: 1; opacity: .12; font-weight: 900; }
.guardian-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
.guardian-box { padding: 18px; border-radius: 22px; border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.12); }
.guardian-box strong { display: block; margin-top: 8px; font-size: 28px; }
.mistake-box { margin-top: 12px; padding: 18px; border-radius: 22px; background: rgba(255,255,255,.56); border: 1px solid rgba(255,255,255,.78); }
.growth-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 24px; }
.growth-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.chart-columns { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 14px; align-items: end; height: 300px; margin-top: 24px; }
.chart-item { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.chart-track { width: 100%; height: 100%; display: flex; align-items: end; padding: 0 4px; border-radius: 20px 20px 14px 14px; background: rgba(255,255,255,.38); border: 1px solid rgba(255,255,255,.56); }
.chart-bar { position: relative; width: 100%; height: var(--height); border-radius: 16px 16px 10px 10px; background: var(--bar, rgba(197,160,89,.52)); transition: height 1s ease-out; }
.chart-bar.best::before { content: "优秀"; position: absolute; left: 50%; top: -32px; transform: translateX(-50%); padding: 4px 8px; border-radius: 999px; background: var(--primary); color: #fff; font-size: 11px; font-weight: 800; }
.stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,.6); }
.metric strong { display: block; font-size: 36px; font-weight: 900; margin-top: 8px; }
.usage-list { display: grid; gap: 18px; }
.usage-item-head { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 800; margin-bottom: 8px; }
.usage-fill.orange { width: 60%; background: linear-gradient(90deg, #d6bc83, var(--accent)); }
.usage-fill.blue { width: 30%; background: linear-gradient(90deg, #54697d, var(--primary)); }
.usage-fill.green { width: 10%; background: linear-gradient(90deg, #7ca184, var(--emerald)); }
.summary-card { background: linear-gradient(135deg, rgba(255,250,240,.9), rgba(245,239,228,.88)); }
.summary-ghost { position: absolute; right: 14px; top: 8px; font-size: 86px; font-weight: 900; opacity: .08; color: var(--primary); }
.login-page { display: flex; align-items: center; justify-content: center; padding: 40px; overflow: hidden; }
.login-stage { position: relative; z-index: 1; width: min(1080px, 100%); min-height: calc(100vh - 80px); display: grid; grid-template-columns: minmax(420px, 1fr) minmax(420px, 430px); align-items: center; gap: 72px; }
.login-showcase { padding: 8px 8px 8px 8px; }
.login-badge { display: inline-flex; align-items: center; padding: 6px 12px; margin-bottom: 22px; border-radius: var(--radius-pill); border: 1px solid rgba(255,255,255,.72); background: rgba(255,255,255,.36); backdrop-filter: blur(12px); color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
.login-headline { max-width: 520px; font-size: clamp(38px, 4.2vw, 58px); line-height: 1.08; font-weight: 900; letter-spacing: -0.05em; }
.login-copy { max-width: 500px; margin-top: 20px; color: var(--muted); font-size: 17px; line-height: 1.9; }
.login-feature-list { display: grid; gap: 12px; margin-top: 32px; max-width: 500px; }
.login-feature { display: flex; align-items: center; gap: 12px; padding: 10px 0; border: 0; background: transparent; box-shadow: none; }
.login-feature-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--text); box-shadow: none; }
.login-container { position: relative; z-index: 1; width: 100%; max-width: 430px; padding: 40px 36px 30px; background: rgba(255, 255, 255, 0.68); backdrop-filter: blur(22px); border: 1px solid rgba(255, 255, 255, 0.7); border-radius: 30px; box-shadow: 0 18px 52px rgba(30, 41, 59, 0.08); }
.login-container::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; background: linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.08)); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
.login-brand { padding: 0; margin-bottom: 30px; }
.login-card-header { margin-bottom: 28px; }
.login-card-title { font-size: 30px; font-weight: 900; letter-spacing: -0.04em; }
.login-card-subtitle { margin-top: 10px; color: var(--muted); font-size: 14px; }
.form-group { margin-bottom: 18px; }
.form-label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
.form-input { width: 100%; padding: 17px 18px; border: 1px solid rgba(148,163,184,.18); border-radius: 16px; background: rgba(255, 255, 255, 0.84); outline: none; transition: var(--transition); font-size: 15px; box-shadow: inset 0 1px 0 rgba(255,255,255,.5); }
.form-input::placeholder { color: #94a3b8; }
.form-input:focus { border-color: rgba(30,41,59,.16); box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.42); transform: none; }
.submit-btn { margin-top: 16px; padding: 17px; border-radius: 16px; background: linear-gradient(180deg, rgba(60,60,67,.92), rgba(28,28,30,.96)); box-shadow: 0 10px 28px rgba(28,28,30,.18); }
.submit-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 32px rgba(28,28,30,.2); }
.submit-btn:hover::after { animation: none; }
.notice { margin-top: 24px; padding: 14px 2px 0; border-radius: 0; background: transparent; border: 0; border-top: 1px solid rgba(148,163,184,.16); text-align: left; }
.notice p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.75; }
.notice p strong { color: var(--text); }
@media (max-width: 1180px) { .dashboard-grid-top, .dashboard-grid-main, .growth-layout, .course-grid { grid-template-columns: 1fr; } .hero-body, .growth-header, .section-head, .row-between, .topbar { flex-direction: column; align-items: stretch; } .login-stage { grid-template-columns: 1fr; justify-items: center; gap: 36px; } .login-showcase { max-width: 680px; padding: 0; text-align: center; } .login-headline, .login-copy, .login-feature-list { max-width: none; } .login-feature { justify-content: center; } }
@media (max-width: 900px) { .app-shell { flex-direction: column; } .sidebar { width: 100%; border-right: 0; border-bottom: 1px solid var(--line); } .nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } .page-scroll, .topbar { padding-left: 18px; padding-right: 18px; } .stats-grid, .guardian-stats { grid-template-columns: 1fr; } .chart-columns { gap: 8px; height: 240px; } .login-page { padding: 18px; } .login-stage { min-height: calc(100vh - 36px); gap: 18px; } .login-showcase { display: none; } .login-container { max-width: 100%; padding: 30px 22px 24px; border-radius: 24px; } .login-card-title { font-size: 24px; } }
</style>"""

def get_base_html(active_nav, content_body):
    nav_links = {
        'dashboard': '学习中心',
        'subjects': '同步课程',
        'mistakes': '智能错题本',
        'growth': '成长轨迹'
    }
    nav_html = ''
    for key, label in nav_links.items():
        active_class = ' active' if key == active_nav else ' '
        icon_char = label[0]
        nav_html += f'<a href="/{key}" class="nav-btn{active_class}"><span class="icon-badge">{icon_char}</span><span class="nav-label">{label}</span></a>\\n          '
    
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>星途启航 AI 自习室</title>
    {css_content}
  </head>
  <body>
    <div class="ambient">
      <div class="blob one"></div>
      <div class="blob two"></div>
      <div class="blob three"></div>
    </div>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div>
            <div style="display: flex; flex-direction: column; justify-content: center;">
            <div style="position: relative; display: inline-block; font-family: 'Playfair Display', serif; font-weight: 700; color: var(--primary); letter-spacing: -0.5px;">
  <span style="position: absolute; top: -14px; left: -6px; font-size: 14px; color: var(--accent); line-height: 1;">星途</span>
  <span style="font-size: 32px; line-height: 1;">启航教育</span>
</div>
          </div>
          </div>
        </div>
        <nav class="nav">
          {nav_html.strip()}
        </nav>
        <div class="sidebar-footer">
          <button class="nav-btn"><span class="icon-badge">设</span><span class="nav-label">系统设置</span></button>
        </div>
      </aside>
      <main class="content">
        <header class="topbar" style="justify-content: flex-end;">
          <div class="topbar-right">
            <div class="avatar-card" id="avatar-trigger" style="cursor:pointer;position:relative;">
              <div>
                <p style="font-size:14px;font-weight:800;">Cary</p>
                <p class="muted" style="font-size:12px;margin-top:4px;">Lv.12 学霸</p>
              </div>
              <div class="avatar">CA</div>
              <div class="avatar-dropdown" id="avatar-dropdown">
                <div class="dropdown-header">
                  <div class="avatar" style="width:36px;height:36px;font-size:14px;">CA</div>
                  <div>
                    <p style="font-size:14px;font-weight:700;color:var(--text);margin:0;">Cary</p>
                    <p style="font-size:12px;color:var(--muted);margin:2px 0 0;">student@school.edu</p>
                  </div>
                </div>
                <div class="dropdown-divider"></div>
                <a href="/api/logout" class="dropdown-item" style="color:var(--text);text-decoration:none;display:flex;">
                  <span style="font-size:16px;width:20px;text-align:center;">🚪</span> 退出登录
                </a>
              </div>
            </div>
          </div>
        </header>
        <div class="page-scroll">
{content_body}
        </div>
      </main>
    </div>
    <script>
      const avatarTrigger = document.getElementById('avatar-trigger');
      const avatarDropdown = document.getElementById('avatar-dropdown');
      if (avatarTrigger && avatarDropdown) {{
        avatarTrigger.addEventListener('click', function(e) {{
          e.stopPropagation();
          avatarDropdown.classList.toggle('active');
        }});
        document.addEventListener('click', function(e) {{
          if (!avatarTrigger.contains(e.target)) {{
            avatarDropdown.classList.remove('active');
          }}
        }});
      }}
    </script>
  </body>
</html>'''

dashboard_body = '''          <section class="page active" id="dashboard-page">
            <div class="grid dashboard-grid-top">
              <div class="hero-card">
                <div class="hero-body">
                  <div>
                    <div class="hero-pill">AI 深度分析完成  定制路线已生成</div>
                    <h1 class="hero-title">Cary，今天有 <span>12个知识点</span> 需要巩固</h1>
                    <p class="hero-desc">系统已根据艾宾浩斯遗忘曲线为你排好复习计划。我们将通过“先讲解、后刷题”的模式，帮你把知识点从小学到高中彻底串联打通。</p>
                  </div>
                  <button class="primary-btn">开始专属学习</button>
                </div>
              </div>
              <div class="card achievement">
                <p class="muted" style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">学习成就</p>
                <div class="achievement-mark">燃</div>
                <div class="achievement-number">12<small>天</small></div>
                <p style="margin-top:6px;color:var(--accent);font-size:13px;font-weight:800;">连续学习打卡</p>
                <div class="progress-track"><div class="progress-fill"></div></div>
                <p class="muted" style="font-size:13px;">本周学力值 2,450 XP，距离下一等级还差 550 XP</p>
              </div>
            </div>
            <div class="grid dashboard-grid-main" style="margin-top:24px;">
              <div class="grid" style="gap:24px;">
                <div class="card">
                  <div class="section-head">
                    <h2 class="section-title">艾宾浩斯智能刷题 (抗遗忘)</h2>
                    <span class="stat-chip" style="color:var(--emerald);background:rgba(74, 124, 89, 0.15);">临界遗忘点：2</span>
                  </div>
                  <div class="timeline">
                    <div class="timeline-item">
                      <div class="timeline-dot" style="background:var(--orange);color:#fff;border-color:rgba(197, 160, 89, 0.2);font-size:14px;">急</div>
                      <div class="timeline-content" style="border-color:rgba(197, 160, 89, 0.2);background:rgba(197, 160, 89, 0.05);">
                        <div class="timeline-meta"><span style="color:var(--orange);">距离上次学习：2天</span><span class="mini-chip" style="color:var(--orange);background:rgba(255,255,255,.5);">记忆保留率 30%</span></div>
                        <h3 style="margin-bottom:6px;">受力分析 (物理)</h3>
                        <p class="muted" style="font-size:13px;margin-bottom:12px;">系统已为你生成 5 道变式题进行强化记忆</p>
                        <button class="secondary-btn" style="padding:8px 16px;font-size:12px;background:var(--orange);color:#fff;border:none;">立即刷题巩固</button>
                      </div>
                    </div>
                    <div class="timeline-item">
                      <div class="timeline-dot" style="background:var(--accent);color:#fff;border-color:rgba(197, 160, 89, 0.2);font-size:14px;">中</div>
                      <div class="timeline-content">
                        <div class="timeline-meta"><span style="color:var(--accent);">距离上次学习：7天</span><span class="mini-chip" style="color:var(--accent);background:rgba(255,255,255,.5);">记忆保留率 55%</span></div>
                        <h3 style="margin-bottom:6px;">现在完成时 (英语)</h3>
                        <p class="muted" style="font-size:13px;margin-bottom:12px;">即将到达下一个遗忘节点，需完成 10 道语法题</p>
                        <button class="ghost-btn" style="padding:8px 16px;font-size:12px;">开始刷题</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="grid" style="gap:24px;">
                <div class="card">
                  <div class="section-head">
                    <h2 class="section-title">智能错题本</h2>
                    <span class="stat-chip" style="color:var(--orange);background:rgba(107, 91, 149, 0.15);">3 待攻克</span>
                  </div>
                  <div class="mistake-box">
                    <div class="row-between"><span class="mini-chip" style="background:rgba(26, 43, 60, 0.08);">数学</span><span class="muted" style="font-size:12px;">昨天的刷题测试</span></div>
                    <p style="margin:14px 0 18px;line-height:1.7;font-weight:700;">已知二次函数 y=ax^2+bx+c 的图象经过点(1,0)，求对称轴并分析开口方向。</p>
                    <button class="secondary-btn" style="width:100%;">AI 举一反三重刷</button>
                  </div>
                </div>
              </div>
            </div>
          </section>'''

mistakes_body = '''          <section class="page active" id="mistakes-page">
            <div class="growth-header">
              <div>
                <h1 class="section-title" style="font-size:34px;">智能错题本</h1>
                <p class="muted" style="margin-top:8px;">攻克错题，举一反三</p>
              </div>
            </div>
            <div class="grid" style="gap:24px;">
              <div class="card">
                <div class="mistake-box">
                  <div class="row-between"><span class="mini-chip" style="background:rgba(26, 43, 60, 0.08);">数学</span><span class="muted" style="font-size:12px;">昨天的周测</span></div>
                  <p style="margin:14px 0 18px;line-height:1.7;font-weight:700;">已知二次函数 y=ax^2+bx+c 的图象经过点(1,0)，求对称轴并分析开口方向。</p>
                  <button class="secondary-btn" style="width:100%;">AI 举一反三</button>
                </div>
              </div>
            </div>
          </section>'''

growth_body = '''          <section class="page active" id="growth-page">
            <div class="growth-header">
              <div>
                <h1 class="section-title" style="font-size:34px;">成长轨迹</h1>
                <p class="muted" style="margin-top:8px;">全面掌握 Cary 的学习情况与设备使用健康</p>
              </div>
            </div>
            <div class="growth-layout">
              <div class="card">
                <div class="section-head">
                  <h2 class="section-title">本周学情走势</h2>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="tag-btn active">数学</button>
                    <button class="tag-btn">英语</button>
                    <button class="tag-btn">物理</button>
                  </div>
                </div>
                <div class="chart-columns">
                  <div class="chart-item"><div class="chart-track"><div class="chart-bar" style="--height:30%;"></div></div><span class="muted">周一</span></div>
                  <div class="chart-item"><div class="chart-track"><div class="chart-bar" style="--height:45%;"></div></div><span class="muted">周二</span></div>
                  <div class="chart-item"><div class="chart-track"><div class="chart-bar" style="--height:60%;"></div></div><span class="muted">周三</span></div>
                  <div class="chart-item"><div class="chart-track"><div class="chart-bar" style="--height:40%;"></div></div><span class="muted">周四</span></div>
                  <div class="chart-item"><div class="chart-track"><div class="chart-bar" style="--height:75%;"></div></div><span class="muted">周五</span></div>
                  <div class="chart-item"><div class="chart-track"><div class="chart-bar best" style="--height:85%;--bar:linear-gradient(180deg,#818cf8,#8b5cf6);"></div></div><span class="muted">周六</span></div>
                  <div class="chart-item"><div class="chart-track"><div class="chart-bar" style="--height:50%;"></div></div><span class="muted">周日</span></div>
                </div>
                <div class="stats-grid">
                  <div class="metric"><span class="muted">平均正确率</span><strong>86<small>%</small></strong></div>
                  <div class="metric"><span class="muted">学习总时长</span><strong>14<small>h</small></strong></div>
                  <div class="metric"><span class="muted">掌握知识点</span><strong>24<small>个</small></strong></div>
                </div>
              </div>
              <div class="grid" style="gap:24px;">
                <div class="card">
                  <h2 class="section-title" style="font-size:20px;margin-bottom:18px;">应用使用时长（今日）</h2>
                  <div class="usage-list">
                    <div><div class="usage-item-head"><span>AI 错题本</span><span>45 分钟</span></div><div class="micro-track"><div class="micro-fill usage-fill orange"></div></div></div>
                    <div><div class="usage-item-head"><span>数学同步课</span><span>20 分钟</span></div><div class="micro-track"><div class="micro-fill usage-fill blue"></div></div></div>
                    <div><div class="usage-item-head"><span>英汉词典</span><span>10 分钟</span></div><div class="micro-track"><div class="micro-fill usage-fill green"></div></div></div>
                  </div>
                </div>
                <div class="card summary-card">
                  <div class="summary-ghost">AI</div>
                  <h2 class="section-title" style="font-size:20px;margin-bottom:14px;">AI 学情总结</h2>
                  <p style="position:relative;z-index:1;line-height:1.8;color:#312e81;">Cary 本周在数学二次函数板块进步显著，错误率下降了 40%。但在英语阅读长难句分析上停留时间较长，建议周末进行一次英语专项阅读训练。</p>
                  <button class="secondary-btn" style="margin-top:18px;">生成详细报告给家长</button>
                </div>
              </div>
            </div>
          </section>'''

subjects_body = '''          <section class="page active" id="subjects-page">
            <div class="growth-header">
              <div>
                <h1 class="section-title" style="font-size:34px;">全课程目录</h1>
                <p class="muted" style="margin-top:8px;">涵盖小学、初中、高中各科同步课程，已为您全部开放。</p>
            <div style="background: linear-gradient(135deg, rgba(79, 70, 229, 0.04), rgba(124, 58, 237, 0.04)); padding: 16px 24px; border-radius: 16px; display: flex; align-items: center; gap: 16px; margin-top: 16px; border: 1px solid rgba(79, 70, 229, 0.15);">
              <div style="font-size: 28px; background: #fff; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">🎓</div>
              <div>
                <p style="font-weight: 800; font-size: 16px; color: var(--primary); margin: 0; letter-spacing: 0.5px;">联合清华等顶尖名师团队倾力打造</p>
                <p style="font-size: 13px; color: var(--muted); margin: 4px 0 0 0;">深度拆解核心考点，重塑底层逻辑，构建国际化标准的高效学习链路。</p>
              </div>
            </div>
              </div>
            </div>
            <!-- 小学课程 -->
            <div class="card" style="margin-bottom: 24px;">
              <h2 class="section-title" style="font-size:20px;margin-bottom:18px;display:flex;align-items:center;gap:10px;">
                <span class="mini-chip" style="background:rgba(197, 160, 89, 0.2);color:var(--accent);border-color:#fde68a;">小学</span> 小学阶段课程
              </h2>
              <div class="course-grid">
                <article class="course-card open-course" style="border: 1px solid rgba(107, 91, 149, 0.15);">
                  <div class="course-head">
                    <div class="course-icon" style="background:rgba(107, 91, 149, 0.06);color:var(--purple);">课</div>
                    <span class="course-meta" style="color:var(--purple);background:rgba(107, 91, 149, 0.06);border-color:rgba(107, 91, 149, 0.15);">✅ 已开通</span>
                  </div>
                  <h3>小学语文</h3>
                  <ul class="chapter-list">
                    <li>第一章 拼音基础</li>
                    <li>第二章 汉字书写</li>
                    <li>第三章 基础阅读</li>
                    <li>第四章 看图写话</li>
                  </ul>
                  <div class="unlock-overlay" style="border-top:none; margin-top:16px;">
                    <a href="/course" class="secondary-btn" style="width:100%;text-align:center;text-decoration:none;background:var(--purple);color:#fff;border:none;">进入学习</a>
                  </div>
                </article>
                <article class="course-card open-course" style="border: 1px solid rgba(26, 43, 60, 0.15);">
                  <div class="course-head">
                    <div class="course-icon" style="background:rgba(26, 43, 60, 0.06);color:var(--primary);">课</div>
                    <span class="course-meta" style="color:var(--primary);background:rgba(26, 43, 60, 0.06);border-color:rgba(26, 43, 60, 0.15);">✅ 已开通</span>
                  </div>
                  <h3>小学数学</h3>
                  <ul class="chapter-list">
                    <li>第一章 数的认识</li>
                    <li>第二章 四则运算</li>
                    <li>第三章 几何初步</li>
                    <li>第四章 基础应用</li>
                  </ul>
                  <div class="unlock-overlay" style="border-top:none; margin-top:16px;">
                    <a href="/course" class="secondary-btn" style="width:100%;text-align:center;text-decoration:none;background:var(--primary);color:#fff;border:none;">进入学习</a>
                  </div>
                </article>
                <article class="course-card open-course" style="border: 1px solid rgba(74, 124, 89, 0.15);">
                  <div class="course-head">
                    <div class="course-icon" style="background:rgba(74, 124, 89, 0.06);color:var(--emerald);">课</div>
                    <span class="course-meta" style="color:var(--emerald);background:rgba(74, 124, 89, 0.06);border-color:rgba(74, 124, 89, 0.15);">✅ 已开通</span>
                  </div>
                  <h3>小学英语</h3>
                  <ul class="chapter-list">
                    <li>第一章 字母发音</li>
                    <li>第二章 基础词汇</li>
                    <li>第三章 简单句型</li>
                    <li>第四章 日常交际</li>
                  </ul>
                  <div class="unlock-overlay" style="border-top:none; margin-top:16px;">
                    <a href="/course" class="secondary-btn" style="width:100%;text-align:center;text-decoration:none;background:var(--emerald);color:#fff;border:none;">进入学习</a>
                  </div>
                </article>
              </div>
            </div>
            <!-- 初中课程 -->
            <div class="card" style="margin-bottom: 24px;">
              <h2 class="section-title" style="font-size:20px;margin-bottom:18px;display:flex;align-items:center;gap:10px;">
                <span class="mini-chip" style="background:#e0e7ff;color:var(--primary);border-color:#c7d2fe;">初中</span> 初中阶段课程
              </h2>
              <div class="course-grid">
                <article class="course-card open-course" style="border: 1px solid rgba(107, 91, 149, 0.15);">
                  <div class="course-head">
                    <div class="course-icon" style="background:rgba(107, 91, 149, 0.06);color:var(--purple);">课</div>
                    <span class="course-meta" style="color:var(--purple);background:rgba(107, 91, 149, 0.06);border-color:rgba(107, 91, 149, 0.15);">✅ 已开通</span>
                  </div>
                  <h3>初中语文</h3>
                  <ul class="chapter-list">
                    <li>第一章 现代文阅读</li>
                    <li>第二章 文言文基础</li>
                    <li>第三章 诗词鉴赏</li>
                    <li>第四章 命题作文</li>
                  </ul>
                  <div class="unlock-overlay" style="border-top:none; margin-top:16px;">
                    <a href="/course" class="secondary-btn" style="width:100%;text-align:center;text-decoration:none;background:var(--purple);color:#fff;border:none;">进入学习</a>
                  </div>
                </article>
                <article class="course-card open-course" style="border: 1px solid rgba(26, 43, 60, 0.15);">
                  <div class="course-head">
                    <div class="course-icon" style="background:rgba(26, 43, 60, 0.06);color:var(--primary);">课</div>
                    <span class="course-meta" style="color:var(--primary);background:rgba(26, 43, 60, 0.06);border-color:rgba(26, 43, 60, 0.15);">✅ 已开通</span>
                  </div>
                  <h3>初中数学</h3>
                  <ul class="chapter-list">
                    <li>第一章 一元二次方程</li>
                    <li>第二章 几何证明</li>
                    <li>第三章 函数基础</li>
                    <li>第四章 概率初步</li>
                  </ul>
                  <div class="unlock-overlay" style="border-top:none; margin-top:16px;">
                    <a href="/course" class="secondary-btn" style="width:100%;text-align:center;text-decoration:none;background:var(--primary);color:#fff;border:none;">进入学习</a>
                  </div>
                </article>
                <article class="course-card open-course" style="border: 1px solid rgba(74, 124, 89, 0.15);">
                  <div class="course-head">
                    <div class="course-icon" style="background:rgba(74, 124, 89, 0.06);color:var(--emerald);">课</div>
                    <span class="course-meta" style="color:var(--emerald);background:rgba(74, 124, 89, 0.06);border-color:rgba(74, 124, 89, 0.15);">✅ 已开通</span>
                  </div>
                  <h3>初中英语</h3>
                  <ul class="chapter-list">
                    <li>第一章 核心语法</li>
                    <li>第二章 完形填空</li>
                    <li>第三章 阅读理解</li>
                    <li>第四章 英语写作</li>
                  </ul>
                  <div class="unlock-overlay" style="border-top:none; margin-top:16px;">
                    <a href="/course" class="secondary-btn" style="width:100%;text-align:center;text-decoration:none;background:var(--emerald);color:#fff;border:none;">进入学习</a>
                  </div>
                </article>
              </div>
            </div>
          </section>'''

course_body = '''          <div style="padding: 0 32px; max-width: 1440px; margin: 24px auto 0;">
            <div style="background: linear-gradient(135deg, rgba(79, 70, 229, 0.04), rgba(124, 58, 237, 0.04)); padding: 16px 24px; border-radius: 16px; display: flex; align-items: center; gap: 16px; margin-top: 16px; border: 1px solid rgba(79, 70, 229, 0.15);">
              <div style="font-size: 28px; background: #fff; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">🎓</div>
              <div>
                <p style="font-weight: 800; font-size: 16px; color: var(--primary); margin: 0; letter-spacing: 0.5px;">联合清华等顶尖名师团队倾力打造</p>
                <p style="font-size: 13px; color: var(--muted); margin: 4px 0 0 0;">深度拆解核心考点，重塑底层逻辑，构建国际化标准的高效学习链路。</p>
              </div>
            </div>
          </div>
          <section class="page active" id="course-page">
            <div class="growth-header" style="margin-bottom: 24px;">
              <div>
                <a href="/subjects" style="display:inline-flex; align-items:center; gap:8px; margin-bottom:16px; color:var(--text); text-decoration:none; font-size:15px; font-weight:700; transition: all 0.3s ease; padding: 8px 16px; background: #fff; border-radius: 999px; box-shadow: 0 2px 8px rgba(26,43,60,0.06); border: 1px solid rgba(26,43,60,0.08);" onmouseover="this.style.color='var(--primary)'; this.style.transform='translateX(-4px)';" onmouseout="this.style.color='var(--text)'; this.style.transform='translateX(0)';">
                  <span style="font-size: 18px;">&larr;</span> 返回全学科目录
                </a>
                <h1 class="section-title" style="font-size:34px;">初中数学 <span style="font-size:16px;color:var(--muted);font-weight:400;margin-left:8px;">八年级上</span></h1>
                <p class="muted" style="margin-top:8px;">知识有前置和进阶，学完了前置的技能才可以学后面的分支。</p>
              </div>
            </div>
            <div class="card" style="margin-bottom: 24px; padding: 20px 24px;">
              <div class="row-between" style="margin-bottom: 16px;">
                <h3 style="font-size: 16px; font-weight: 800;">勋章等级标识</h3>
                <div style="display:flex; gap:12px;">
                  <button class="secondary-btn" style="padding: 8px 16px; font-size: 13px; border-radius: 999px;">本书学习计划</button>
                  <button class="primary-btn" style="padding: 8px 16px; font-size: 13px; border-radius: 999px;">查看图谱</button>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; text-align:center;">
                <div><div style="font-size:32px; filter:grayscale(1); opacity:0.5;">🛡️</div><div style="font-size:12px; font-weight:700; color:var(--muted); margin-top:4px;">未学 12</div></div>
                <div><div style="font-size:32px; color:#38bdf8;">🔰</div><div style="font-size:12px; font-weight:700; color:var(--muted); margin-top:4px;">入门 1</div></div>
                <div><div style="font-size:32px; color:#4ade80;">🍀</div><div style="font-size:12px; font-weight:700; color:var(--muted); margin-top:4px;">及格 0</div></div>
                <div><div style="font-size:32px; color:#22c55e;">🌿</div><div style="font-size:12px; font-weight:700; color:var(--muted); margin-top:4px;">掌握 0</div></div>
                <div><div style="font-size:32px; color:var(--accent);">⭐</div><div style="font-size:12px; font-weight:700; color:var(--orange); margin-top:4px;">熟练 28</div></div>
                <div><div style="font-size:32px; color:#8b5cf6;">💠</div><div style="font-size:12px; font-weight:700; color:#8b5cf6; margin-top:4px;">精通 26</div></div>
                <div><div style="font-size:32px; color:var(--text);">💎</div><div style="font-size:12px; font-weight:700; color:var(--text); margin-top:4px;">优秀 0</div></div>
              </div>
            </div>
            <div class="grid" style="grid-template-columns: 260px 1fr; gap: 24px; align-items: start;">
              <div class="card" style="padding: 16px;">
                <div class="row-between" style="margin-bottom: 16px; padding: 0 8px;">
                  <span style="font-size:14px; font-weight:800;">选择章节</span>
                  <span style="font-size:12px; color:var(--primary); cursor:pointer;">展开</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <div style="font-size:14px; font-weight:700; padding:8px; cursor:pointer; color:var(--text);">▾ 第一章 一元二次方程</div>
                  <div style="font-size:13px; font-weight:500; padding:8px 8px 8px 24px; cursor:pointer; color:var(--primary); background:rgba(79,70,229,.1); border-radius:8px;">1.1 认识一元二次方程</div>
                  <div style="font-size:13px; font-weight:500; padding:8px 8px 8px 24px; cursor:pointer; color:var(--muted);">1.2 配方法</div>
                  <div style="font-size:13px; font-weight:500; padding:8px 8px 8px 24px; cursor:pointer; color:var(--muted);">1.3 公式法</div>
                  <div style="font-size:14px; font-weight:700; padding:8px; cursor:pointer; color:var(--text); margin-top:8px;">▾ 第二章 二次函数</div>
                  <div style="font-size:13px; font-weight:500; padding:8px 8px 8px 24px; cursor:pointer; color:var(--muted);">2.1 二次函数的图像</div>
                  <div style="font-size:13px; font-weight:500; padding:8px 8px 8px 24px; cursor:pointer; color:var(--muted);">2.2 二次函数的性质</div>
                </div>
              </div>
              <div class="card" style="padding: 0;">
                <div style="display:flex; flex-direction:column;">
                  <div style="display:flex; align-items:center; justify-content:space-between; padding: 20px 24px; border-bottom: 1px solid var(--line);">
                    <div style="display:flex; align-items:center; gap: 16px;">
                      <div style="font-size:32px; color:var(--accent);">⭐</div>
                      <div>
                        <h3 style="font-size:16px; margin-bottom:6px;">生活中的一元二次方程现象</h3>
                        <div style="color:var(--accent); font-size:12px;">★ ★ ★ ☆ ☆</div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap: 24px;">
                      <div style="text-align:right;">
                        <div style="font-size:12px; color:var(--muted); margin-bottom:4px;">正确率: 8/12 = 67%</div>
                        <div style="width:120px; height:4px; background:#e2e8f0; border-radius:2px;"><div style="width:67%; height:100%; background:#f97316; border-radius:2px;"></div></div>
                      </div>
                      <div style="display:flex; gap:8px;">
                        <button class="ghost-btn" style="padding:6px 12px; font-size:13px; color:var(--text); background:rgba(239,68,68,.1); border:none;">查看错题</button>
                        <button class="secondary-btn" style="padding:6px 12px; font-size:13px;">进入学习</button>
                      </div>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; justify-content:space-between; padding: 20px 24px; border-bottom: 1px solid var(--line);">
                    <div style="display:flex; align-items:center; gap: 16px;">
                      <div style="font-size:32px; color:#8b5cf6;">💠</div>
                      <div>
                        <h3 style="font-size:16px; margin-bottom:6px;">一元二次方程的一般形式</h3>
                        <div style="color:#8b5cf6; font-size:12px;">★ ★ ★ ★ ☆</div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap: 24px;">
                      <div style="text-align:right;">
                        <div style="font-size:12px; color:var(--muted); margin-bottom:4px;">正确率: 18/20 = 90%</div>
                        <div style="width:120px; height:4px; background:#e2e8f0; border-radius:2px;"><div style="width:90%; height:100%; background:#8b5cf6; border-radius:2px;"></div></div>
                      </div>
                      <div style="display:flex; gap:8px;">
                        <button class="ghost-btn" style="padding:6px 12px; font-size:13px; color:var(--text); background:rgba(239,68,68,.1); border:none;">查看错题</button>
                        <button class="secondary-btn" style="padding:6px 12px; font-size:13px;">进入学习</button>
                      </div>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; justify-content:space-between; padding: 20px 24px; border-bottom: 1px solid var(--line); background: rgba(79,70,229,.05);">
                    <div style="display:flex; align-items:center; gap: 16px;">
                      <div style="font-size:32px; filter:grayscale(1); opacity:0.5;">🛡️</div>
                      <div>
                        <h3 style="font-size:16px; margin-bottom:6px; color:var(--primary);">一元二次方程的根 (当前目标)</h3>
                        <div style="color:var(--muted); font-size:12px;">☆ ☆ ☆ ☆ ☆</div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap: 24px;">
                      <div style="text-align:right;">
                        <div style="font-size:12px; color:var(--muted); margin-bottom:4px;">正确率: 0/0 = 0%</div>
                        <div style="width:120px; height:4px; background:#e2e8f0; border-radius:2px;"><div style="width:0%; height:100%; background:#e2e8f0; border-radius:2px;"></div></div>
                      </div>
                      <div style="display:flex; gap:8px;">
                        <button class="primary-btn" style="padding:6px 20px; font-size:13px;">进入学习</button>
                      </div>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; justify-content:space-between; padding: 20px 24px; border-bottom: 1px solid var(--line); opacity: 0.6;">
                    <div style="display:flex; align-items:center; gap: 16px;">
                      <div style="font-size:32px; filter:grayscale(1); opacity:0.5;">🔒</div>
                      <div>
                        <h3 style="font-size:16px; margin-bottom:6px; color:var(--muted);">因式分解法</h3>
                        <div style="color:var(--muted); font-size:12px;">前置条件未满足</div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap: 24px;">
                      <button class="ghost-btn" style="padding:6px 20px; font-size:13px;" disabled>锁定</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>'''

login_html = f'''<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>登录 - 星途启航 AI 自习室</title>
    {css_content}
  </head>
  <body class="login-page">
    <div class="ambient">
      <div class="blob one"></div>
      <div class="blob two"></div>
      <div class="blob three"></div>
    </div>
    <div style="position: absolute; top: 32px; left: 40px; display: flex; align-items: center; gap: 12px; z-index: 10;">
      <div style="position: relative; display: inline-block; font-family: 'Playfair Display', serif; font-weight: 700; color: var(--primary); letter-spacing: -0.5px;">
        <span style="position: absolute; top: -14px; left: -6px; font-size: 14px; color: var(--accent); line-height: 1;">星途</span>
        <span style="font-size: 32px; line-height: 1;">启航教育</span>
      </div>
    </div>
    <main class="login-stage">
        <section class="login-showcase">
          <div class="login-brand-area" style="max-width:480px;text-align:left;">
            <div class="sparkle-icon" style="font-size:48px; margin-bottom:28px; animation: float 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; display: inline-block;">✨</div>
            <h1 class="login-headline slide-up-1" style="font-family: 'Playfair Display', serif; font-size:48px; line-height:1.2; margin-bottom:24px; font-weight:800; color: var(--primary); letter-spacing:-0.5px;">
              点亮你的星途<span style="color: var(--accent);">.</span>
            </h1>
            <p class="login-copy slide-up-2" style="font-size:18px; line-height:1.8; color:var(--muted); font-weight:400; margin-bottom:48px;">
              每一次解题，都是对未知的跨越。<br>
              在这里，AI 与你并肩，将复杂的知识化作清晰的轨迹。<br><br>
              <span style="color:var(--primary); font-weight:600; letter-spacing:1px;">保持专注，保持好奇。</span>
            </p>
            <div class="premium-tsinghua-card slide-up-3" style="background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 32px 36px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.9); position: relative; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.04); transition: all 0.5s ease; cursor: default;" onmouseover="this.style.transform='translateY(-6px)'; this.style.boxShadow='0 30px 60px rgba(0, 0, 0, 0.08)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 20px 40px rgba(0, 0, 0, 0.04)';">
              <div style="position: absolute; right: -5%; top: -15%; font-size: 180px; opacity: 0.03; color: var(--primary); pointer-events: none;">🏛️</div>
              <div style="display: flex; align-items: flex-start; gap: 20px; position: relative; z-index: 1;">
                <div style="background: linear-gradient(135deg, rgba(197, 160, 89, 0.1), rgba(197, 160, 89, 0.02)); padding: 14px; border-radius: 18px; border: 1px solid rgba(197, 160, 89, 0.2); flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(197, 160, 89, 0.08);">
                  <span style="font-size: 28px; display: block; line-height: 1;">🎓</span>
                </div>
                <div>
                  <div style="font-size: 12px; color: var(--accent); font-weight: 800; letter-spacing: 2px; margin-bottom: 8px; text-transform: uppercase;">Academic Excellence</div>
                  <h2 style="font-size: 19px; color: var(--primary); font-weight: 800; margin: 0 0 10px 0; letter-spacing: 0.5px; line-height: 1.4;">
                    <span style="color: var(--accent); font-size: 21px;">联合清华</span>等顶尖名师团队倾力打造
                  </h2>
                  <p style="font-size: 14px; color: var(--muted); margin: 0; line-height: 1.7; font-weight: 500;">
                    深度拆解核心考点，重塑底层逻辑，构建国际化标准的高效学习链路。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      <section class="login-container">
        <div class="login-card-header">
          <h2 class="login-card-title">学生登录</h2>
          <p class="login-card-subtitle">登录后继续你的个人学习空间</p>
        </div>
        <form action="/api/login" method="POST" id="login-form">
          <script>
            const params = new URLSearchParams(window.location.search);
            if (params.get('error') === '1') {{
              document.write('<div class="slide-up-1" style="color: var(--accent); font-size: 14px; margin-bottom: 16px; background: rgba(197, 160, 89, 0.1); padding: 12px; border-radius: 8px;">账号或密码不匹配，请联系老师。<br>(测试账号: Cary / 123456)</div>');
            }}
          </script>
          <div class="form-group slide-up-3">
            <label class="form-label">学生账号</label>
            <input type="text" name="username" class="form-input" placeholder="请输入学校/机构分配的账号" required />
          </div>
          <div class="form-group slide-up-4">
            <label class="form-label">密码</label>
            <input type="password" name="password" class="form-input" placeholder="请输入密码" required />
          </div>
          <div class="slide-up-5">
            <button type="submit" class="submit-btn">登录系统</button>
          </div>
        </form>
        <div class="notice">
          <p><strong>提示</strong><br />系统账号由学校或培训机构统一分配，不支持学生自行注册。<br />如需获取账号或密码遗失，请联系您的带班老师。</p>
        </div>
      </section>
    </main>
  </body>
</html>'''

files = {
    'dashboard.html': get_base_html('dashboard', dashboard_body),
    'mistakes.html': get_base_html('mistakes', mistakes_body),
    'growth.html': get_base_html('growth', growth_body),
    'subjects.html': get_base_html('subjects', subjects_body),
    'course.html': get_base_html('course', course_body),
    'login.html': login_html
}

for filename, content in files.items():
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Generated {filename}")
