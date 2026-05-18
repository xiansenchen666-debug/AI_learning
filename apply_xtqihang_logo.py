import os
import re

base_dir = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning'
files = ['dashboard.html', 'subjects.html', 'course.html', 'mistakes.html', 'growth.html', 'login.html']

# The xtqihang logo markup
xtqihang_logo = '''<div style="position: relative; display: inline-block; font-family: 'Playfair Display', serif; font-weight: 700; color: var(--primary); letter-spacing: -0.5px;">
  <span style="position: absolute; top: -10px; left: -4px; font-size: 10px; color: var(--accent); line-height: 1;">星途</span>
  <span style="font-size: 24px; line-height: 1;">启航教育</span>
</div>'''

# We need to find the current logo blocks and replace them.
# The current logo block looks like this (with slight variations across files):
# <div style="display: flex; align-items: baseline; gap: 2px;">
#   <span style="font-size: 12px; font-weight: 700; color: var(--primary); letter-spacing: 1px;">星途</span>
#   <span style="font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: 0.5px; line-height: 1;">启航教育</span>
# </div>

regex_pattern = r'<div style="display: flex; align-items: baseline; gap: 2px;">\s*<span style="font-size: 1[23]px; font-weight: 700; color: var\(--primary\); letter-spacing: 1px;">星途</span>\s*<span style="font-size: 2[02]px; font-weight: 800; color: var\(--text\); letter-spacing: 0\.5px; line-height: 1;">启航教育</span>\s*</div>'

for file in files:
    path = os.path.join(base_dir, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = re.sub(regex_pattern, xtqihang_logo, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")