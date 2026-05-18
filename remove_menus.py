import os
import re

base_dir = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning'
files = ['dashboard.html', 'subjects.html', 'course.html', 'mistakes.html', 'growth.html']

for file in files:
    path = os.path.join(base_dir, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Remove "系统设置" from sidebar
    content = re.sub(r'<a href="#" class="nav-btn">[^<]*<span[^>]*>⚙️</span>\s*<span class="nav-label">系统设置</span>\s*</a>', '', content)
    
    # 2. Remove "个人信息" and "切换账号" from the avatar dropdown
    content = re.sub(r'<button class="dropdown-item">\s*<span[^>]*>👤</span>\s*个人信息\s*</button>', '', content)
    content = re.sub(r'<button class="dropdown-item">\s*<span[^>]*>🔄</span>\s*切换账号\s*</button>', '', content)
    
    # 3. Remove the top divider in the dropdown since only logout is left
    # The dropdown looks like:
    # <div class="dropdown-divider"></div>
    # <a href="/api/logout"...
    content = re.sub(r'<div class="dropdown-divider"></div>\s*(<a href="/api/logout")', r'\1', content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")