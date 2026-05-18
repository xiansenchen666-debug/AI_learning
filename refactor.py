import os
import re

base_dir = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning'
files = ['dashboard.html', 'subjects.html', 'course.html', 'mistakes.html', 'growth.html']

# 1. Tsinghua Badge
tsinghua_badge = '''
            <div style="background: linear-gradient(135deg, rgba(79, 70, 229, 0.04), rgba(124, 58, 237, 0.04)); padding: 16px 24px; border-radius: 16px; display: flex; align-items: center; gap: 16px; margin-top: 16px; border: 1px solid rgba(79, 70, 229, 0.15);">
              <div style="font-size: 28px; background: #fff; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">🎓</div>
              <div>
                <p style="font-weight: 800; font-size: 16px; color: var(--primary); margin: 0; letter-spacing: 0.5px;">联合清华等顶尖名师团队倾力打造</p>
                <p style="font-size: 13px; color: var(--muted); margin: 4px 0 0 0;">深度拆解核心考点，重塑底层逻辑，构建国际化标准的高效学习链路。</p>
              </div>
            </div>
'''

for file in files:
    path = os.path.join(base_dir, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Logo Update
    content = content.replace('<p class="brand-title">星途启航</p>', '<p class="brand-title">星途启航教育</p>')

    # Remove reds from UI
    content = content.replace('var(--red)', 'var(--orange)')
    content = content.replace('rgba(197, 48, 48, 0.2)', 'rgba(217, 119, 6, 0.2)')
    content = content.replace('rgba(197, 48, 48, 0.05)', 'rgba(217, 119, 6, 0.05)')
    content = content.replace('rgba(197, 48, 48, 0.1)', 'rgba(124, 58, 237, 0.1)') # Purple for mistake box
    
    # Fix logout icon color
    content = content.replace('color:#ef4444;', 'color:var(--text);')
    content = content.replace('color: #ef4444;', 'color: var(--text);')

    if file == 'subjects.html':
        content = re.sub(
            r'(<p class="muted" style="margin-top:8px;">涵盖小学、初中、高中各科同步课程，已为您全部开放。</p>)',
            r'\1\n' + tsinghua_badge,
            content
        )
        
    if file == 'course.html':
        # Add badge near the top of course.html
        content = content.replace('<div class="page-scroll">', f'<div class="page-scroll">\n          <div style="padding: 0 32px; max-width: 1440px; margin: 24px auto 0;">{tsinghua_badge}</div>')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# 2. Fix update_subjects.py (change Chinese color from red to purple)
update_script_path = os.path.join(base_dir, 'update_subjects.py')
with open(update_script_path, 'r', encoding='utf-8') as f:
    script_content = f.read()

script_content = script_content.replace('var(--red)', 'var(--purple)')
script_content = script_content.replace('rgba(197, 48, 48, 0.08)', 'rgba(124, 58, 237, 0.08)')
script_content = script_content.replace('rgba(197, 48, 48, 0.2)', 'rgba(124, 58, 237, 0.2)')

with open(update_script_path, 'w', encoding='utf-8') as f:
    f.write(script_content)

# 3. Remove --red from style.css
css_path = os.path.join(base_dir, 'assets', 'style.css')
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()
css_content = css_content.replace('--red: #C53030;     /* Muted Red instead of hot pink/red */', '--cyan: #0891B2;    /* Replaced Red with Cyan */')
with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css_content)

# 4. Add Logo to login.html top left & Error message logic
login_path = os.path.join(base_dir, 'login.html')
with open(login_path, 'r', encoding='utf-8') as f:
    login_content = f.read()

logo_html = '''
    <div style="position: absolute; top: 32px; left: 40px; display: flex; align-items: center; gap: 12px; z-index: 10;">
      <div class="brand-mark" style="width: 32px; height: 32px; font-size: 16px;">星</div>
      <div style="font-weight: 800; font-size: 18px; color: var(--text); letter-spacing: 1px;">星途启航教育</div>
    </div>
'''
if '星途启航教育' not in login_content:
    login_content = login_content.replace('<main class="login-stage">', f'{logo_html}\n    <main class="login-stage">')

error_js = '''
        <form action="/api/login" method="POST" id="login-form">
          <script>
            const params = new URLSearchParams(window.location.search);
            if (params.get('error') === '1') {
              document.write('<div style="color: var(--orange); font-size: 14px; margin-bottom: 16px; background: rgba(217, 119, 6, 0.1); padding: 12px; border-radius: 8px;">账号或密码不匹配，请联系老师。<br>(测试账号: Cary / 123456)</div>');
            }
          </script>
'''
login_content = login_content.replace('<form action="/api/login" method="POST" id="login-form">', error_js)

with open(login_path, 'w', encoding='utf-8') as f:
    f.write(login_content)

print("Done")
