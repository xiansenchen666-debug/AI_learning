import os

base_dir = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning'
files = ['dashboard.html', 'subjects.html', 'course.html', 'mistakes.html', 'growth.html']

new_brand_html = '''<div class="brand-title" style="display: flex; align-items: flex-start; line-height: 1;">
              <span style="font-size: 10px; font-weight: 600; margin-top: 2px; margin-right: 2px; letter-spacing: 0; opacity: 0.8;">星途</span>
              <span style="font-size: 18px; font-weight: 800;">启航教育</span>
            </div>'''

for file in files:
    path = os.path.join(base_dir, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('<p class="brand-title">星途启航教育</p>', new_brand_html)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

login_path = os.path.join(base_dir, 'login.html')
with open(login_path, 'r', encoding='utf-8') as f:
    login_content = f.read()

login_logo_old = '<div style="font-weight: 800; font-size: 18px; color: var(--text); letter-spacing: 1px;">星途启航教育</div>'
login_logo_new = '''<div style="font-weight: 800; color: var(--text); letter-spacing: 1px; display: flex; align-items: flex-start; line-height: 1;">
        <span style="font-size: 10px; margin-top: 2px; margin-right: 2px; letter-spacing: 0; opacity: 0.8;">星途</span>
        <span style="font-size: 18px;">启航教育</span>
      </div>'''
login_content = login_content.replace(login_logo_old, login_logo_new)

with open(login_path, 'w', encoding='utf-8') as f:
    f.write(login_content)

print("Done")