import os
import re

base_dir = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning'
files = ['dashboard.html', 'subjects.html', 'course.html', 'mistakes.html', 'growth.html', 'login.html']

# The old logo structure to find
regex_pattern = r'<div style="position: relative; display: inline-block; font-family: \'Playfair Display\', serif; font-weight: 700; color: var\(--primary\); letter-spacing: -0\.5px;">\s*<span style="position: absolute; top: -10px; left: -4px; font-size: 10px; color: var\(--accent\); line-height: 1;">星途</span>\s*<span style="font-size: 24px; line-height: 1;">启航教育</span>\s*</div>'

# The new larger logo structure
# Increased sizes: '星途' from 10px to 14px, '启航教育' from 24px to 32px
# Adjusted position: top from -10px to -14px, left from -4px to -6px to keep it proportionally in the top left
larger_logo = '''<div style="position: relative; display: inline-block; font-family: 'Playfair Display', serif; font-weight: 700; color: var(--primary); letter-spacing: -0.5px;">
  <span style="position: absolute; top: -14px; left: -6px; font-size: 14px; color: var(--accent); line-height: 1;">星途</span>
  <span style="font-size: 32px; line-height: 1;">启航教育</span>
</div>'''

for file in files:
    path = os.path.join(base_dir, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = re.sub(regex_pattern, larger_logo, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")