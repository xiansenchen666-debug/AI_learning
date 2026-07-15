# Teacher Portal Reference Specification

Reference: `普通老师页面/ChatGPT Image 2026年7月13日 14_48_17.png` (1672 x 941).

The page should match the reference composition, spacing, colors, type
hierarchy, icon placement, and interaction layout. Values from the database
remain authoritative; do not copy the sample names, scores, notification count,
dates, or summaries from the image.

## Desktop Geometry

- Top bar: 74 px high, white, one-pixel pale-blue bottom border.
- Workspace: `#f6f9fe`, 22 px top spacing, 27 px horizontal spacing.
- Content maximum width: 1654 px.
- Left student directory: 310 px wide and 810 px high at the 1672 x 941
  reference viewport.
- Directory/report gap: 19 px.
- Report row gaps: 16 px.
- Student hero: 200 px high.
- Analytics row: 324 px high with columns approximately 1.50 / 1.00 / 1.25.
- Narrative row: 254 px high with columns approximately 1.05 / 1.00 / 1.34.
- Cards use a pale-blue one-pixel border, restrained shadow, and an 8 px radius.

`assets/teacher-reference.css` implements these dimensions against the overview
DOM from commit `73e6f00`. It must be loaded after `assets/app.css` and
cache-versioned with the other assets.

## Required Header Changes

The current teacher header still differs materially from the reference. Update
`teacher.html` as follows:

1. Replace the text star in `.teacher-brand-mark` with a real orange brand icon
   or the final logo asset. Keep the visible brand text `启航教育`.
2. The centered closed-state header should read `学生管理` with a Lucide `Users`
   icon and a two-pixel blue active underline. The reference does not show three
   simultaneous top-level tabs. If the three teacher views must remain, expose
   them through a compact `学生管理` menu rather than three permanent labels.
3. Add a bell icon button before the account identity:
   - `.teacher-notification-button`
   - `.teacher-notification-badge` only when the real unread count is greater
     than zero
   - `.teacher-account-divider`
4. Display the avatar, `{full_name}老师`, and a Lucide `ChevronDown`. Put logout
   inside the account dropdown; the reference does not show a permanent `退出`
   text link.
5. Do not hard-code the reference notification number or teacher name.

## Required Student Directory Changes

The current classes are already compatible with the new stylesheet, but the
render function needs these additions:

1. Render a real `<img>` inside `.teacher-directory-avatar` when a saved student
   photo exists. Keep initials only as the fallback.
2. Do the same for the large `.teacher-student-avatar`.
3. Append a `.teacher-directory-footer` containing a functional
   `.teacher-directory-all-button` with a Lucide `Users` icon and
   `查看全部学生`.
4. Keep the currently selected student outlined in blue with the circular check
   mark.
5. The list must scroll inside the fixed directory when there are more students
   than fit. Student switching must continue updating the URL and all
   student-specific data.

## Required Hero Changes

1. Add a functional `.teacher-student-switch` button at the top-right with
   Lucide `ArrowLeftRight` and `切换学生`. It may open the existing student
   selector or focus the directory.
2. Use a bitmap/webp analytics illustration in `.teacher-hero-signal`, matching
   the translucent blue chart object from the reference. Add `has-image` to hide
   the CSS fallback bars after the asset is present.
3. Preserve real profile tags and the real AI/profile summary. Clamp the summary
   to two lines at desktop size.
4. Do not copy the reference child portrait unless it is deliberately adopted as
   a bundled demo asset. Production students should use their saved photo.

Suggested hero hook:

```html
<button class="teacher-student-switch" type="button">
  <!-- Lucide ArrowLeftRight -->
  <span>切换学生</span>
</button>
<div
  class="teacher-hero-signal has-image"
  style="--teacher-hero-art: url('/assets/teacher-growth-illustration.webp')"
>
</div>
```

## Required Analytics Changes

1. Trend card: make `近 6 个月` a real compact menu if alternate periods are
   supported. Keep the blue line/area chart and add its line legend below the
   chart.
2. Radar card: rename it to `学科能力雷达图`. Extend `teacherOverviewRadarSvg()`
   with a dashed `.teacher-radar-average` polygon when a real comparison series
   exists. Do not fabricate a class average.
3. Radar legend: use `.is-average` on the comparison legend item so the dashed
   line style is applied.
4. Metric cards: put Lucide icons inside `.teacher-metric-icon` (`Heart`,
   `Target`, `ClipboardCheck`, `MessageSquare`). Render real period changes in
   `.teacher-metric-change`; omit the arrow/change when the API has no
   comparison data.
5. Remove `数据库实时汇总` from the visible header. It does not appear in the
   reference and is implementation narration.

## Required Narrative Changes

1. Wrap every bottom-card title with `.teacher-card-heading` and add a matching
   `.teacher-card-heading-icon` using Lucide `FileText`, `UserRound`, and
   `ClipboardList`.
2. Keep the two summary classifications (`优势表现` and `待提升方向`) visible.
   The stylesheet makes them bordered inner regions with green/orange pill
   labels, as in the reference.
3. Teacher observation must use the newest saved lesson record and show the real
   teacher/date. Do not fill it with reference copy.
4. Add a real `.teacher-timeline-tag` to each timeline row using its stored
   tone/status.
5. Append a functional `.teacher-timeline-more` link to the full saved growth
   history. Do not show fake rows to fill space.

Suggested timeline row:

```html
<li class="tone-progress">
  <time>7月</time>
  <div><strong>真实成长事件</strong></div>
  <span class="teacher-timeline-tag">进步</span>
</li>
```

## Responsive Behavior

- Above 1400 px: reproduce the three-row reference dashboard exactly.
- 1021-1399 px: keep the directory on the left, move metrics to a full-width
  row, and allow the page to scroll.
- 761-1020 px: move the directory above the report and make its students
  horizontally scrollable.
- At 760 px and below: use the existing two-row top bar, a single-column report,
  and one metric per row. No element may overflow or overlap.

## Acceptance Checks

1. Compare a 1672 x 941 screenshot against the reference: top bar, 310 px
   directory, 200/324/254 px report rows, and all 16/19/22/27 px gaps should
   align.
2. Test with one student, five students, and more than ten students.
3. Test long Chinese names, long usernames, missing photos, missing AI analysis,
   and missing trend/radar data.
4. Verify student switching changes every report section without a full-page
   refresh.
5. Verify keyboard focus for the header menu, student list, switch button,
   account menu, and growth-history link.
6. Capture 1440 x 900, 1024 x 768, 768 x 1024, and 390 x 844 screenshots and
   check for clipping or overlap.
