import os

css_path = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning\assets\style.css'
with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace root variables
new_root = ''':root {
  --bg: #FDFBF7;
  --panel: rgba(255, 255, 255, 0.65);
  --line: rgba(26, 43, 60, 0.08);
  --text: #1A2B3C;
  --muted: #6B7C93;
  /* xtqihang inspired palette */
  --primary: #1A2B3C;
  --primary-hover: #C5A059;
  --accent: #C5A059;
  --blue: #2A4365;
  --emerald: #4A7C59;
  --orange: #C5A059;
  --cyan: #5D8AA8;
  --purple: #6B5B95;
  --hairline: rgba(26, 43, 60, 0.08);
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
}'''

import re
content = re.sub(r':root\s*\{[^}]+\}', new_root, content, count=1)

# Modify background ambient blobs to match the new color scheme (soft gold and navy)
content = content.replace('background: radial-gradient(circle at 50% 50%, rgba(99,102,241,0.2), transparent 60%);', 'background: radial-gradient(circle at 50% 50%, rgba(197, 160, 89, 0.15), transparent 60%);')
content = content.replace('background: radial-gradient(circle at 50% 50%, rgba(168,85,247,0.2), transparent 60%);', 'background: radial-gradient(circle at 50% 50%, rgba(26, 43, 60, 0.1), transparent 60%);')
content = content.replace('background: radial-gradient(circle at 50% 50%, rgba(236,72,153,0.15), transparent 60%);', 'background: radial-gradient(circle at 50% 50%, rgba(197, 160, 89, 0.1), transparent 60%);')

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)

# Modify update_subjects.py to use the new muted colors for subject backgrounds
py_path = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning\update_subjects.py'
with open(py_path, 'r', encoding='utf-8') as f:
    py_content = f.read()

py_content = py_content.replace('rgba(79, 70, 229, 0.08)', 'rgba(26, 43, 60, 0.06)')
py_content = py_content.replace('rgba(79, 70, 229, 0.2)', 'rgba(26, 43, 60, 0.15)')

py_content = py_content.replace('rgba(5, 150, 105, 0.08)', 'rgba(74, 124, 89, 0.06)')
py_content = py_content.replace('rgba(5, 150, 105, 0.2)', 'rgba(74, 124, 89, 0.15)')

py_content = py_content.replace('rgba(217, 119, 6, 0.08)', 'rgba(197, 160, 89, 0.06)')
py_content = py_content.replace('rgba(217, 119, 6, 0.2)', 'rgba(197, 160, 89, 0.15)')

py_content = py_content.replace('rgba(124, 58, 237, 0.08)', 'rgba(107, 91, 149, 0.06)')
py_content = py_content.replace('rgba(124, 58, 237, 0.2)', 'rgba(107, 91, 149, 0.15)')

with open(py_path, 'w', encoding='utf-8') as f:
    f.write(py_content)

print("Done")