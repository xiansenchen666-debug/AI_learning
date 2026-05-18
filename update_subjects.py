import re

with open('d:\\英语培训Jayu_Eric\\yabao\\学习机系统\\AI_learning\\subjects.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Change the header text
content = content.replace(
    '<p class="muted" style="margin-top:8px;">涵盖小学、初中、高中各科同步课程。灰色为未解锁科目，需要单独开通。</p>',
    '<p class="muted" style="margin-top:8px;">涵盖小学、初中、高中各科同步课程，已为您全部开放。</p>'
)

# Replace the locked course structure with open structure
import json

subjects = {
    '小学语文': ['第一章 拼音基础', '第二章 汉字书写', '第三章 基础阅读', '第四章 看图写话'],
    '小学数学': ['第一章 数的认识', '第二章 四则运算', '第三章 几何初步', '第四章 基础应用'],
    '小学英语': ['第一章 字母发音', '第二章 基础词汇', '第三章 简单句型', '第四章 日常交际'],
    
    '初中语文': ['第一章 现代文阅读', '第二章 文言文基础', '第三章 诗词鉴赏', '第四章 命题作文'],
    '初中数学': ['第一章 一元二次方程', '第二章 几何证明', '第三章 函数基础', '第四章 概率初步'],
    '初中英语': ['第一章 核心语法', '第二章 完形填空', '第三章 阅读理解', '第四章 英语写作'],
    '初中物理': ['第一章 运动与力', '第二章 声光热现象', '第三章 电路基础', '第四章 电磁初步'],
    '初中化学': ['第一章 物质的构成', '第二章 常见元素', '第三章 化学方程式', '第四章 酸碱盐'],
    '初中生物': ['第一章 细胞结构', '第二章 植物生理', '第三章 人体系统', '第四章 遗传基础'],
    
    '高中语文': ['第一章 深度阅读', '第二章 文言文进阶', '第三章 古诗文默写', '第四章 议论文写作'],
    '高中数学': ['第一章 函数与导数', '第二章 圆锥曲线', '第三章 立体几何', '第四章 数列与极限'],
    '高中英语': ['第一章 高级语法', '第二章 长难句解析', '第三章 完形进阶', '第四章 高考写作'],
    '高中物理': ['第一章 牛顿力学进阶', '第二章 电磁学综合', '第三章 热学与光学', '第四章 现代物理'],
    '高中化学': ['第一章 反应原理', '第二章 有机化学', '第三章 结构与性质', '第四章 实验综合'],
    '高中生物': ['第一章 分子与细胞', '第二章 遗传与进化', '第三章 稳态与环境', '第四章 现代生物科技']
}

# The regex will find <article class="course-card ..."> ... </article>
pattern = re.compile(r'<article class="course-card.*?<h3>(.*?)</h3>.*?</article>', re.DOTALL)

def replacer(match):
    full_match = match.group(0)
    title = match.group(1)
    
    # Generate chapter list html
    chapters = subjects.get(title, ['第一章 基础', '第二章 进阶', '第三章 提升', '第四章 综合'])
    chapter_html = '<ul class="chapter-list">\n'
    for cap in chapters:
        chapter_html += f'                    <li>{cap}</li>\n'
    chapter_html += '                  </ul>'
    
    # Identify icon
    icon_match = re.search(r'<div class="course-icon">(.*?)</div>', full_match)
    icon = icon_match.group(1) if icon_match else '课'
    
    # Assign colors based on subject for visual variety
    color = "var(--primary)"
    bg = "#e0e7ff"
    border = "#c7d2fe"
    
    if "数学" in title:
        color = "var(--primary)"
        bg = "#e0e7ff"
        border = "#c7d2fe"
    elif "英语" in title:
        color = "var(--emerald)"
        bg = "#d1fae5"
        border = "#a7f3d0"
    elif "物理" in title:
        color = "var(--orange)"
        bg = "#ffedd5"
        border = "#fed7aa"
    elif "语文" in title:
        color = "#e11d48"
        bg = "#ffe4e6"
        border = "#fbcfe8"
    elif "化学" in title:
        color = "#8b5cf6"
        bg = "#ede9fe"
        border = "#ddd6fe"
    elif "生物" in title:
        color = "#10b981"
        bg = "#d1fae5"
        border = "#a7f3d0"
    
    new_article = f'''<article class="course-card open-course" style="border: 1px solid {border};">
                  <div class="course-head">
                    <div class="course-icon" style="background:{bg};color:{color};">{icon}</div>
                    <span class="course-meta" style="color:{color};background:{bg};border-color:{border};">✅ 已开通</span>
                  </div>
                  <h3>{title}</h3>
                  {chapter_html}
                  <div class="unlock-overlay" style="border-top:none; margin-top:16px;">
                    <a href="/course" class="secondary-btn" style="width:100%;text-align:center;text-decoration:none;background:{color};color:#fff;border:none;">进入学习</a>
                  </div>
                </article>'''
    return new_article

new_content = pattern.sub(replacer, content)

with open('d:\\英语培训Jayu_Eric\\yabao\\学习机系统\\AI_learning\\subjects.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done")
