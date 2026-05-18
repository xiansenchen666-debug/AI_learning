import os

base_dir = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning'
files = ['dashboard.html', 'subjects.html', 'course.html', 'mistakes.html', 'growth.html']

# The old ugly logo we injected
old_brand_html = '''<div class="brand-title" style="display: flex; align-items: flex-start; line-height: 1;">
              <span style="font-size: 10px; font-weight: 600; margin-top: 2px; margin-right: 2px; letter-spacing: 0; opacity: 0.8;">星途</span>
              <span style="font-size: 18px; font-weight: 800;">启航教育</span>
            </div>'''

# The new elegant logo structure
new_brand_html = '''<div style="display: flex; flex-direction: column; justify-content: center;">
            <div style="display: flex; align-items: baseline; gap: 2px;">
              <span style="font-size: 12px; font-weight: 700; color: var(--primary); letter-spacing: 1px;">星途</span>
              <span style="font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: 0.5px; line-height: 1;">启航教育</span>
            </div>
          </div>'''

for file in files:
    path = os.path.join(base_dir, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace(old_brand_html, new_brand_html)
    
    # Also remove the 'AI 自习室' subtitle if it exists to make it cleaner
    content = content.replace('<p class="brand-subtitle">AI 自习室</p>', '')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# Update Login page
login_path = os.path.join(base_dir, 'login.html')
with open(login_path, 'r', encoding='utf-8') as f:
    login_content = f.read()

old_login_logo = '''<div style="font-weight: 800; color: var(--text); letter-spacing: 1px; display: flex; align-items: flex-start; line-height: 1;">
        <span style="font-size: 10px; margin-top: 2px; margin-right: 2px; letter-spacing: 0; opacity: 0.8;">星途</span>
        <span style="font-size: 18px;">启航教育</span>
      </div>'''

new_login_logo = '''<div style="display: flex; align-items: baseline; gap: 2px;">
        <span style="font-size: 13px; font-weight: 700; color: var(--primary); letter-spacing: 1px;">星途</span>
        <span style="font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: 0.5px; line-height: 1;">启航教育</span>
      </div>'''

login_content = login_content.replace(old_login_logo, new_login_logo)

with open(login_path, 'w', encoding='utf-8') as f:
    f.write(login_content)

print("Done")