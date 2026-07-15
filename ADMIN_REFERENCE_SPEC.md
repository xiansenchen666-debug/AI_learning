# 超级管理员参考图实现规范

本规范对应 `超级管理员界面/` 中的 7 张参考图。目标是保持参考图的页面骨架、信息层级、间距、控件位置和交互方式；示例图中的人数、课程数、排名、增长率、日期、通知数和 API 配额不能写死，必须来自数据库或显示 `—` / 空状态。

样式入口：`assets/admin-reference.css`。在 `teacher.html` 中必须放在 `assets/app.css` 后面：

```html
<link rel="stylesheet" href="assets/app.css?v=VERSION">
<link rel="stylesheet" href="assets/admin-reference.css?v=VERSION">
```

## 1. 路由与导航

顶栏严格保留参考图的四个一级入口：

| 顶栏文字 | `view` | 说明 |
| --- | --- | --- |
| 教师管理 | `teachers` | 教师列表、筛选、创建教师 |
| 学生管理 | `students` / `enrollments` | 学生列表；课程配置是学生管理的二级视图，因此 `enrollments` 时顶栏仍高亮“学生管理” |
| 数据中心 | `data` | 全站真实学习数据；没有数据时显示空图表，不填示例数字 |
| 系统设置 | `models` | 当前 AI 配置、配置编辑与连接测试 |

不要再在一级顶栏放“课程管理”。`enrollments` 通过学生页的“购课管理”标签、行内“课程”操作或 URL 进入。

`initTeacherManagementTabs()` 的管理员允许视图应为：

```js
const adminViews = ["teachers", "students", "enrollments", "data", "models"];
```

顶栏高亮规则：`enrollments -> students`，其余按同名 view 高亮。

## 2. 公共页面结构

完整 DOM 契约如下；图标用现有 Lucide 图标，不写 emoji，不把参考图的通知数字写进页面。

```html
<body class="is-admin-portal" data-page="teacher">
  <header class="admin-reference-topbar" data-admin-portal-topbar>
    <a class="admin-reference-brand" href="/teacher?view=teachers">
      <span class="admin-reference-brand-mark" aria-hidden="true"><!-- Sailboat --></span>
      <span>启航教育</span>
    </a>
    <nav class="admin-reference-nav" aria-label="超级管理员工作台">
      <button class="admin-reference-nav-item" data-management-view-link="teachers" data-admin-management-link>教师管理</button>
      <button class="admin-reference-nav-item" data-management-view-link="students" data-admin-management-link>学生管理</button>
      <button class="admin-reference-nav-item" data-management-view-link="data" data-admin-management-link>数据中心</button>
      <button class="admin-reference-nav-item" data-management-view-link="models" data-admin-management-link>系统设置</button>
    </nav>
    <div class="admin-reference-account">
      <button class="admin-reference-notifications" type="button" aria-label="通知"><!-- Bell --></button>
      <!-- 只有真实通知数大于 0 才渲染 .admin-reference-notification-count -->
      <span class="admin-reference-avatar" data-avatar-text></span>
      <span class="admin-reference-account-copy">
        <span class="admin-reference-account-name">超级管理员</span>
        <span class="admin-reference-account-role">SUPER ADMIN</span>
      </span>
      <a class="admin-reference-logout" href="/login" data-action="logout">退出</a>
    </div>
  </header>

  <main class="content">
    <section class="admin-reference-view is-hidden" data-management-view-panel="VIEW">
      <div class="admin-reference-container">
        <!-- 当前 view 内容 -->
      </div>
    </section>
  </main>
</body>
```

公共页面头：

```html
<header class="admin-reference-page-head">
  <div>
    <p class="admin-reference-breadcrumb"><!-- 仅二级页使用 --></p>
    <h1 class="admin-reference-title">页面名称</h1>
    <p class="admin-reference-subtitle">参考图对应说明</p>
  </div>
  <div class="admin-reference-page-actions"><!-- 可选操作 --></div>
</header>
```

公共统计卡精确结构：

```html
<div class="admin-reference-stat-grid">
  <article class="admin-reference-stat">
    <span class="admin-reference-stat-icon"><!-- Lucide icon --></span>
    <div>
      <p class="admin-reference-stat-label">教师总数</p>
      <div class="admin-reference-stat-value-row">
        <strong class="admin-reference-stat-value" data-admin-teacher-total>—</strong>
        <span class="admin-reference-stat-unit">人</span>
      </div>
      <p class="admin-reference-stat-note">当前系统账号</p>
    </div>
  </article>
  <!-- 其余卡使用 is-green / is-orange / is-purple -->
</div>
```

### 公共真实数据源

主数据只请求一次 `GET /api/admin/enrollments`，在前端缓存并供教师、学生、购课和基础统计共享：

```ts
type AdminPayload = {
  teachers: UserPayload[];
  students: (UserPayload & { course_ids: number[] })[];
  courses: (Course & { lesson_count: number })[];
}
```

`UserPayload` 当前真实字段：`id`、`username`、`full_name`、`role`、`teacher_id`、`stage`、`grade`、`level_label`、`email`、`school`、`bio`、`access_expires_on`、`access_remaining_days`、`avatar_text`。

当前接口没有返回 `created_at`、教师启停状态、登录次数或最近登录时间。未扩展服务器前，界面必须显示 `—`，不能生成日期或“本月新增”数字。

## 3. 教师管理 `view=teachers`

页面文字必须为：

- 标题：`教师管理`
- 副标题：`管理和维护所有教师账号及信息`
- 主按钮：`创建教师`
- 表格标签：`全部教师`、`在职教师`、`停用教师`

DOM：

```html
<section class="admin-reference-view" data-management-view-panel="teachers">
  <div class="admin-reference-container">
    <header class="admin-reference-page-head">...</header>
    <div class="admin-reference-stat-grid" data-admin-teacher-stats>...</div>
    <section class="admin-reference-panel">
      <header class="admin-reference-panel-head">
        <div class="admin-reference-tabs" role="tablist">
          <button class="admin-reference-tab is-active" data-teacher-filter="all">全部教师</button>
          <button class="admin-reference-tab" data-teacher-filter="active">在职教师</button>
          <button class="admin-reference-tab" data-teacher-filter="disabled">停用教师</button>
        </div>
        <div class="admin-reference-toolbar-actions">
          <label class="admin-reference-search">
            <input class="admin-reference-field" data-teacher-search placeholder="搜索教师账号 / 姓名 / 邮箱">
            <!-- Search icon -->
          </label>
          <button class="admin-reference-secondary" type="button" data-open-teacher-filter><!-- ListFilter -->筛选</button>
          <button class="admin-reference-primary" type="button" data-open-teacher-create><!-- Plus -->创建教师</button>
        </div>
      </header>
      <div class="admin-reference-table-wrap">
        <table class="admin-reference-table">
          <thead><tr>
            <th>教师账号</th><th>姓名</th><th>邮箱</th><th>所属阶段</th><th>名下学生数</th><th>状态</th><th>操作</th>
          </tr></thead>
          <tbody id="teacher-account-list"></tbody>
        </table>
      </div>
      <footer class="admin-reference-pagination">...</footer>
    </section>
  </div>
</section>
```

每个教师 `<tr>` 的真实映射：

| 列 | 值 |
| --- | --- |
| 教师账号 | `teacher.username`，必须可见，不能只显示姓名 |
| 姓名 | `teacher.full_name || teacher.username` |
| 邮箱 | `teacher.email || "未填写"` |
| 所属阶段 | `teacher.stage || "所有阶段"` |
| 名下学生数 | `students.filter(s => Number(s.teacher_id) === Number(teacher.id)).length` |
| 状态 | 当前接口只返回未删除账号，显示“可用”；不要声称有独立启停功能 |
| 操作 | “编辑”仅在真实编辑逻辑完成后启用；“更多”菜单不能是假按钮 |

统计卡映射：

| 卡片 | 值 |
| --- | --- |
| 教师总数 | `teachers.length` |
| 在职教师 | 当前系统没有停用字段，使用 `teachers.length`，注释“当前可用账号” |
| 本月新增 | 未返回 `created_at` 时为 `—` |
| 停用教师 | 未实现停用字段时为 `—` |

创建教师必须是弹窗，不要把表单常驻在列表上方。保留现有 JS 钩子和空默认值：

```html
<div class="admin-reference-modal is-hidden" data-teacher-create-modal role="dialog" aria-modal="true" aria-labelledby="teacher-create-title">
  <div class="admin-reference-modal-dialog">
    <header class="admin-reference-modal-head">
      <h2 id="teacher-create-title">创建教师账号</h2>
      <button class="admin-reference-icon-button" type="button" data-close-teacher-create aria-label="关闭"><!-- X --></button>
    </header>
    <form id="teacher-create-form" autocomplete="off">
      <div class="admin-reference-form-grid">
        <label class="admin-reference-form-label">账号 <input class="admin-reference-field" name="username" value="" autocomplete="off" required></label>
        <label class="admin-reference-form-label">密码 <input class="admin-reference-field" name="password" value="" type="password" autocomplete="new-password" required></label>
        <label class="admin-reference-form-label">姓名 <input class="admin-reference-field" name="full_name" value="" required></label>
        <label class="admin-reference-form-label">邮箱 <input class="admin-reference-field" name="email" value="" type="email"></label>
      </div>
      <footer class="admin-reference-form-actions">
        <span class="admin-reference-form-status" id="teacher-create-status" aria-live="polite"></span>
        <button class="admin-reference-secondary" type="button" data-close-teacher-create>取消</button>
        <button class="admin-reference-primary" type="submit">创建教师</button>
      </footer>
    </form>
  </div>
</div>
```

账号和密码没有 `value`、没有示例账号、没有脚本预填。弹窗每次打开前执行 `form.reset()`。

## 4. 学生管理 `view=students`

页面文字：

- 标题：`学生管理`
- 副标题：`管理学生账号信息、教师分配及课程购买，助力学生学习成长`
- 面板标签：`学生列表`、`购课管理`
- 主按钮：`创建学生`

DOM：

```html
<section class="admin-reference-view" data-management-view-panel="students">
  <div class="admin-reference-container">
    <header class="admin-reference-page-head">...</header>
    <div class="admin-reference-stat-grid" data-admin-student-stats>...</div>
    <section class="admin-reference-panel">
      <header class="admin-reference-panel-head">
        <div class="admin-reference-tabs">
          <button class="admin-reference-tab is-active" data-student-subview="list">学生列表</button>
          <button class="admin-reference-tab" data-management-view-link="enrollments">购课管理</button>
        </div>
        <div class="admin-reference-toolbar-actions">
          <label class="admin-reference-search"><input class="admin-reference-field" data-student-search placeholder="搜索学生账号 / 姓名 / 手机号"><!-- Search --></label>
          <button class="admin-reference-secondary" type="button" data-toggle-student-filters><!-- ListFilter -->筛选</button>
          <button class="admin-reference-secondary" type="button" data-export-students><!-- Download -->导出</button>
          <button class="admin-reference-primary" type="button" data-open-student-create><!-- Plus -->创建学生</button>
        </div>
      </header>
      <div class="admin-reference-filter-row" data-student-filters>
        <!-- 阶段、年级、学习状态、负责教师；最后为重置按钮 -->
      </div>
      <div class="admin-reference-table-wrap">
        <table class="admin-reference-table">
          <thead><tr>
            <th>学生账号</th><th>姓名</th><th>阶段</th><th>年级</th><th>负责教师</th><th>已购课程数</th><th>账号状态</th><th>有效期</th><th>操作</th>
          </tr></thead>
          <tbody data-admin-student-table-body></tbody>
        </table>
      </div>
      <footer class="admin-reference-pagination">...</footer>
    </section>
  </div>
</section>
```

学生行真实映射：

| 列 | 值 |
| --- | --- |
| 学生账号 | `student.username` |
| 姓名 | `student.full_name || student.username` |
| 阶段 | `student.stage || "未填写"` |
| 年级 | `student.grade || "未填写"` |
| 负责教师 | `teachers.find(t => Number(t.id) === Number(student.teacher_id))` 的姓名；找不到为“待分配” |
| 已购课程数 | `student.course_ids.length`，这里是课程数量，不是科目组数量 |
| 账号状态 | `access_remaining_days === 0 ? "已到期" : "有效"` |
| 有效期 | `access_expires_on || "长期有效"` |
| 操作 | `编辑` 打开编辑弹窗；`课程` 导航到 `view=enrollments&student=ID`；删除放入“更多”确认菜单 |

统计卡：学生总数=`students.length`；已购课程=`sum(student.course_ids.length)`；待分配教师=`students.filter(s => !s.teacher_id).length`；本月新增需要 `created_at`，当前为 `—`。

创建学生表单移入 `.admin-reference-modal`，保留 `id="student-create-form"`、`data-create-student`、`id="student-create-status"` 以及字段名 `username/password/full_name/stage/grade/email/access_duration_days`。账号、密码和姓名必须为空且必填。

“导出”只有实现真实 CSV 下载后才启用；没有实现时隐藏，不显示无效按钮。

## 5. 课程配置 `view=enrollments`

该页复刻参考图第 1 张，顶栏仍高亮“学生管理”。不要使用逐个展开的大卡片。

DOM：

```html
<section class="admin-reference-view" data-management-view-panel="enrollments">
  <div class="admin-reference-container">
    <header class="admin-reference-page-head">
      <div><h1 class="admin-reference-title">课程管理</h1><p class="admin-reference-subtitle">为学生配置可学习的课程</p></div>
    </header>
    <div class="admin-reference-stat-grid"><!-- 只放 2 张统计卡 --></div>
    <section class="admin-reference-panel admin-reference-assignment-panel">
      <h2 class="admin-reference-assignment-title">配置学生课程</h2>
      <div class="admin-reference-assignment-grid">
        <section class="admin-reference-picker admin-reference-student-picker">
          <h3>选择学生</h3>
          <div class="admin-reference-picker-toolbar"><label class="admin-reference-search">...</label></div>
          <div class="admin-reference-picker-list" data-assignment-student-list></div>
        </section>
        <div class="admin-reference-assignment-actions">
          <button class="admin-reference-primary" type="button" data-add-selected-courses>添加</button>
          <button class="admin-reference-secondary" type="button" data-remove-selected-courses>移除</button>
        </div>
        <section class="admin-reference-picker admin-reference-course-picker">
          <h3>选择课程</h3>
          <div class="admin-reference-picker-toolbar"><label class="admin-reference-search">...</label></div>
          <div class="admin-reference-picker-list" data-assignment-course-list></div>
        </section>
        <section class="admin-reference-picker">
          <h3 class="visually-hidden">已分配课程</h3>
          <div class="admin-reference-selected-list" data-assignment-selected-list></div>
        </section>
      </div>
      <footer class="admin-reference-assignment-footer">
        <button class="admin-reference-secondary" type="button" data-reset-assignment>取消</button>
        <button class="admin-reference-primary" type="button" data-save-enrollment>保存配置</button>
        <span class="admin-reference-form-status" data-save-status aria-live="polite"></span>
      </footer>
    </section>
  </div>
</section>
```

数据与交互：

1. 左列使用 `students`，单选当前学生；URL 中已有 `student` 时优先选中该 ID。
2. 中列使用 `courses`，每行展示 `course.title`、`course.stage / course.grade`、`course.subject`，不得只用硬编码语数英。
3. 右列由当前学生的 `course_ids` 与 `courses` 连接得到。
4. “添加/移除”只改变前端草稿，不立即写数据库。
5. “保存配置”调用 `POST /api/admin/enrollments`：`{ student_id, course_ids }`。
6. 保存成功后显示 `配置已保存`，并同步缓存中该学生的 `course_ids`。
7. 顶部“课程总数”=`courses.length`；“已分配课程”=`sum(students.map(s => s.course_ids.length))`。

## 6. 系统设置 `view=models`

参考图第 5、6 张合并为一个真实配置页：默认显示当前配置摘要和单行配置列表；“配置 API Key / 编辑”展开编辑表单。系统只有一条配置，不要伪造备用、测试环境或 Embedding Key。

DOM：

```html
<section class="admin-reference-view" data-management-view-panel="models" data-model-settings-panel>
  <div class="admin-reference-container">
    <header class="admin-reference-page-head">
      <div><h1 class="admin-reference-title">系统设置</h1><h2>API Key 管理</h2><p class="admin-reference-subtitle">管理和配置用于调用第三方 AI 服务的 API Key，保障系统稳定运行。</p></div>
    </header>
    <section class="admin-reference-panel admin-reference-config-summary">
      <header class="admin-reference-config-summary-head"><h2>当前 API 服务配置</h2><button class="admin-reference-secondary" data-open-model-editor>编辑配置</button></header>
      <div class="admin-reference-config-grid">
        <div class="admin-reference-config-item"><span>服务提供商</span><strong data-model-provider>兼容 OpenAI 接口</strong></div>
        <div class="admin-reference-config-item"><span>当前使用模型</span><strong data-model-name>—</strong></div>
        <div class="admin-reference-config-item"><span>配置状态</span><strong data-model-settings-state>—</strong></div>
        <div class="admin-reference-config-item"><span>配置来源</span><strong data-model-source>—</strong></div>
      </div>
    </section>
    <section class="admin-reference-panel">
      <header class="admin-reference-panel-head"><h2 class="admin-reference-panel-title">API Key 列表</h2><button class="admin-reference-primary" data-open-model-editor>配置 API Key</button></header>
      <div class="admin-reference-table-wrap"><table class="admin-reference-table"><thead>...</thead><tbody data-model-config-row></tbody></table></div>
      <div class="admin-reference-security-note"><!-- ShieldCheck -->API Key 仅在服务器端加密存储，页面不会返回完整密钥。</div>
    </section>
    <section class="admin-reference-panel is-hidden" data-model-editor>
      <header class="admin-reference-config-summary-head"><h2>创建 API Key</h2></header>
      <form id="model-settings-form" data-model-settings-form>
        <div class="admin-reference-config-form">
          <div class="admin-reference-config-form-grid">
            <label class="admin-reference-form-label">接口 URL <input class="admin-reference-field" name="base_url" type="url" required></label>
            <label class="admin-reference-form-label">API Key <input class="admin-reference-field" name="api_key" type="password" autocomplete="new-password"></label>
            <label class="admin-reference-form-label">默认模型 <input class="admin-reference-field" name="model" required></label>
            <div class="admin-reference-test-box"><div><strong>连接测试</strong><p>填写配置后，可测试接口是否正确和服务是否可用。</p></div><button class="admin-reference-secondary" type="button" data-test-model-settings>测试连接</button></div>
          </div>
        </div>
        <footer class="admin-reference-form-actions">
          <span class="admin-reference-form-status" data-model-settings-status></span>
          <button class="admin-reference-secondary" type="button" data-close-model-editor>取消</button>
          <button class="admin-reference-primary" type="submit" data-save-model-settings>保存配置</button>
        </footer>
      </form>
    </section>
  </div>
</section>
```

真实接口：读取 `GET /api/admin/model-settings`，测试 `POST /api/admin/model-settings/test`，保存 `PUT /api/admin/model-settings`。配置摘要映射 `model`、`api_key_configured`、`source`；URL/API Key 不在列表中明文展示。API Key 列表只有一行，名称为“系统默认配置”，Key 显示服务器返回的 hint（若接口未返回 hint 则显示“已安全保存”），状态由 `api_key_configured` 决定。

## 7. 数据中心 `view=data`

页面骨架按参考图第 2 张：五张统计卡、学习趋势、学科覆盖、学习时段、年级分布、活跃学生、班级表现。不能用参考图数字。

```html
<section class="admin-reference-view" data-management-view-panel="data">
  <div class="admin-reference-container">
    <header class="admin-reference-page-head">...</header>
    <div class="admin-reference-stat-grid is-five">...</div>
    <div class="admin-reference-dashboard-grid">
      <section class="admin-reference-dashboard-card" data-admin-study-trend><h2>学习趋势</h2>...</section>
      <section class="admin-reference-dashboard-card" data-admin-subject-coverage><h2>学科覆盖 / 完成率</h2>...</section>
      <section class="admin-reference-dashboard-card" data-admin-study-period><h2>学习时段分布</h2>...</section>
    </div>
    <div class="admin-reference-dashboard-grid">
      <section class="admin-reference-dashboard-card" data-admin-grade-distribution><h2>年级分布</h2>...</section>
      <section class="admin-reference-dashboard-card" data-admin-active-students><h2>活跃学生 TOP10</h2>...</section>
      <section class="admin-reference-dashboard-card" data-admin-class-performance><h2>阶段表现 TOP5</h2>...</section>
    </div>
  </div>
</section>
```

现有 `/api/admin/enrollments` 只能真实计算：学生总数、教师总数、购课总数、按阶段/年级的学生分布、按学科的购课覆盖。学习时长、正确率、完成课程、日期趋势、活跃排名需要新增管理员聚合接口，从 `ai_study_time`、`ai_question_attempts`、`ai_progress`、`ai_course_enrollments` 和 `ai_sessions` 聚合。该接口完成前，相应卡片值为 `—`，图表内部渲染：

```html
<div class="admin-reference-chart-empty">暂无全站汇总数据</div>
```

绝不能从当前登录管理员自身的 dashboard 数据冒充全站数据。

## 8. 视觉验收

桌面端以 1440×1000 和 1536×1024 截图核对：

1. 顶栏高度 76px，品牌左对齐，四个一级菜单居中，当前菜单底部为 3px 蓝线。
2. 工作区左右各约 34px，内容最大宽 1374px；标题不是卡片，统计卡和主面板为白色。
3. 四张统计卡同高横排，分别使用蓝、绿、橙、紫图标底；不把整个页面做成单一蓝色。
4. 列表创建表单默认不可见，只能由右上“创建”按钮打开。
5. 教师账号列直接展示 `username`。
6. 表格行高约 54px，表头浅灰，按钮为参考图蓝色矩形，圆角不超过 8px。
7. 课程页必须是“学生 / 操作 / 课程 / 已配置”四列选择器，不是纵向学生卡片。
8. 系统设置只有真实的一条 API 配置，不生成多条样例 Key。
9. 640px、900px、1180px 三个断点无文字重叠、横向截断或操作按钮溢出；宽表格允许容器内横向滚动。

