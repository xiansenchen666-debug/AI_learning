import os
import re

base_dir = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning'
files = ['dashboard.html', 'subjects.html', 'course.html', 'mistakes.html', 'growth.html', 'login.html']

for file in files:
    path = os.path.join(base_dir, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove the large '星' icon div
    content = re.sub(r'<div class="brand-mark"[^>]*>星</div>\s*', '', content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")