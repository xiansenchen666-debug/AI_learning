import os
import re

gold_logo = '''<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 24px; height: 24px;">
              <defs>
                <linearGradient id="gold-grad-student" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#D4AF37"/>
                  <stop offset="50%" stop-color="#FFDF73"/>
                  <stop offset="100%" stop-color="#AA7C11"/>
                </linearGradient>
              </defs>
              <path d="M2.5 19.5C2.5 19.5 8 21.5 12 21.5C16 21.5 21.5 19.5 21.5 19.5C21.5 19.5 17 18 12 18C7 18 2.5 19.5 2.5 19.5Z" fill="url(#gold-grad-student)"/>
              <path d="M11.5 2.5C11.5 2.5 6 9 6 16.5C8 17.5 11.5 18 11.5 18V2.5Z" fill="url(#gold-grad-student)"/>
              <path d="M12.5 4.5C12.5 4.5 17 10 18 16.5C15 17.5 12.5 18 12.5 18V4.5Z" fill="url(#gold-grad-student)" opacity="0.8"/>
            </svg>'''

brand_title_new = '<span class="brand-title" style="font-size: 1.25rem; font-weight: 600; color: #1e293b; margin-left: 8px;">启航教育</span>'

for f in ['subjects.html', 'course.html', 'grade.html', 'growth.html', 'mistakes.html', 'question-bank.html']:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Replace SVG
    content = re.sub(r'<svg viewBox="0 0 44 44"(?: role="img")?>[\s\S]*?<\/svg>', gold_logo, content)
    # Replace brand title
    content = re.sub(r'<span class="brand-title">启航教育<\/span>', brand_title_new, content)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print('Done')