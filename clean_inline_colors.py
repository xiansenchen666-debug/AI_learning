import os
import re

base_dir = r'd:\英语培训Jayu_Eric\yabao\学习机系统\AI_learning'
files = ['dashboard.html', 'subjects.html', 'course.html', 'mistakes.html', 'growth.html', 'login.html']

replacements = [
    # Orange / Gold replacements
    (r'#d97706', 'var(--accent)'),
    (r'#f59e0b', 'var(--accent)'),
    (r'#fef3c7', 'rgba(197, 160, 89, 0.2)'),
    (r'rgba\(217,\s*119,\s*6,\s*0\.2\)', 'rgba(197, 160, 89, 0.2)'),
    (r'rgba\(217,\s*119,\s*6,\s*0\.05\)', 'rgba(197, 160, 89, 0.05)'),
    
    # Emerald / Green replacements
    (r'#10b981', 'var(--emerald)'),
    (r'rgba\(209,\s*250,\s*229,\s*\.9\)', 'rgba(74, 124, 89, 0.15)'),
    (r'rgba\(5,\s*150,\s*105,\s*0\.1\)', 'rgba(74, 124, 89, 0.1)'),
    
    # Purple replacements
    (r'rgba\(124,\s*58,\s*237,\s*0\.1\)', 'rgba(107, 91, 149, 0.15)'),
    
    # Blue / Indigo replacements
    (r'rgba\(238,\s*242,\s*255,\s*\.9\)', 'rgba(26, 43, 60, 0.08)'),
    (r'#3b82f6', 'var(--primary)'),
    (r'#4F46E5', 'var(--primary)'),
    
    # Red/Rose (if any left)
    (r'#e11d48', 'var(--purple)'),
    (r'rgba\(225,\s*29,\s*72,\s*0\.1\)', 'rgba(107, 91, 149, 0.1)'),
    (r'#f43f5e', 'var(--purple)')
]

for file in files:
    path = os.path.join(base_dir, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        content = re.sub(old, new, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")