const USER_CACHE_KEY = "stq-user-profile";
const LAST_SUBJECT_LOCATION_KEY = "stq-last-subject-location";
const ROUTE_LOADING_LABEL_KEY = "stq-route-loading-label";
const API_PREFETCH_CACHE_PREFIX = "stq-api-prefetch:";
const API_PREFETCH_CACHE_TTL_MS = 10 * 60 * 1000;
const API_COURSE_CACHE_TTL_MS = 30 * 60 * 1000;

function readLastSubjectLocation() {
  try {
    return JSON.parse(
      localStorage.getItem(LAST_SUBJECT_LOCATION_KEY) || "null",
    );
  } catch {
    return null;
  }
}

function saveLastSubjectLocation(stage, grade) {
  const nextStage = String(stage || "").trim();
  const nextGrade = String(grade || "").trim();
  if (!nextStage || !nextGrade) {
    return;
  }
  try {
    localStorage.setItem(
      LAST_SUBJECT_LOCATION_KEY,
      JSON.stringify({ view: "grade", stage: nextStage, grade: nextGrade }),
    );
  } catch {
    // Ignore storage errors silently.
  }
}

function saveSubjectOverviewLocation() {
  try {
    localStorage.setItem(
      LAST_SUBJECT_LOCATION_KEY,
      JSON.stringify({ view: "grades" }),
    );
  } catch {
    // Ignore storage errors silently.
  }
}

function buildGradeHref(stage, grade) {
  const nextStage = String(stage || "").trim();
  const nextGrade = String(grade || "").trim();
  if (!nextStage || !nextGrade) {
    return "/subjects";
  }
  const params = new URLSearchParams({ stage: nextStage, grade: nextGrade });
  return `/grade?${params.toString()}`;
}

function buildSubjectsHref(stage, grade) {
  return buildGradeHref(stage, grade);
}

function buildLessonHref(courseId, lessonId, extra = {}) {
  if (!courseId || !lessonId) {
    return courseId ? `/course?id=${encodeURIComponent(courseId)}` : "/course";
  }
  const params = new URLSearchParams({
    id: courseId,
    lesson: lessonId,
  });
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });
  return `/course?${params.toString()}`;
}

function hydrateSubjectNavLinks() {
  const lastLocation = readLastSubjectLocation();
  if (lastLocation?.view === "grades") {
    document.querySelectorAll('a[href^="/subjects"], a[href^="/grade"]')
      .forEach((node) => {
        if (
          node.id !== "course-back-link" && node.id !== "lesson-back-link" &&
          !node.hasAttribute("data-subject-overview-link")
        ) {
          node.setAttribute("href", "/subjects");
        }
      });
    return;
  }
  if (!lastLocation?.stage || !lastLocation?.grade) {
    return;
  }
  const href = buildSubjectsHref(lastLocation.stage, lastLocation.grade);
  document.querySelectorAll('a[href^="/subjects"], a[href^="/grade"]').forEach(
    (node) => {
      if (
        node.id === "course-back-link" || node.id === "lesson-back-link" ||
        node.hasAttribute("data-subject-overview-link")
      ) {
        return;
      }
      node.setAttribute("href", href);
    },
  );
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanCourseDisplayTitle(title) {
  return String(title || "").replace(
    /^\s*(?:普通高中教科书|义务教育教科书)\s*(?:[·・]\s*)?/,
    "",
  ).trim();
}

function buildLessonReviewHref(item) {
  if (!item?.course_id || !item?.lesson_id) {
    return "";
  }
  return buildLessonHref(
    item.course_id,
    item.lesson_id,
    item.question_id ? { review: "mistake", question: item.question_id } : {},
  );
}

function renderMistakeReviewAction(
  item,
  className = "secondary-btn full-width-button",
) {
  const href = buildLessonReviewHref(item);
  if (!href) {
    return `<button class="${className}" type="button" disabled>AI 举一反三重刷</button>`;
  }
  return `<a class="${className}" href="${escapeHtml(href)}">AI 举一反三重刷</a>`;
}

async function apiFetch(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  if (method !== "GET") {
    clearApiPrefetchCache();
  }
  const cacheTtlMs = Number(
    options.cacheTtlMs ??
      (method === "GET" ? defaultApiCacheTtl(url) : 0),
  );
  const shouldUseCache = cacheTtlMs > 0 && method === "GET" &&
    typeof url === "string";
  const cacheKey = shouldUseCache ? `${API_PREFETCH_CACHE_PREFIX}${url}` : "";
  if (shouldUseCache) {
    const cached = readApiCache(cacheKey, cacheTtlMs);
    if (cached) {
      return cached;
    }
  }
  const fetchOptions = { ...options };
  delete fetchOptions.cacheTtlMs;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...fetchOptions,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !String(url).includes("/api/login")) {
      clearUserProfile();
      if (
        window.location.protocol !== "file:" &&
        window.location.pathname !== "/login"
      ) {
        window.location.replace("/login");
      }
    }
    throw new Error(data.message || "请求失败");
  }
  if (shouldUseCache) {
    writeApiCache(cacheKey, data);
  }
  return data;
}

function defaultApiCacheTtl(url) {
  const path = String(url || "");
  if (!path.startsWith("/api/")) {
    return 0;
  }
  if (
    /^\/api\/course\/\d+/.test(path) ||
    /^\/api\/lessons\/\d+\/question-bank/.test(path)
  ) {
    return API_COURSE_CACHE_TTL_MS;
  }
  if (
    path === "/api/dashboard" ||
    path === "/api/subjects" ||
    path === "/api/mistakes" ||
    path === "/api/growth" ||
    path === "/api/session"
  ) {
    return API_PREFETCH_CACHE_TTL_MS;
  }
  return 0;
}

function clearApiPrefetchCache() {
  try {
    const keys = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(API_PREFETCH_CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Ignore cache errors silently.
  }
}

function readApiCache(cacheKey, ttlMs) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached && Date.now() - Number(cached.savedAt || 0) <= ttlMs) {
      return cached.data;
    }
  } catch {
    // Ignore cache errors silently.
  }
  return null;
}

function writeApiCache(cacheKey, data) {
  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // Ignore cache errors silently.
  }
}

function keepStaticPage(error) {
  console.warn(error);
}

function isTeacherUser(user) {
  return user && (user.role === "teacher" || user.role === "admin");
}

async function openResourcePath(key) {
  await apiFetch("/api/resource-path/open", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
}

function wireResourcePathButtons(root = document) {
  root.querySelectorAll("[data-open-resource-key]").forEach((node) => {
    if (node.dataset.openBound === "1") {
      return;
    }
    node.dataset.openBound = "1";
    node.addEventListener("click", async () => {
      const key = node.dataset.openResourceKey;
      if (!key) {
        return;
      }
      node.disabled = true;
      try {
        await openResourcePath(key);
      } catch (error) {
        alert(error.message);
      } finally {
        node.disabled = false;
      }
    });
  });
}

function wireLessonStartButtons(root = document) {
  root.querySelectorAll("[data-start-lesson-id]").forEach((node) => {
    if (node.dataset.startBound === "1") {
      return;
    }
    node.dataset.startBound = "1";
    node.addEventListener("click", async () => {
      const lessonId = node.dataset.startLessonId;
      if (!lessonId) {
        return;
      }
      node.disabled = true;
      const previousText = node.textContent;
      node.textContent = "正在进入";
      try {
        await apiFetch(`/api/lessons/${lessonId}/start`, { method: "POST" });
        node.dispatchEvent(
          new CustomEvent("lesson-started", {
            bubbles: true,
            detail: { lessonId },
          }),
        );
        if (node.isConnected) {
          node.textContent = "继续学习";
          node.disabled = false;
        }
      } catch (error) {
        alert(error.message);
        node.textContent = previousText;
        node.disabled = false;
      }
    });
  });
}

function syncQuestionOptionState(card) {
  if (!card) {
    return;
  }
  const selected = card.querySelector("input[type='radio']:checked");
  const selectedValue = selected?.value || "";
  const isLocked = card.dataset.submitted === "1" ||
    card.dataset.reviewed === "1";
  const correctAnswer = card.dataset.correctAnswer || "";
  card.querySelectorAll(".question-option").forEach((label) => {
    const input = label.querySelector("input[type='radio']");
    const value = input?.value || "";
    label.classList.toggle("is-selected", value === selectedValue);
    label.classList.toggle("is-locked", isLocked);
    label.classList.toggle(
      "is-correct",
      card.dataset.reviewed === "1" && value === correctAnswer,
    );
    label.classList.toggle(
      "is-wrong",
      card.dataset.reviewed === "1" && value === selectedValue &&
        selectedValue !== correctAnswer,
    );
    if (input) {
      input.disabled = isLocked;
    }
  });
  const submitButton = card.querySelector('[data-action="submit-question"]');
  if (submitButton && card.dataset.submitted !== "1") {
    submitButton.disabled = !selectedValue;
  }
}

function updatePracticeSessionState(session) {
  if (!session) {
    return;
  }
  const cards = [...session.querySelectorAll("[data-question-id]")];
  const total = cards.length;
  const submittedCards = cards.filter((card) => card.dataset.submitted === "1");
  const reviewed = session.dataset.reviewed === "1";
  const correctCount = submittedCards.filter((card) => card.dataset.correct === "1").length;
  const meter = session.querySelector("[data-practice-meter]");
  const fill = session.querySelector("[data-practice-progress-fill]");
  const reviewButton = session.querySelector('[data-action="review-answers"]');
  const hint = session.querySelector("[data-practice-hint]");

  if (meter) {
    meter.textContent = `已提交 ${submittedCards.length}/${total}`;
  }
  if (fill) {
    fill.style.setProperty(
      "--practice-progress",
      `${total ? Math.round((submittedCards.length / total) * 100) : 0}%`,
    );
  }
  if (reviewButton) {
    reviewButton.disabled = submittedCards.length === 0 || reviewed;
    reviewButton.textContent = submittedCards.length >= total ? "对答案" : `对已提交 ${submittedCards.length} 题`;
  }
  if (hint) {
    if (reviewed) {
      hint.textContent = `已对答案：${correctCount}/${submittedCards.length || 0} 题正确。`;
    } else if (submittedCards.length === 0) {
      hint.textContent = "先选择答案并提交，解析会在对答案后出现。";
    } else if (submittedCards.length < total) {
      hint.textContent = `还有 ${total - submittedCards.length} 题未提交，可以继续做，也可以先对已提交题目。`;
    } else {
      hint.textContent = "本组题已提交完成，现在可以统一对答案。";
    }
  }
}

function revealPracticeAnswers(session) {
  if (!session) {
    return;
  }
  session.dataset.reviewed = "1";
  const cards = [...session.querySelectorAll("[data-question-id]")];
  const submittedCards = cards.filter((card) => card.dataset.submitted === "1");
  const correctCount = submittedCards.filter((card) => card.dataset.correct === "1").length;
  cards.forEach((card) => {
    const resultNode = card.querySelector(".question-result");
    const reviewBox = card.querySelector("[data-answer-review]");
    const submitButton = card.querySelector('[data-action="submit-question"]');
    card.dataset.reviewed = "1";
    syncQuestionOptionState(card);
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = card.dataset.submitted === "1" ? "已提交" : "未提交";
    }
    if (reviewBox) {
      reviewBox.classList.remove("is-hidden");
    }
    if (!resultNode) {
      return;
    }
    if (card.dataset.submitted !== "1") {
      resultNode.textContent = "本题未提交，不计入本次对答案。";
      resultNode.className = "question-result is-info";
      return;
    }
    const selectedAnswer = card.dataset.submittedAnswer || "未记录";
    if (card.dataset.correct === "1") {
      resultNode.textContent = `答对了。你的答案：${selectedAnswer}`;
      resultNode.className = "question-result is-success";
    } else {
      resultNode.textContent = `需要订正。你的答案：${selectedAnswer}；正确答案：${card.dataset.correctAnswer || "暂无"}`;
      resultNode.className = "question-result is-error";
    }
  });

  const summary = session.querySelector("[data-practice-summary]");
  if (summary) {
    const total = cards.length;
    const submittedCount = submittedCards.length;
    const accuracy = submittedCount ? Math.round((correctCount / submittedCount) * 100) : 0;
    const wrongCount = Math.max(0, submittedCount - correctCount);
    const reviewAdvice = wrongCount ? `有 ${wrongCount} 题需要订正，先看红色题目，再回到正文补概念。` : "本次提交题目全部正确，可以继续完成剩余题或进入本年级题库。";
    summary.classList.remove("is-hidden");
    summary.innerHTML = `
      <strong>${accuracy}分</strong>
      <span>已对 ${submittedCount}/${total} 题，正确 ${correctCount} 题。${reviewAdvice}</span>
    `;
  }
  updatePracticeSessionState(session);
}

function wireQuestionSubmitButtons(root = document) {
  root.querySelectorAll(".practice-session").forEach((session) => {
    if (session.dataset.practiceBound === "1") {
      return;
    }
    session.dataset.practiceBound = "1";
    session.querySelectorAll("[data-question-id]").forEach((card) => syncQuestionOptionState(card));
    updatePracticeSessionState(session);

    session.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "radio") {
        return;
      }
      const card = target.closest("[data-question-id]");
      if (!card || card.dataset.submitted === "1") {
        return;
      }
      const resultNode = card.querySelector(".question-result");
      if (resultNode) {
        resultNode.textContent = "已选择，点击“提交本题”后进入对答案队列。";
        resultNode.className = "question-result is-info";
      }
      syncQuestionOptionState(card);
    });

    session.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const submitButton = target?.closest('[data-action="submit-question"]');
      const reviewButton = target?.closest('[data-action="review-answers"]');
      if (reviewButton && session.contains(reviewButton)) {
        revealPracticeAnswers(session);
        return;
      }
      if (!submitButton || !session.contains(submitButton)) {
        return;
      }
      const card = submitButton.closest("[data-question-id]");
      const resultNode = card?.querySelector(".question-result");
      const questionId = card?.dataset.questionId;
      const selected = card?.querySelector("input[type='radio']:checked");
      if (!card || !questionId || !resultNode) {
        return;
      }
      if (!selected) {
        resultNode.textContent = "请先选择一个答案。";
        resultNode.className = "question-result is-error";
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = "提交中";
      try {
        const result = await apiFetch(`/api/questions/${questionId}/submit`, {
          method: "POST",
          body: JSON.stringify({ answer: selected.value }),
        });
        card.dataset.submitted = "1";
        card.dataset.submittedAnswer = selected.value;
        card.dataset.correct = result.data.correct ? "1" : "0";
        card.dataset.correctAnswer = result.data.answer ||
          card.dataset.correctAnswer || "";
        card.dataset.explanation = result.data.explanation ||
          card.dataset.explanation || "";
        const answerNode = card.querySelector("[data-review-answer]");
        const explanationNode = card.querySelector("[data-review-explanation]");
        if (answerNode) {
          answerNode.textContent = card.dataset.correctAnswer || "暂无答案";
        }
        if (explanationNode) {
          explanationNode.textContent = card.dataset.explanation ||
            "暂无解析。";
        }
        resultNode.textContent = "已提交。先继续下一题，最后点“对答案”统一看结果。";
        resultNode.className = "question-result is-info";
        submitButton.textContent = "已提交";
        syncQuestionOptionState(card);
        updatePracticeSessionState(session);
        submitButton.dispatchEvent(
          new CustomEvent("question-submitted", {
            bubbles: true,
            detail: result.data,
          }),
        );
      } catch (error) {
        resultNode.textContent = error.message;
        resultNode.className = "question-result is-error";
        submitButton.textContent = "提交本题";
        submitButton.disabled = !selected;
      }
    });
  });
}

function wireInlineChoiceOptions(root = document) {
  root.querySelectorAll(".exercise-options-row").forEach((row) => {
    if (row.dataset.choiceBound === "1") {
      return;
    }
    row.dataset.choiceBound = "1";
    row.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const choice = target?.closest(".exercise-option-choice");
      if (!choice || !row.contains(choice)) {
        return;
      }
      row.querySelectorAll(".exercise-option-choice").forEach((node) => {
        const selected = node === choice;
        node.classList.toggle("is-selected", selected);
        node.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    });
  });
}

function createLessonStudyTimer() {
  const flushIntervalMs = 5 * 60 * 1000;
  let activeLessonId = null;
  let lastTickAt = 0;
  let pendingSeconds = 0;

  const canCount = () => activeLessonId && document.visibilityState === "visible";

  const accrue = () => {
    if (!canCount() || !lastTickAt) {
      return;
    }
    const now = Date.now();
    const elapsed = Math.floor((now - lastTickAt) / 1000);
    if (elapsed <= 0) {
      return;
    }
    pendingSeconds += Math.min(elapsed, flushIntervalMs / 1000);
    lastTickAt = now;
  };

  const flush = (useBeacon = false) => {
    accrue();
    const lessonId = activeLessonId;
    const seconds = Math.floor(pendingSeconds);
    if (!lessonId || seconds < 3) {
      return;
    }
    pendingSeconds = 0;
    const url = `/api/lessons/${lessonId}/study-time`;
    const body = JSON.stringify({ seconds });
    if (useBeacon && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        url,
        new Blob([body], { type: "application/json" }),
      );
      if (sent) {
        return;
      }
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body,
      keepalive: useBeacon,
    }).catch(() => {
      if (activeLessonId === lessonId) {
        pendingSeconds += seconds;
      }
    });
  };

  const intervalId = window.setInterval(() => flush(false), flushIntervalMs);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush(true);
      lastTickAt = 0;
    } else if (activeLessonId) {
      lastTickAt = Date.now();
    }
  });
  window.addEventListener("pagehide", () => {
    flush(true);
    window.clearInterval(intervalId);
  });

  return {
    setLesson(lessonId) {
      const nextLessonId = lessonId ? String(lessonId) : null;
      if (activeLessonId === nextLessonId) {
        accrue();
        lastTickAt = canCount() ? Date.now() : 0;
        return;
      }
      if (activeLessonId && activeLessonId !== nextLessonId) {
        flush(true);
        pendingSeconds = 0;
      }
      activeLessonId = nextLessonId;
      lastTickAt = canCount() ? Date.now() : 0;
    },
    flush,
  };
}

async function requireSession() {
  let result;
  try {
    result = await apiFetch("/api/session");
  } catch (error) {
    keepStaticPage(error);
    clearUserProfile();
    return null;
  }
  if (!result.logged_in) {
    clearUserProfile();
    if (window.location.protocol !== "file:") {
      window.location.href = "/login";
    }
    return null;
  }
  cacheUserProfile(result.user);
  warmStudentApiCache(result.user);
  return result.user;
}

function readCachedUserProfile() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function cacheUserProfile(user) {
  try {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage errors silently.
  }
}

function applyUserProfile(user) {
  document.querySelectorAll("[data-user-name]").forEach((node) => {
    node.textContent = user.username;
  });
  document.querySelectorAll("[data-user-level]").forEach((node) => {
    const accessLabel = isTeacherUser(user) ? "" : user.access_expires_on ? `剩余 ${Number(user.access_remaining_days || 0)} 天` : "长期有效";
    node.textContent = [user.level_label, accessLabel].filter(Boolean).join(
      " · ",
    );
  });
  document.querySelectorAll("[data-user-stage]").forEach((node) => {
    node.textContent = `${user.stage} · ${user.grade}`;
  });
  document.querySelectorAll("[data-user-email]").forEach((node) => {
    node.textContent = user.email || `${user.username}@school.edu`;
  });
  document.querySelectorAll("[data-avatar-text]").forEach((node) => {
    node.textContent = user.avatar_text ||
      user.username.substring(0, 2).toUpperCase();
  });
}

function hydrateCachedUserProfile() {
  const cached = readCachedUserProfile();
  if (cached) {
    applyUserProfile(cached);
    document.body.classList.add("profile-ready");
    return;
  }
  clearUserProfile();
}

function setUserProfile(user) {
  applyUserProfile(user);
  cacheUserProfile(user);
  document.body.classList.add("profile-ready");
}

function clearUserProfile() {
  document.querySelectorAll(
    "[data-user-name], [data-user-level], [data-user-stage], [data-user-email], [data-avatar-text]",
  ).forEach((node) => {
    node.textContent = "";
  });
  try {
    sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Ignore storage errors silently.
  }
  document.body.classList.remove("profile-ready");
}

async function logout() {
  let redirect = "/login";
  try {
    const result = await apiFetch("/api/logout", { method: "POST" });
    redirect = result.redirect || redirect;
  } catch (error) {
    console.warn(error);
  }
  try {
    sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Ignore storage errors silently.
  }
  window.location.href = redirect;
}

function wireLogoutButton() {
  document
    .querySelectorAll(
      '#logout-button, [data-action="logout"], a[href="/api/logout"]',
    )
    .forEach((node) => {
      if (node.dataset.logoutBound === "1") {
        return;
      }
      node.dataset.logoutBound = "1";
      node.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await logout();
      }, { capture: true });
    });
}

function wireAvatarDropdown() {
  const avatarTrigger = document.getElementById("avatar-trigger");
  const avatarDropdown = document.getElementById("avatar-dropdown");
  if (
    !avatarTrigger || !avatarDropdown ||
    avatarTrigger.dataset.dropdownBound === "1"
  ) {
    return;
  }
  avatarTrigger.dataset.dropdownBound = "1";
  avatarTrigger.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="logout"]')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    avatarDropdown.classList.toggle("active");
  }, { capture: true });
  document.addEventListener("click", (event) => {
    if (!avatarTrigger.contains(event.target)) {
      avatarDropdown.classList.remove("active");
    }
  });
}

function normalizeNavigationPath(pathname) {
  if (pathname === "/") {
    return "/dashboard";
  }
  return pathname.endsWith(".html") ? pathname.slice(0, -5) : pathname;
}

const prefetchedPages = new Set();

function shouldPrefetchPage(url) {
  return url.origin === window.location.origin &&
    !url.pathname.includes(".") &&
    !url.pathname.startsWith("/api/") &&
    !prefetchedPages.has(url.href);
}

function prefetchPage(url) {
  if (!shouldPrefetchPage(url)) {
    return;
  }
  prefetchedPages.add(url.href);
  fetch(url.href, {
    credentials: "same-origin",
    cache: "force-cache",
    priority: "low",
  }).catch(() => {
    prefetchedPages.delete(url.href);
  });
}

function apiUrlForPage(url) {
  const map = {
    "/dashboard": "/api/dashboard",
    "/subjects": "/api/subjects",
    "/grade": "/api/subjects",
    "/mistakes": "/api/mistakes",
    "/growth": "/api/growth",
  };
  return map[url.pathname] || "";
}

function prefetchApiForPage(url) {
  const apiUrl = apiUrlForPage(url);
  if (!apiUrl) {
    return;
  }
  apiFetch(apiUrl, { cacheTtlMs: API_PREFETCH_CACHE_TTL_MS }).catch(() => {});
}

function scheduleBackgroundTask(task, delayMs = 0) {
  window.setTimeout(() => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => task(), { timeout: 2000 });
      return;
    }
    task();
  }, delayMs);
}

function studentCourseIds(subjectsResult) {
  return (subjectsResult?.data?.stages || []).flatMap((stage) => (stage.subjects || []).flatMap((subject) => (subject.courses || []).map((course) => course.id).filter(Boolean)));
}

function warmStudentApiCache(user) {
  if (!user || isTeacherUser(user)) {
    return;
  }
  ["/api/dashboard", "/api/mistakes", "/api/growth"].forEach((url, index) => {
    scheduleBackgroundTask(
      () =>
        apiFetch(url, { cacheTtlMs: API_PREFETCH_CACHE_TTL_MS }).catch(
          () => {},
        ),
      150 + index * 180,
    );
  });
  scheduleBackgroundTask(() => {
    apiFetch("/api/subjects", { cacheTtlMs: API_PREFETCH_CACHE_TTL_MS })
      .then((result) => {
        studentCourseIds(result).forEach((courseId, index) => {
          scheduleBackgroundTask(
            () =>
              apiFetch(`/api/course/${courseId}`, {
                cacheTtlMs: API_COURSE_CACHE_TTL_MS,
              }).catch(() => {}),
            300 + Math.floor(index / 2) * 350,
          );
        });
      })
      .catch(() => {});
  }, 250);
}

function prefetchCourseQuestionBanks(lessons = []) {
  lessons.forEach((lesson, index) => {
    if (!lesson?.id) {
      return;
    }
    scheduleBackgroundTask(
      () =>
        apiFetch(`/api/lessons/${lesson.id}/question-bank`, {
          cacheTtlMs: API_COURSE_CACHE_TTL_MS,
        }).catch(() => {}),
      250 + index * 250,
    );
  });
}

function navigationLabel(node, url) {
  const text = node.querySelector(".nav-label")?.textContent?.trim() ||
    node.textContent?.trim();
  if (text) {
    return text;
  }
  const fallback = {
    "/dashboard": "学习中心",
    "/subjects": "全部课程",
    "/mistakes": "智能错题本",
    "/growth": "成长轨迹",
    "/teacher": "老师管理",
  };
  return fallback[url.pathname] || "新页面";
}

function ensurePageTransition() {
  let transition = document.getElementById("page-transition");
  if (transition) {
    return transition;
  }
  transition = document.createElement("div");
  transition.id = "page-transition";
  transition.className = "page-transition";
  transition.innerHTML = `
    <div class="page-transition-panel">
      <div class="page-transition-mark"></div>
      <div>
        <p class="page-transition-kicker">内容加载中</p>
        <h2 class="page-transition-title" data-transition-title>学习空间</h2>
      </div>
    </div>
  `;
  document.body.appendChild(transition);
  return transition;
}

function startPageTransition(label) {
  try {
    sessionStorage.setItem(ROUTE_LOADING_LABEL_KEY, label);
  } catch {
    // Ignore storage errors silently.
  }
}

function wireNavigationTransitions() {
  if (window.location.protocol === "file:") {
    return;
  }
  document.querySelectorAll("a[href]").forEach((node) => {
    if (
      node.dataset.navTransitionBound === "1" ||
      node.dataset.action === "logout" ||
      node.dataset.samePageLessonNav === "1"
    ) {
      return;
    }
    node.dataset.navTransitionBound = "1";
    const prefetchTarget = () => {
      const rawHref = node.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) {
        return;
      }
      const url = new URL(rawHref, window.location.href);
      prefetchPage(url);
      prefetchApiForPage(url);
    };
    node.addEventListener("mouseenter", prefetchTarget, { once: true });
    node.addEventListener("touchstart", prefetchTarget, {
      once: true,
      passive: true,
    });
    node.addEventListener("focus", prefetchTarget, { once: true });
    node.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        node.target === "_blank"
      ) {
        return;
      }
      const rawHref = node.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) {
        return;
      }
      const url = new URL(rawHref, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname.startsWith("/api/")
      ) {
        return;
      }
      const targetIdentity = `${normalizeNavigationPath(url.pathname)}${url.search}${url.hash}`;
      const currentIdentity = `${normalizeNavigationPath(window.location.pathname)}${window.location.search}${window.location.hash}`;
      if (targetIdentity === currentIdentity) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      if (document.body.dataset.navigating === "1") {
        return;
      }
      document.body.dataset.navigating = "1";
      startPageTransition(navigationLabel(node, url));
      window.location.href = `${url.pathname}${url.search}${url.hash}`;
    });
  });
}

function setupMotionSystem() {
  const motionSelector = [
    ".hero-card",
    ".subjects-hero-card",
    ".growth-header",
    ".dashboard-grid-top > *",
    ".dashboard-grid-main > *",
    ".growth-stats-grid > *",
    ".growth-rule-grid > *",
    ".course-outline-list > *",
    ".knowledge-map-list > *",
    ".growth-rule-list > *",
    ".growth-activity-list > *",
    ".stage-panel",
    ".subject-column",
    ".subject-course-item",
    ".card",
    ".course-summary-card",
    ".course-outline-card",
    ".knowledge-map-card",
    ".knowledge-node-card",
    ".timeline-item",
    ".mistake-box",
    ".growth-ai-hero",
    ".growth-stat-card",
    ".growth-rule-item",
    ".growth-activity-item",
    ".login-container",
    ".login-headline",
    ".premium-card",
    ".form-group",
  ].join(",");

  const reveal = (node, index = 0) => {
    if (!(node instanceof HTMLElement) || node.dataset.motionReady === "1") {
      return;
    }
    node.dataset.motionReady = "1";
    node.style.setProperty("--motion-delay", `${Math.min(index, 14) * 44}ms`);
    node.classList.add("motion-item");
    node.classList.add("is-visible");
  };

  const motionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          motionObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -36px" },
  );

  const collectMotionNodes = (root = document) => {
    const nodes = [];
    if (root instanceof HTMLElement && root.matches(motionSelector)) {
      nodes.push(root);
    }
    root.querySelectorAll?.(motionSelector).forEach((node) => nodes.push(node));
    return [...new Set(nodes)].sort((a, b) => {
      if (a === b) {
        return 0;
      }
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  };

  const scan = (root = document) => {
    collectMotionNodes(root).forEach((node, index) => reveal(node, index));
  };

  scan(document);
  let scanFrame = 0;
  const pendingScanRoots = new Set();
  const scheduleScan = (root) => {
    pendingScanRoots.add(root);
    if (scanFrame) {
      return;
    }
    scanFrame = window.requestAnimationFrame(() => {
      const nodes = [];
      pendingScanRoots.forEach((pendingRoot) => {
        nodes.push(...collectMotionNodes(pendingRoot));
      });
      [...new Set(nodes)]
        .sort((a, b) => {
          if (a === b) {
            return 0;
          }
          return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        })
        .forEach((node, index) => reveal(node, index));
      pendingScanRoots.clear();
      scanFrame = 0;
    });
  };

  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          scheduleScan(node);
        }
      });
    });
  });
  mutationObserver.observe(
    document.querySelector(".content") || document.body,
    { childList: true, subtree: true },
  );

  let pointerFrame = 0;
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  document.addEventListener(
    "pointermove",
    (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerFrame) {
        return;
      }
      pointerFrame = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty(
          "--pointer-x",
          `${pointerX}px`,
        );
        document.documentElement.style.setProperty(
          "--pointer-y",
          `${pointerY}px`,
        );
        pointerFrame = 0;
      });
    },
    { passive: true },
  );
}

async function initLoginPage() {
  const form = document.getElementById("login-form");
  const errorBox = document.getElementById("login-error");
  if (!form || !errorBox) {
    return;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";
    errorBox.className = "feedback-box";
    const payload = {
      username: document.getElementById("login-username").value.trim(),
      password: document.getElementById("login-password").value.trim(),
    };
    try {
      const result = await apiFetch("/api/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.user) {
        cacheUserProfile(result.user);
      }
      window.location.href = result.redirect;
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.className = "feedback-box is-error";
    }
  });
}

async function initWelcomePage() {
  const user = await requireSession();
  if (!user) {
    return;
  }
  setUserProfile(user);
  wireLogoutButton();
  const result = await apiFetch("/api/welcome");
  const root = document.getElementById("welcome-cards");
  if (!root) {
    return;
  }
  root.innerHTML = result.data.cards
    .map(
      (item) => `
        <article class="card">
          <p class="stat-label">${item.label}</p>
          <p class="stat-value">${item.value}</p>
        </article>
      `,
    )
    .join("");
}

function currentLoadingLabel() {
  try {
    const nextLabel = sessionStorage.getItem(ROUTE_LOADING_LABEL_KEY);
    if (nextLabel) {
      return nextLabel;
    }
  } catch {
    // Ignore storage errors silently.
  }
  const labels = {
    dashboard: "学习中心",
    subjects: "全部课程",
    mistakes: "智能错题本",
    growth: "成长轨迹",
    teacher: "老师管理",
    grade: "年级课程",
    course: "课程内容",
    "question-bank": "智能练习",
  };
  return labels[document.body.dataset.page] || "当前页面";
}

let pageLoadingTimer = 0;

function setPageLoading(isLoading, label = "") {
  document.body.classList.toggle("is-data-loading", Boolean(isLoading));
  const transition = ensurePageTransition();
  const title = transition.querySelector("[data-transition-title]");
  window.clearTimeout(pageLoadingTimer);
  if (isLoading) {
    if (title) {
      title.textContent = label || currentLoadingLabel();
    }
    pageLoadingTimer = window.setTimeout(() => {
      document.body.classList.add("is-route-transitioning");
      transition.classList.add("is-active");
    }, 100);
    return;
  }
  transition.classList.remove("is-active");
  document.body.classList.remove("is-route-transitioning");
  try {
    sessionStorage.removeItem(ROUTE_LOADING_LABEL_KEY);
  } catch {
    // Ignore storage errors silently.
  }
}

function wirePasswordToggles(root = document) {
  root.querySelectorAll("[data-toggle-password]").forEach((button) => {
    if (button.dataset.passwordToggleBound === "1") {
      return;
    }
    button.dataset.passwordToggleBound = "1";
    button.addEventListener("click", () => {
      const field = button.closest(".password-field");
      const input = field?.querySelector(
        'input[type="password"], input[type="text"]',
      );
      if (!input) {
        return;
      }
      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      button.setAttribute("aria-label", shouldShow ? "隐藏密码" : "显示密码");
      const icon = button.querySelector("[aria-hidden='true']");
      if (icon) {
        icon.textContent = shouldShow ? "◎" : "👁";
      }
    });
  });
}

async function initDashboardPage() {
  setPageLoading(true);
  const user = await requireSession();
  if (!user) {
    setPageLoading(false);
    return;
  }
  setUserProfile(user);
  wireLogoutButton();

  let result;
  try {
    result = await apiFetch("/api/dashboard", {
      cacheTtlMs: API_PREFETCH_CACHE_TTL_MS,
    });
  } catch (error) {
    setPageLoading(false);
    keepStaticPage(error);
    return;
  }
  const { progress, mistakes, summary, stages = [] } = result.data;

  const heroPill = document.getElementById("dashboard-hero-pill");
  const heroTitle = document.getElementById("dashboard-hero-title");
  const heroDesc = document.getElementById("dashboard-hero-desc");
  const accessStatus = document.getElementById("dashboard-access-status");
  const studyDays = document.getElementById("dashboard-study-days");
  const levelProgress = document.getElementById("dashboard-level-progress");
  const xpSummary = document.getElementById("dashboard-xp-summary");
  const achievementLabel = document.getElementById(
    "dashboard-achievement-label",
  );

  if (summary) {
    if (heroPill) {
      heroPill.textContent = summary.hero_pill;
    }
    if (heroTitle) {
      const focusCount = (summary.review_count || 0) +
        (summary.mistake_count || 0);
      if (focusCount > 0) {
        heroTitle.innerHTML = `今天有 <span>${escapeHtml(summary.hero_highlight)}</span> ${escapeHtml(summary.hero_suffix)}`;
      } else if (summary.completed_count > 0) {
        heroTitle.innerHTML = `当前账号已掌握 <span>${escapeHtml(summary.hero_highlight)}</span>`;
      } else {
        heroTitle.innerHTML = `<span>${escapeHtml(summary.hero_highlight)}</span> ${escapeHtml(summary.hero_suffix)}`;
      }
    }
    if (heroDesc) {
      heroDesc.textContent = summary.hero_desc;
    }
    if (studyDays) {
      studyDays.innerHTML = `${summary.study_days || 0}<small>天</small>`;
    }
    if (achievementLabel) {
      achievementLabel.textContent = "当前账号累计学习";
    }
    if (levelProgress) {
      levelProgress.style.width = `${Math.max(0, Math.min(100, summary.level_progress || 0))}%`;
    }
    if (xpSummary) {
      xpSummary.textContent = `当前账号学力值 ${summary.xp || 0} XP，距离下一个等级还差 ${summary.next_level_gap || 0} XP`;
    }
  }
  if (accessStatus) {
    accessStatus.textContent = user.access_expires_on ? `账号有效至 ${user.access_expires_on}，剩余 ${Number(user.access_remaining_days || 0)} 个自然日` : "账号使用期限：长期有效";
  }

  const timelineRoot = document.getElementById("dashboard-timeline");
  if (timelineRoot) {
    timelineRoot.innerHTML = progress.length === 0 ? '<div class="timeline-item"><div class="timeline-content"><p class="muted compact-empty-text">今天没有到期重刷的知识点。系统会按记忆曲线安排复习，不会把所有题目一次性推给学生。</p></div></div>' : progress.map((item, index) => {
      const isUrgent = index === 0;
      const dotLabel = isUrgent ? "急" : "中";
      const toneClass = isUrgent ? "is-urgent" : "is-normal";
      return `
            <div class="timeline-item">
              <div class="timeline-dot ${toneClass}">${dotLabel}</div>
              <div class="timeline-content ${isUrgent ? "is-urgent" : ""}">
                <div class="timeline-meta"><span class="timeline-status ${toneClass}">状态：${escapeHtml(item.status)}</span><span class="mini-chip timeline-score-chip ${toneClass}">得分 ${item.score}</span></div>
                <h3 class="timeline-title">${escapeHtml(item.lesson_title)} (${escapeHtml(item.course_title)})</h3>
                <p class="muted timeline-reason">${escapeHtml(item.review_reason || "按记忆曲线安排复习。")}</p>
                <p class="muted timeline-date">最后学习：${escapeHtml(item.updated_at)}</p>
                ${item.course_id && item.lesson_id ? `<a class="${isUrgent ? "secondary-btn" : "ghost-btn"} timeline-review-button ${isUrgent ? "is-urgent" : ""}" href="${escapeHtml(buildLessonHref(item.course_id, item.lesson_id))}">立即复习</a>` : `<button class="${isUrgent ? "secondary-btn" : "ghost-btn"} timeline-review-button ${isUrgent ? "is-urgent" : ""}" type="button" disabled>立即复习</button>`}
              </div>
            </div>
          `;
    }).join("");
  }

  const mistakeRoot = document.getElementById("dashboard-mistake");
  const mistakeCount = document.getElementById("dashboard-mistake-count");
  if (mistakeCount) {
    mistakeCount.textContent = `${mistakes.length} 待攻克`;
  }
  if (mistakeRoot) {
    if (mistakes.length === 0) {
      mistakeRoot.innerHTML = '<p class="muted compact-empty-text">太棒了，当前没有错题！</p>';
    } else {
      const renderMistakeItem = (item) => `
        <div class="dashboard-mistake-item">
          <div class="row-between">
            <span class="mini-chip chip-soft">${escapeHtml(item.subject)}</span>
            <span class="muted text-xs">${escapeHtml(item.created_at)}</span>
          </div>
          <p class="muted mistake-context-text">${escapeHtml(item.course_title)} / ${escapeHtml(item.lesson_title)}</p>
          <p class="mistake-question-preview">${escapeHtml(item.question_text)}</p>
          ${renderMistakeReviewAction(item)}
        </div>
      `;
      const visibleMistakes = mistakes.slice(0, 3).map(renderMistakeItem).join(
        "",
      );
      const hiddenMistakes = mistakes.slice(3).map(renderMistakeItem).join("");
      mistakeRoot.innerHTML = `
        <div class="dashboard-mistake-list">${visibleMistakes}</div>
        ${mistakes.length > 3 ? `<details class="dashboard-mistake-more"><summary>展开其余 ${mistakes.length - 3} 道错题</summary>${hiddenMistakes}</details>` : ""}
      `;
      wireNavigationTransitions();
    }
  }

  const courseRoot = document.getElementById("dashboard-courses");
  if (courseRoot) {
    const purchasedCourses = stages.flatMap((stage) => (stage.courses || []).map((course) => ({ ...course, stage: stage.stage })));
    const purchasedSubjects = [
      ...purchasedCourses
        .reduce((groups, course) => {
          const key = `${course.stage}||${course.subject}`;
          if (!groups.has(key)) {
            groups.set(key, {
              key,
              stage: course.stage,
              subject: course.subject,
              entryCourseId: course.id,
            });
          }
          return groups;
        }, new Map())
        .values(),
    ];
    courseRoot.innerHTML = purchasedSubjects.length === 0
      ? `
          <div class="subject-empty">
            <p>当前学生还没有开通课程。请用老师账号进入“老师管理”，为学生勾选已购买科目。</p>
          </div>
        `
      : purchasedSubjects.map((subject) => `
          <a class="course-card open-course dashboard-course-card" href="/course?id=${subject.entryCourseId}">
            <div class="course-head">
              <div class="course-icon dashboard-course-icon">${escapeHtml(subject.subject.slice(0, 1))}</div>
              <div>
                <p class="course-meta">${escapeHtml(subject.stage)}</p>
                <h3>${escapeHtml(subject.subject)}</h3>
              </div>
            </div>
            <span class="subject-enter-chip dashboard-course-chip">进入学习 <span aria-hidden="true">→</span></span>
          </a>
        `).join("");
    wireNavigationTransitions();
  }
  setPageLoading(false);
}

function renderLessonContent(lesson) {
  document.getElementById("lesson-title").textContent = `${lesson.order}. ${lesson.title}`;
  document.getElementById("lesson-status").textContent = `状态：${lesson.status}，当前得分：${lesson.score}`;
  document.getElementById("lesson-content").textContent = lesson.content;

  const audio = document.getElementById("lesson-audio");
  if (lesson.audio_url) {
    audio.src = lesson.audio_url;
    audio.style.display = "block";
  } else {
    audio.removeAttribute("src");
    audio.style.display = "none";
  }

  document.getElementById("questions-root").innerHTML = lesson.questions
    .map(
      (question) => `
        <article class="question-card" data-question-id="${question.id}">
          <h4>${escapeHtml(question.question)}</h4>
          <div class="question-options">
            ${
        question.options
          .map(
            (option) => `
                  <label class="question-option">
                    <input type="radio" name="question-${question.id}" value="${escapeHtml(option)}">
                    <span>${escapeHtml(option)}</span>
                  </label>
                `,
          )
          .join("")
      }
          </div>
          <div class="question-action-row">
            <button class="primary-button submit-question" type="button">提交答案</button>
          </div>
          <div class="question-result"></div>
        </article>
      `,
    )
    .join("");
}

function cleanLearningLine(line) {
  return String(line || "")
    .replace(/^[-*]\s+/, "")
    .replace(/^类型：/, "")
    .replace(/^核对结论：/, "")
    .trim();
}

function parseLearningSections(content) {
  const sections = new Map();
  let currentTitle = "教材提示";
  const pushLine = (title, line) => {
    if (!sections.has(title)) {
      sections.set(title, []);
    }
    sections.get(title).push(line);
  };

  String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        if (heading[1].length === 1) {
          return;
        }
        currentTitle = heading[2].trim();
        if (!sections.has(currentTitle)) {
          sections.set(currentTitle, []);
        }
        return;
      }
      pushLine(currentTitle, line);
    });

  return sections;
}

function sectionLines(sections, names) {
  return names
    .flatMap((name) => sections.get(name) || [])
    .map(cleanLearningLine)
    .filter(Boolean)
    .filter((line) => !line.includes("不是原始目录文字") && !line.includes("可以单独讲解"));
}

function renderLearningList(items, fallback) {
  const list = items.length ? items : fallback;
  return `
    <ul class="learning-point-list">
      ${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function uniqueLearningItems(items) {
  const seen = new Set();
  return items
    .map((item) => cleanLearningLine(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.replace(/\s+/g, "");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function buildTeachingBlocks(course, lesson, focus, sections) {
  const title = lesson.title || "本知识点";
  const subject = course.subject || "";
  const standardLines = sectionLines(sections, ["达标标准"]);
  const subjectBlocks = {
    "数学": {
      textbookLens: `把“${title}”放回课本例题看：先分清对象、条件和要求，再决定用概念、运算、图形还是方程表达关系。`,
      method: "做题时按“读题标量 -> 建立关系 -> 写出过程 -> 回到题意验算”推进。",
      transfer: "如果题目换了数字、图形或情境，只要数量关系没有变，方法就可以迁移。",
    },
    "语文": {
      textbookLens: `把“${title}”放回课文和单元任务看：先读懂文本内容，再抓关键词句、结构和表达效果。`,
      method: "答题时用“观点 -> 原文证据 -> 作用分析”组织，不停留在感受词。",
      transfer: "同类阅读题可以迁移到人物、景物、情感、结构和语言赏析。",
    },
    "英语": {
      textbookLens: `把“${title}”放回课本语篇和对话看：词汇、句型、语音和场景要一起理解。`,
      method: "先听读，再替换人物、地点、动作造句，最后回到阅读或写作任务。",
      transfer: "换一个场景仍能听懂、会说、能读写，才算真正掌握。",
    },
    "物理": {
      textbookLens: `把“${title}”放回教材现象、实验和图示看：先确定研究对象、过程、方向和单位。`,
      method: "做题先画图或列物理量，再判断规律适用条件，最后代入计算。",
      transfer: "情境变化时优先看模型是否相同，而不是只找相似数字。",
    },
    "化学": {
      textbookLens: `把“${title}”放回教材实验和物质变化看：宏观现象、微观粒子和符号表达要对应。`,
      method: "先写清物质、条件、现象和结论，再处理方程式、化合价或结构关系。",
      transfer: "换一种物质或实验装置时，用组成、结构、性质、变化四条线索判断。",
    },
    "生物": {
      textbookLens: `把“${title}”放回教材图示、观察和实验看：核心是结构、功能和证据之间的关系。`,
      method: "先确认结构或过程，再说明功能，实验题还要抓变量、对照和结论。",
      transfer: "遇到新材料时，用“结构 -> 功能 -> 生命现象”的链条解释。",
    },
  };
  const block = subjectBlocks[subject] || {
    textbookLens: `把“${title}”放回教材材料看：先读懂原文、图示或例题，再提炼概念和方法。`,
    method: "做题前先明确任务、条件和依据，做完后用教材方法检查。",
    transfer: "换一个题目时，先找相同的知识关系，再迁移方法。",
  };
  return uniqueLearningItems([
    block.textbookLens,
    focus.keyQuestion,
    focus.firstMove,
    block.method,
    focus.thinkingTool,
    block.transfer,
    ...standardLines.slice(0, 2),
  ]);
}

function buildSubjectFocus(course, lesson) {
  const subject = course.subject || "";
  const title = lesson.title || "";
  const text = `${subject} ${title}`;
  const base = {
    keyQuestion: `这个知识点到底解决哪一类问题？`,
    firstMove: "先找教材中的例子或图示，再把关键词圈出来。",
    thinkingTool: "用自己的话复述概念，再立刻做一道同类小题验证。",
    practiceCue: "右侧练习先独立判断，再看解析修正思路。",
  };
  const rules = [
    {
      match: () => subject === "数学" && /分数/.test(text),
      value: {
        keyQuestion: "这里是不是在平均分？分母、分子分别表示什么？",
        firstMove: "先画图或想实物平均分，再写分数，避免只背读法。",
        thinkingTool: "把“总份数、取的份数、整体”三件事同时说清。",
        practiceCue: "做题时先判断整体是谁，再判断平均分成几份。",
      },
    },
    {
      match: () => subject === "数学" && /周长|长方形|正方形|面积|图形/.test(text),
      value: {
        keyQuestion: "题目要求的是边界长度、格子数量，还是边与边的关系？",
        firstMove: "先在图上标边、补全隐藏边，再列式。",
        thinkingTool: "用“哪些边被算了、哪些边漏了”检查答案。",
        practiceCue: "看到组合图形时先拆图或补图，不要直接把数字全加。",
      },
    },
    {
      match: () => subject === "数学" && /倍|乘法|除法|数量关系/.test(text),
      value: {
        keyQuestion: "谁和谁在比较？一个量里包含几个同样多？",
        firstMove: "先写出标准量和比较量，再决定用乘法还是除法。",
        thinkingTool: "用线段图把“几倍”关系画出来。",
        practiceCue: "答案出来后回代到题意，看比较关系是否成立。",
      },
    },
    {
      match: () => subject === "数学" && /集合|函数|向量|导数|数列|概率|三角/.test(text),
      value: {
        keyQuestion: "定义、限制条件和运算规则分别是什么？",
        firstMove: "先写定义域、对象或图像特征，再套方法。",
        thinkingTool: "把文字、符号、图像三种表示互相翻译。",
        practiceCue: "每一步变形都检查条件范围，尤其是等号、符号和边界。",
      },
    },
    {
      match: () => subject === "语文",
      value: {
        keyQuestion: "作者写这段文字是为了表现什么，证据在哪里？",
        firstMove: "先找关键句和段落关系，再谈人物、情感或表达效果。",
        thinkingTool: "回答时采用“观点 + 文本证据 + 我的解释”。",
        practiceCue: "不要只写感受，至少回到一句原文或一个细节。",
      },
    },
    {
      match: () => subject === "英语",
      value: {
        keyQuestion: "这个词/句型在什么场景里使用？它表达什么真实意思？",
        firstMove: "先跟读关键词和句型，再放进对话或短文理解。",
        thinkingTool: "把中文意思、英文表达和使用场景连在一起。",
        practiceCue: "做题后试着用同一句型替换人物、地点或动作。",
      },
    },
    {
      match: () => subject === "物理",
      value: {
        keyQuestion: "研究对象是谁？过程、方向、单位和条件是什么？",
        firstMove: "先画图或列物理量，再选公式。",
        thinkingTool: "把现象翻译成模型：受力、运动、电路或能量变化。",
        practiceCue: "代入前先检查单位和方向，不能只看数字。",
      },
    },
    {
      match: () => subject === "化学",
      value: {
        keyQuestion: "这里讨论的是组成、结构、性质，还是变化过程？",
        firstMove: "先写物质和变化，再看粒子、化合价或实验现象。",
        thinkingTool: "用“宏观现象 + 微观解释 + 符号表达”连起来。",
        practiceCue: "方程式、条件、现象和结论要互相对应。",
      },
    },
    {
      match: () => subject === "生物",
      value: {
        keyQuestion: "结构如何支持功能？证据来自观察、实验还是比较？",
        firstMove: "先看图示或实验材料，再建立结构与功能的对应。",
        thinkingTool: "用“结构 -> 功能 -> 生命现象”解释。",
        practiceCue: "实验题重点看变量、对照和结论是否对应。",
      },
    },
  ];
  return rules.find((rule) => rule.match())?.value || base;
}

function renderLessonFigure(lesson) {
  if (lesson.figureLoading) {
    return `
      <div class="textbook-page-figure is-loading" data-lesson-figure>
        <div class="textbook-page-loading">正在匹配教材原页...</div>
      </div>
    `;
  }
  if (!lesson.figure_url) {
    return "";
  }
  const pageLabel = lesson.source_page ? `教材第 ${lesson.source_page} 页附近` : "教材原页";
  return `
    <figure class="textbook-page-figure">
      <div class="textbook-page-frame">
        <img src="${escapeHtml(lesson.figure_url)}" alt="${escapeHtml(pageLabel)}" loading="lazy">
      </div>
      <figcaption>${escapeHtml(pageLabel)}。先看图、例题或栏目，再回到讲解区整理方法。</figcaption>
    </figure>
  `;
}

function renderQuestionSourceFigure(question) {
  if (!question?.figure_url) {
    return "";
  }
  const label = question.source_page ? `题库第 ${question.source_page} 页` : "题库原页";
  return `
    <figure class="question-source-figure">
      <div class="question-source-frame">
        <img src="${escapeHtml(question.figure_url)}" alt="${escapeHtml(label)}" loading="lazy">
      </div>
      <figcaption>${escapeHtml(label)}。本页来自练习资料，完成后复盘。</figcaption>
    </figure>
  `;
}

function renderPracticeQuestionCard(
  question,
  index,
  scopeId,
  sourcePrefix = "第",
  cardClass = "",
) {
  const options = Array.isArray(question.options) ? question.options : [];
  const questionName = `${scopeId}-question-${question.id}`;
  const sourceLabel = question.source_label ||
    `${sourcePrefix} ${index + 1} 题`;
  return `
    <article
      class="practice-question-card ${cardClass}"
      data-question-id="${question.id}"
      data-correct-answer="${escapeHtml(question.answer || "")}"
      data-explanation="${escapeHtml(question.explanation || "暂无解析。")}"
      data-submitted="0"
    >
      <div class="practice-question-topline">
        <p class="question-source-label">${escapeHtml(sourceLabel)}</p>
        <span>第 ${index + 1} 题</span>
      </div>
      <h4 class="lesson-question-title">${escapeHtml(question.question)}</h4>
      ${renderQuestionSourceFigure(question)}
      <div class="question-options" role="radiogroup" aria-label="${escapeHtml(sourceLabel)}">
        ${
    options.map((option, optionIndex) => `
          <label class="question-option">
            <input type="radio" name="${escapeHtml(questionName)}" value="${escapeHtml(option)}">
            <span class="question-option-mark">${String.fromCharCode(65 + optionIndex)}</span>
            <span class="question-option-text">${escapeHtml(option)}</span>
          </label>
        `).join("")
  }
      </div>
      <div class="lesson-question-actions">
        <button class="primary-button submit-question" type="button" data-action="submit-question" disabled>提交本题</button>
        <span class="question-result is-info">请选择一个答案。</span>
      </div>
      <div class="feedback-box lesson-answer-box answer-review-box is-hidden" data-answer-review>
        <p><strong>正确答案：</strong><span data-review-answer>${escapeHtml(question.answer || "暂无答案")}</span></p>
        <p><strong>解析：</strong><span data-review-explanation>${escapeHtml(question.explanation || "暂无解析。")}</span></p>
      </div>
    </article>
  `;
}

function renderPracticeSession({
  questions,
  scopeId,
  title,
  kicker = "PRACTICE",
  description = "先独立选择答案，提交后继续下一题，最后统一对答案。",
  className = "",
  sourcePrefix = "第",
  cardClass = "",
}) {
  if (!questions.length) {
    return "";
  }
  return `
    <section class="question-bank-panel practice-session ${className}" data-practice-scope="${escapeHtml(scopeId)}">
      <div class="practice-session-head">
        <div>
          <p class="practice-kicker">${escapeHtml(kicker)}</p>
          <h2>${escapeHtml(title)}</h2>
          <span>${escapeHtml(description)}</span>
        </div>
        <div class="practice-session-meter">
          <strong data-practice-meter>已提交 0/${questions.length}</strong>
          <div class="practice-session-track"><div data-practice-progress-fill></div></div>
        </div>
      </div>
      <div class="practice-session-summary is-hidden" data-practice-summary></div>
      <div class="lesson-practice-list">
        ${
    questions.map((question, index) =>
      renderPracticeQuestionCard(
        question,
        index,
        scopeId,
        sourcePrefix,
        cardClass,
      )
    ).join("")
  }
      </div>
      <div class="practice-session-footer">
        <span data-practice-hint>先选择答案并提交，解析会在对答案后出现。</span>
        <button class="primary-button practice-review-button" type="button" data-action="review-answers" disabled>对答案</button>
      </div>
    </section>
  `;
}

function renderLessonPracticeQuestions(lesson) {
  const questions = (lesson.questions || []).filter((question) => question.kind !== "bank");
  if (!questions.length) {
    return "";
  }
  return renderPracticeSession({
    questions,
    scopeId: `lesson-${lesson.id}`,
    title: "随堂选择题",
    kicker: "CLASS CHECK",
    description: "学完正文后做一组小题。先提交每题，最后统一对答案。",
    className: "lesson-inline-practice",
    sourcePrefix: "随堂第",
  });
}

async function loadLessonFigure(lesson, courseId, onReady) {
  if (!lesson || lesson.figureResolved || lesson.figureLoading) {
    return;
  }
  lesson.figureLoading = true;
  try {
    const result = await apiFetch(`/api/lessons/${lesson.id}/figure`);
    lesson.source_page = result.data?.source_page || null;
    lesson.figure_url = result.data?.figure_url || null;
  } catch (error) {
    console.warn(error);
    lesson.source_page = null;
    lesson.figure_url = null;
  } finally {
    lesson.figureLoading = false;
    lesson.figureResolved = true;
    if (typeof onReady === "function") {
      onReady(lesson, courseId);
    }
  }
}

function encodeResourceKey(key) {
  return String(key || "")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function lessonResourceUrl(lesson, relativePath) {
  const baseKey = String(lesson?.resource_key || "").trim();
  const rawPath = String(relativePath || "").trim();
  if (!baseKey || !rawPath || rawPath.includes("://")) {
    return "";
  }
  const parts = [];
  `${baseKey}/${rawPath}`.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") {
      parts.pop();
      return;
    }
    parts.push(part);
  });
  return `/api/resources/${encodeResourceKey(parts.join("/"))}`;
}

function renderLearningLineWithMedia(cleaned, lesson) {
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches = [...cleaned.matchAll(imagePattern)];
  if (!matches.length) {
    return `<p>${escapeHtml(cleaned)}</p>`;
  }

  const parts = [];
  let lastIndex = 0;
  matches.forEach((match) => {
    const textPart = cleaned.slice(lastIndex, match.index).trim();
    if (textPart) {
      parts.push(
        `<span class="lesson-media-text">${escapeHtml(textPart)}</span>`,
      );
    }
    const src = lessonResourceUrl(lesson, match[2]);
    if (src) {
      const alt = match[1] || "资料图片";
      parts.push(`
        <figure class="lesson-inline-media">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">
          <figcaption>${escapeHtml(alt)}</figcaption>
        </figure>
      `);
    } else {
      parts.push(
        `<span class="lesson-media-text">${escapeHtml(match[0])}</span>`,
      );
    }
    lastIndex = Number(match.index) + match[0].length;
  });

  const trailingText = cleaned.slice(lastIndex).trim();
  if (trailingText) {
    parts.push(
      `<span class="lesson-media-text">${escapeHtml(trailingText)}</span>`,
    );
  }
  return `<div class="lesson-media-line">${parts.join("")}</div>`;
}

function isMaterialSectionHeading(line) {
  return /^[一二三四五六七八九十]+[\.．、]\s*\S+/.test(line) ||
    /^(核心知识点|能力\/方法|实验\/探究|题库样例|来源|题库安排|本节资料|学习目标|重点难点)$/
      .test(
        String(line || "").trim(),
      );
}

function isQuestionStart(line) {
  return /^\d+[\.．、]\s*/.test(line);
}

function renderOptionLine(line) {
  const markerPattern = /([A-H][\.．、])\s*/g;
  const matches = [...line.matchAll(markerPattern)];
  if (!matches.length || (matches.length === 1 && matches[0].index !== 0)) {
    return "";
  }

  const options = [];
  matches.forEach((match, index) => {
    const start = Number(match.index);
    const end = index + 1 < matches.length ? Number(matches[index + 1].index) : line.length;
    const optionText = line.slice(start, end).trim();
    if (optionText) {
      options.push(optionText);
    }
  });
  if (!options.length) {
    return "";
  }
  return `
    <div class="exercise-options-row">
      ${options.map((option) => `<button class="exercise-option-choice" type="button" aria-pressed="false">${escapeHtml(option)}</button>`).join("")}
    </div>
  `;
}

function renderMaterialTable(rows) {
  if (!rows.length) {
    return "";
  }
  return `
    <div class="material-table-wrap">
      <table class="material-table">
        <tbody>
          ${
    rows.map((row) => `
            <tr>
              ${
      row.split("|").map((cell) => `<td>${escapeHtml(cell.trim())}</td>`).join(
        "",
      )
    }
            </tr>
          `).join("")
  }
        </tbody>
      </table>
    </div>
  `;
}

function renderMaterialLines(lines, lesson) {
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    const cleaned = lines[index].replace(/^[-*]\s*/, "").trim();
    if (!cleaned) {
      continue;
    }
    if (cleaned === "[表格开始]") {
      const rows = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "[表格结束]") {
        const row = lines[index].trim();
        if (row) rows.push(row);
        index += 1;
      }
      output.push(renderMaterialTable(rows));
      continue;
    }

    const optionHtml = renderOptionLine(cleaned);
    if (optionHtml) {
      output.push(optionHtml);
      continue;
    }
    output.push(renderLearningLineWithMedia(cleaned, lesson));
  }
  return output.join("");
}

function buildMaterialBlocks(lines) {
  const blocks = [];
  let activeQuestion = null;

  const closeQuestion = () => {
    if (activeQuestion) {
      blocks.push(activeQuestion);
      activeQuestion = null;
    }
  };

  lines
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .forEach((line) => {
      if (isMaterialSectionHeading(line)) {
        closeQuestion();
        blocks.push({ type: "section", title: line });
        return;
      }
      if (isQuestionStart(line)) {
        closeQuestion();
        activeQuestion = { type: "question", title: line, lines: [] };
        return;
      }
      if (activeQuestion) {
        activeQuestion.lines.push(line);
        return;
      }
      blocks.push({ type: "line", lines: [line] });
    });
  closeQuestion();
  return blocks;
}

function renderMaterialBlocks(lines, lesson) {
  if (!lines.length) {
    return '<p class="muted lesson-empty-text">本节资料内容还没有生成。</p>';
  }
  return buildMaterialBlocks(lines)
    .map((block) => {
      if (block.type === "section") {
        return `<h3 class="material-section-title">${escapeHtml(block.title)}</h3>`;
      }
      if (block.type === "question") {
        return `
          <article class="material-question-block">
            <p class="material-question-title">${escapeHtml(block.title)}</p>
            <div class="material-question-body">
              ${renderMaterialLines(block.lines, lesson)}
            </div>
          </article>
        `;
      }
      return `<div class="material-intro-line">${renderMaterialLines(block.lines, lesson)}</div>`;
    })
    .join("");
}

function renderLearningContent(lesson, course) {
  const sections = parseLearningSections(lesson.content);
  const sourceLines = sectionLines(sections, ["来源"]);
  const materialLines = sectionLines(sections, ["资料正文"]);
  const fallbackLines = String(lesson.content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#\s+/.test(line))
    .map((line) => line.replace(/^#{2,6}\s+/, ""))
    .filter(Boolean);
  const visibleLines = materialLines.length ? materialLines : fallbackLines;
  const bankLines = sectionLines(sections, ["题库安排"]);

  return `
    <section class="study-paper">
      <div class="study-paper-head">
        <h3>${escapeHtml(lesson.title)}</h3>
        <span>${escapeHtml(course.grade || "")} / ${escapeHtml(course.subject || "")}</span>
      </div>
      <div class="study-source-line">
        ${sourceLines.slice(0, 1).map((line) => `<span>${escapeHtml(line.replace(/^[-*]\s*/, ""))}</span>`).join("")}
      </div>
      <div class="study-material-body">
        ${renderMaterialBlocks(visibleLines, lesson)}
      </div>
      ${renderLessonPracticeQuestions(lesson)}
      <div class="study-footnote">
        ${bankLines.slice(0, 1).map((line) => `<p>${escapeHtml(line.replace(/^[-*]\s*/, ""))}</p>`).join("")}
      </div>
    </section>
  `;
}

function formatStudyDuration(secondsOrMinutes, unit = "seconds") {
  const minutes = unit === "minutes" ? Math.max(0, Math.round(Number(secondsOrMinutes || 0))) : Math.max(0, Math.round(Number(secondsOrMinutes || 0) / 60));
  if (minutes <= 0 && Number(secondsOrMinutes || 0) > 0) {
    return "<1 分钟";
  }
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function lessonBankCount(lesson) {
  if (typeof lesson?.bank_question_count === "number") {
    return lesson.bank_question_count || lessonTextbookCount(lesson);
  }
  const bankQuestions = (lesson?.questions || []).filter((question) => question.kind === "bank");
  return bankQuestions.length || lessonTextbookCount(lesson);
}

function lessonTextbookCount(lesson) {
  if (typeof lesson?.textbook_question_count === "number") {
    return lesson.textbook_question_count;
  }
  return (lesson?.questions || []).filter((question) => question.kind !== "bank").length;
}

function buildLessonCoachAdvice(data, lesson) {
  const profile = data.learner_profile || {};
  const course = data.course || {};
  const status = lessonStatus(lesson.status);
  const bankCount = lessonBankCount(lesson);
  const textbookCount = lessonTextbookCount(lesson);
  const advice = [];

  if ((lesson.mistake_count || 0) > 0 || lesson.status === "review_required") {
    advice.push("本节已经出现错题或低分信号，先复盘错因，再做同类题。");
  } else if ((lesson.score || 0) >= 85 && bankCount > 0) {
    advice.push("本节掌握度较稳，可以进入本年级题库做变式训练。");
  } else if ((lesson.attempted_count || 0) === 0 && textbookCount > 0) {
    advice.push("先完成随堂选择题，再根据答题结果安排巩固练习。");
  } else {
    advice.push("按导学、正文、随堂题、题库的顺序推进，避免只看不练。");
  }

  if (
    profile.weak_subject && profile.weak_subject !== "暂无" &&
    profile.weak_subject === course.subject
  ) {
    advice.push(`${course.subject}是当前重点关注学科，本节要把过程写完整。`);
  }
  if (bankCount > 0) {
    advice.push(
      `题库已锁定${course.grade || "当前年级"}，只练本节对应年级的 ${bankCount} 道题。`,
    );
  } else {
    advice.push("本节暂未导入主书题库，先把随堂题和教材正文吃透。");
  }
  if ((lesson.study_seconds || 0) < 600) {
    advice.push("本节停留还偏短，建议至少完成一次完整阅读和一次独立作答。");
  }

  return uniqueLearningItems(advice).slice(0, 4).map((item) => ({
    text: item,
    active: item.includes("错题") || item.includes("低分") ||
      item.includes("锁定"),
  }));
}

function buildLessonPlanItems(lesson) {
  const textbookCount = lessonTextbookCount(lesson);
  const bankCount = lessonBankCount(lesson);
  return [
    {
      label: "读目标",
      detail: "先看本节标题、来源和核心材料，知道要解决什么问题。",
      done: lesson.status !== "not_started",
    },
    {
      label: "学正文",
      detail: "把教材正文中的例题、图示和方法整理成自己的话。",
      done: (lesson.study_seconds || 0) >= 300,
    },
    {
      label: "选项作答",
      detail: textbookCount ? `独立完成 ${textbookCount} 道随堂题，先选择再提交。` : "本节无随堂题，改为口头复述关键方法。",
      done: (lesson.attempted_count || 0) >= Math.max(1, textbookCount),
    },
    {
      label: "对答案",
      detail: "提交后统一看正确答案、自己的答案和解析，先改错再进入题库。",
      done: (lesson.attempted_count || 0) >= Math.max(1, textbookCount),
    },
    {
      label: "进题库",
      detail: bankCount ? `进入${bankCount}道本年级题库做巩固。` : "题库未导入时，先完成正文和随堂复盘。",
      done: false,
    },
  ];
}

function renderCoachList(items) {
  const cleanItems = (items || []).map((item) => typeof item === "string" ? { text: item } : item).filter((item) => item.text);
  if (!cleanItems.length) {
    return "<li>完成本节学习后，这里会刷新下一步建议。</li>";
  }
  return cleanItems.map((item) => `<li class="${item.active ? "is-active" : ""}">${escapeHtml(item.text)}</li>`).join("");
}

function renderLessonPlan(items) {
  return items.map((item, index) => `
    <li class="${item.done ? "is-done" : ""}">
      <span>${index + 1}</span>
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <p>${escapeHtml(item.detail)}</p>
      </div>
    </li>
  `).join("");
}

function renderLearnerSignals(profile, lesson) {
  const totalQuestions = Math.max(
    lessonTextbookCount(lesson) + lessonBankCount(lesson),
    lesson.attempted_count || 0,
  );
  const signals = [
    { label: "本节掌握", value: `${Math.round(lesson.score || 0)}分` },
    {
      label: "已答题",
      value: `${lesson.attempted_count || 0}/${totalQuestions || 0}`,
    },
    {
      label: "本节停留",
      value: formatStudyDuration(lesson.study_seconds || 0),
    },
    { label: "当前错题", value: `${lesson.mistake_count || 0}道` },
    { label: "近期正确率", value: `${profile.accuracy || 0}%` },
    {
      label: "累计学习",
      value: formatStudyDuration(profile.study_minutes || 0, "minutes"),
    },
  ];
  return signals.map((item) => `
    <div class="coach-signal">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");
}

function updateStudyCoachPanel(root, data, lesson, courseId) {
  if (!root || !data || !lesson) {
    return;
  }
  const profile = data.learner_profile || {};
  const course = data.course || {};
  const gradeLock = data.grade_lock || {};
  const status = lessonStatus(lesson.status);
  const bankCount = lessonBankCount(lesson);
  const summary = profile.attempt_count ? `近期答题 ${profile.attempt_count} 次，正确率 ${profile.accuracy || 0}%。` : "先完成本节随堂题，再进入对答案和题库巩固。";
  const taskLabel = bankCount > 0 ? "题库可练" : "先做随堂";

  const setText = (selector, value) => {
    const node = root.querySelector(selector);
    if (node) {
      node.textContent = value;
    }
  };
  const setHtml = (selector, value) => {
    const node = root.querySelector(selector);
    if (node) {
      node.innerHTML = value;
    }
  };

  setText("[data-coach-task-label]", taskLabel);
  setText("[data-coach-summary]", summary);
  setText("[data-coach-status]", status.label);
  setText(
    "[data-coach-grade-lock-title]",
    gradeLock.label || `${course.grade || "当前年级"}题库`,
  );
  setText(
    "[data-coach-grade-lock-desc]",
    gradeLock.message ||
      `本节只调用${course.grade || "当前年级"}范围内的题目。`,
  );
  setText("[data-coach-bank-count]", `${bankCount} 道`);
  setHtml(
    "[data-coach-advice]",
    renderCoachList(buildLessonCoachAdvice(data, lesson)),
  );
  setHtml("[data-coach-next-steps]", renderCoachList(profile.next_steps || []));
  setHtml("[data-lesson-plan]", renderLessonPlan(buildLessonPlanItems(lesson)));
  setHtml("[data-learner-signals]", renderLearnerSignals(profile, lesson));

  const bankLink = root.querySelector("[data-coach-bank-link]");
  if (bankLink) {
    bankLink.href = `/question-bank?course=${encodeURIComponent(courseId)}&lesson=${encodeURIComponent(lesson.id)}`;
    bankLink.classList.toggle("is-disabled", bankCount <= 0);
    bankLink.setAttribute("aria-disabled", bankCount <= 0 ? "true" : "false");
  }
}

const LESSON_STATUS_MAP = {
  completed: { label: "已掌握", className: "is-completed" },
  in_progress: { label: "学习中", className: "is-progress" },
  review_required: { label: "待回流", className: "is-review" },
  not_started: { label: "未开始", className: "is-pending" },
};

function lessonStatus(status) {
  return LESSON_STATUS_MAP[status] || LESSON_STATUS_MAP.not_started;
}

function pickLessonIndex(lessons, lessonId) {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return -1;
  }
  if (lessonId) {
    const requestedIndex = lessons.findIndex((lesson) => String(lesson.id) === String(lessonId));
    if (requestedIndex >= 0) {
      return requestedIndex;
    }
  }
  return [
    lessons.findIndex((lesson) => lesson.status === "in_progress"),
    lessons.findIndex((lesson) => lesson.status === "review_required"),
    lessons.findIndex((lesson) => lesson.status !== "completed"),
    0,
  ].find((index) => index >= 0) ?? 0;
}

async function initCoursePage() {
  setPageLoading(true, "正在加载知识点，请稍候");
  const user = await requireSession();
  if (!user) {
    setPageLoading(false);
    return;
  }
  setUserProfile(user);
  wireLogoutButton();

  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("id") || params.get("course");
  const lessonParam = params.get("lesson");
  const root = document.getElementById("course-root");
  const summaryRoot = document.getElementById("course-summary");
  if (!courseId) {
    if (root) {
      root.innerHTML = '<div class="course-empty-state">未找到要学习的课程。</div>';
      root.classList.remove("is-hidden");
    }
    setPageLoading(false);
    return;
  }

  let result;
  try {
    result = await apiFetch(`/api/course/${courseId}`);
  } catch (error) {
    keepStaticPage(error);
    if (root) {
      root.innerHTML = `<div class="course-empty-state">${escapeHtml(error.message)}</div>`;
      root.classList.remove("is-hidden");
    }
    setPageLoading(false);
    return;
  }
  const data = result.data;
  prefetchCourseQuestionBanks(data.lessons);
  hydrateSubjectNavLinks();
  if (!root) {
    setPageLoading(false);
    return;
  }

  let activeIndex = pickLessonIndex(data.lessons, lessonParam);
  let lesson = data.lessons[activeIndex];
  if (!lesson) {
    root.innerHTML = '<div class="course-empty-state">当前课程还没有可学习的知识节点。</div>';
    root.classList.remove("is-hidden");
    setPageLoading(false);
    return;
  }

  const backLink = document.getElementById("course-back-link");
  if (backLink) {
    backLink.href = buildSubjectsHref(data.course.stage, data.course.grade);
    const label = backLink.querySelector("span");
    if (label) {
      label.textContent = `返回${data.course.grade || "年级"}`;
    }
  }

  const renderCourseMeta = () => {
    const titleMain = document.getElementById("course-title-main");
    if (titleMain) {
      titleMain.textContent = cleanCourseDisplayTitle(data.course.title);
    }
    const titleSubtitle = document.getElementById("course-title-subtitle");
    if (titleSubtitle) {
      titleSubtitle.textContent = `${lesson.order}. ${lesson.title} / ${data.course.grade} / ${data.course.subject}`;
    }
    if (!summaryRoot) {
      return;
    }
    const completedCount = data.lessons.filter((item) => item.status === "completed").length;
    const reviewCount = data.lessons.filter((item) => item.status === "review_required").length;
    summaryRoot.innerHTML = `
      <span class="workspace-badge"><strong>${data.lessons.length}</strong><span>节点</span></span>
      <span class="workspace-badge"><strong>${lesson.order}</strong><span>当前</span></span>
      <span class="workspace-badge"><strong>${escapeHtml(data.grade_lock?.grade || data.course.grade || "-")}</strong><span>题库锁</span></span>
      <span class="workspace-badge"><strong>${completedCount}</strong><span>掌握</span></span>
      <span class="workspace-badge"><strong>${reviewCount}</strong><span>回流</span></span>
    `;
  };

  const studyTimer = createLessonStudyTimer();

  const renderTree = () =>
    data.lessons
      .map((item, index) => {
        const status = lessonStatus(item.status);
        return `
        <a
          class="chapter-node-card ${index === activeIndex ? "is-active" : ""}"
          href="${escapeHtml(buildLessonHref(courseId, item.id))}"
          data-same-page-lesson-nav="1"
          data-lesson-id="${item.id}"
        >
          <span class="chapter-node-order">${item.order}</span>
          <div class="chapter-node-copy">
            <p>${escapeHtml(item.title)}</p>
            <span class="chapter-node-status ${status.className}">${status.label}</span>
          </div>
        </a>
      `;
      })
      .join("");

  const renderCoachPanel = () => updateStudyCoachPanel(root, data, lesson, courseId);

  const updateActiveLessonProgress = () => {
    const status = lessonStatus(lesson.status);
    const progressWidth = Math.min(100, Math.max(8, lesson.score || 0));
    const scoreNode = root.querySelector("[data-lesson-score]");
    const statusNode = root.querySelector("[data-lesson-status]");
    const progressFill = root.querySelector(".knowledge-node-fill");
    const tree = root.querySelector("[data-lesson-tree]");
    if (scoreNode) {
      scoreNode.textContent = `掌握度 ${lesson.score || 0} 分`;
    }
    if (statusNode) {
      statusNode.className = `knowledge-node-status ${status.className}`;
      statusNode.textContent = status.label;
    }
    if (progressFill) {
      progressFill.style.setProperty("--progress-width", `${progressWidth}%`);
    }
    if (tree) {
      tree.innerHTML = renderTree();
    }
    renderCourseMeta();
    renderCoachPanel();
  };

  const markLessonInProgress = () => {
    const targetLesson = lesson;
    if (
      !targetLesson || targetLesson.status !== "not_started" ||
      targetLesson.startQueued
    ) {
      return;
    }
    targetLesson.startQueued = true;
    targetLesson.status = "in_progress";
    apiFetch(`/api/lessons/${targetLesson.id}/start`, { method: "POST" })
      .then((response) => {
        if (response.data?.status) {
          targetLesson.status = response.data.status;
        }
        if (typeof response.data?.score === "number") {
          targetLesson.score = response.data.score;
        }
        if (targetLesson === lesson) {
          updateActiveLessonProgress();
        }
      })
      .catch((error) => {
        console.warn(error);
      });
  };

  const wireCourseLessonTree = () => {
    const tree = root.querySelector("[data-lesson-tree]");
    if (!tree || tree.dataset.lessonSwitchBound === "1") {
      return;
    }
    tree.dataset.lessonSwitchBound = "1";
    tree.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const link = target?.closest("[data-same-page-lesson-nav]");
      if (!link || !tree.contains(link)) {
        return;
      }
      event.preventDefault();
      switchLesson(link.dataset.lessonId, { pushHistory: true });
    });
  };

  const wireCourseQuestionResults = () => {
    const lectureContent = root.querySelector("[data-lecture-content]");
    if (!lectureContent || lectureContent.dataset.questionResultBound === "1") {
      return;
    }
    lectureContent.dataset.questionResultBound = "1";
    lectureContent.addEventListener("question-submitted", (event) => {
      studyTimer.flush(false);
      const detail = event.detail || {};
      if (detail.question_kind !== "textbook") {
        return;
      }
      const questionCard = event.target instanceof Element ? event.target.closest("[data-question-id]") : null;
      const questionKey = questionCard?.dataset.questionId ||
        `${detail.lesson_id}-${Date.now()}`;
      data.learner_profile = data.learner_profile || {};
      data.learner_profile._answered_question_ids = data.learner_profile._answered_question_ids || {};
      if (!data.learner_profile._answered_question_ids[questionKey]) {
        data.learner_profile._answered_question_ids[questionKey] = true;
        data.learner_profile.attempt_count = (data.learner_profile.attempt_count || 0) + 1;
        data.learner_profile.correct_count = (data.learner_profile.correct_count || 0) + (detail.correct ? 1 : 0);
        data.learner_profile.accuracy = Math.round(
          (data.learner_profile.correct_count /
            Math.max(1, data.learner_profile.attempt_count)) * 100,
        );
      }
      const targetLesson = data.lessons.find((item) => String(item.id) === String(detail.lesson_id));
      if (!targetLesson) {
        return;
      }
      if (detail.status) {
        targetLesson.status = detail.status;
      }
      if (typeof detail.score === "number") {
        targetLesson.score = detail.score;
      }
      if (typeof detail.attempted_count === "number") {
        targetLesson.attempted_count = Math.max(
          targetLesson.attempted_count || 0,
          detail.attempted_count,
        );
      }
      if (
        typeof detail.total_questions === "number" &&
        typeof detail.score === "number"
      ) {
        targetLesson.correct_count = Math.max(
          targetLesson.correct_count || 0,
          Math.round((detail.score / 100) * detail.total_questions),
        );
      }
      if (detail.correct === false) {
        targetLesson.mistake_count = (targetLesson.mistake_count || 0) + 1;
      }
      if (targetLesson === lesson) {
        updateActiveLessonProgress();
      }
    });
  };

  const renderCourseLesson = (
    { contentHtml = "", scrollToTop = false } = {},
  ) => {
    renderCourseMeta();
    markLessonInProgress();
    studyTimer.setLesson(lesson.id);
    const status = lessonStatus(lesson.status);
    const progressWidth = Math.min(100, Math.max(8, lesson.score || 0));
    const tree = root.querySelector("[data-lesson-tree]");
    const lessonCountNode = root.querySelector("[data-course-lesson-count]");
    const kickerNode = root.querySelector("[data-lesson-kicker]");
    const titleNode = root.querySelector("[data-lesson-title]");
    const statusNode = root.querySelector("[data-lesson-status]");
    const scoreNode = root.querySelector("[data-lesson-score]");
    const progressFill = root.querySelector("[data-lesson-progress-fill]");
    const lectureContent = root.querySelector("[data-lecture-content]");
    const bankCountNode = root.querySelector("[data-bank-question-count]");
    const bankDescNode = root.querySelector("[data-question-bank-desc]");
    const bankLink = root.querySelector("[data-question-bank-link]");
    const bankQuestionCount = lessonBankCount(lesson);
    if (lessonCountNode) {
      lessonCountNode.textContent = data.lessons.length;
    }
    if (tree) {
      tree.innerHTML = renderTree();
    }
    if (kickerNode) {
      kickerNode.textContent = `知识节点 ${lesson.order}`;
    }
    if (titleNode) {
      titleNode.textContent = lesson.title;
    }
    if (statusNode) {
      statusNode.className = `knowledge-node-status ${status.className}`;
      statusNode.textContent = status.label;
    }
    if (scoreNode) {
      scoreNode.textContent = `掌握度 ${lesson.score || 0} 分`;
    }
    if (progressFill) {
      progressFill.style.setProperty("--progress-width", `${progressWidth}%`);
    }
    if (lectureContent) {
      lectureContent.innerHTML = contentHtml ||
        renderLearningContent(lesson, data.course);
      wireInlineChoiceOptions(lectureContent);
      wireQuestionSubmitButtons(lectureContent);
      wireCourseQuestionResults();
    }
    if (bankCountNode) {
      bankCountNode.textContent = `${bankQuestionCount} 题`;
    }
    if (bankDescNode) {
      bankDescNode.textContent = `${bankQuestionCount} 道练习 · 完成后复盘`;
    }
    if (bankLink) {
      bankLink.href = `/question-bank?course=${encodeURIComponent(courseId)}&lesson=${encodeURIComponent(lesson.id)}`;
    }
    renderCoachPanel();
    if (scrollToTop) {
      root.querySelector(".lecture-pane")?.scrollTo({
        top: 0,
        behavior: "auto",
      });
    }
    wireCourseLessonTree();
    wireNavigationTransitions();
  };

  const switchLesson = (lessonId, { pushHistory = false } = {}) => {
    const nextIndex = data.lessons.findIndex((item) => String(item.id) === String(lessonId));
    if (nextIndex < 0 || nextIndex === activeIndex) {
      return;
    }
    const nextLesson = data.lessons[nextIndex];
    let nextContentHtml = "";
    try {
      nextContentHtml = renderLearningContent(nextLesson, data.course);
    } catch (error) {
      console.warn(error);
      return;
    }

    studyTimer.flush(true);
    activeIndex = nextIndex;
    lesson = nextLesson;
    renderCourseLesson({ contentHtml: nextContentHtml, scrollToTop: true });
    if (pushHistory && window.history?.pushState) {
      window.history.pushState(
        { courseId: String(courseId), lessonId: String(lesson.id) },
        "",
        buildLessonHref(courseId, lesson.id),
      );
    }
  };

  window.addEventListener("popstate", () => {
    const nextParams = new URLSearchParams(window.location.search);
    const nextCourseId = nextParams.get("id") || nextParams.get("course");
    if (nextCourseId && String(nextCourseId) !== String(courseId)) {
      window.location.href = window.location.href;
      return;
    }
    const nextIndex = pickLessonIndex(data.lessons, nextParams.get("lesson"));
    if (nextIndex >= 0) {
      switchLesson(data.lessons[nextIndex].id, { pushHistory: false });
    }
  });

  renderCourseLesson();
  root.classList.remove("is-hidden");
  wireNavigationTransitions();
  setPageLoading(false);
}

async function initMistakesPage() {
  setPageLoading(true);
  const user = await requireSession();
  if (!user) {
    setPageLoading(false);
    return;
  }
  setUserProfile(user);
  wireLogoutButton();

  let result;
  try {
    result = await apiFetch("/api/mistakes", {
      cacheTtlMs: API_PREFETCH_CACHE_TTL_MS,
    });
  } catch (error) {
    setPageLoading(false);
    keepStaticPage(error);
    return;
  }
  const mistakes = result.data;
  const root = document.getElementById("mistakes-root");
  if (!root) {
    setPageLoading(false);
    return;
  }

  if (mistakes.length === 0) {
    root.innerHTML = '<div class="card"><p class="muted mistakes-empty-text">当前账号暂无错题记录。</p></div>';
    setPageLoading(false);
    return;
  }

  const renderMistakeCard = (item) => `
    <div class="card">
      <div class="mistake-box">
        <div class="row-between">
          <span class="mini-chip chip-soft">${escapeHtml(item.stage)} · ${escapeHtml(item.subject)}</span>
          <span class="muted text-xs">${escapeHtml(item.created_at)}</span>
        </div>
        <p class="muted mistake-context-text">${escapeHtml(item.course_title)} / ${escapeHtml(item.lesson_title)}</p>
        <p class="mistake-question-preview">${escapeHtml(item.question_text)}</p>
        <p class="muted mistake-explanation-text">解析：${escapeHtml(item.explanation)}</p>
        ${renderMistakeReviewAction(item)}
      </div>
    </div>
  `;
  root.innerHTML = `
    ${mistakes.slice(0, 8).map(renderMistakeCard).join("")}
    ${mistakes.length > 8 ? `<details class="mistakes-more"><summary>展开其余 ${mistakes.length - 8} 道错题</summary>${mistakes.slice(8).map(renderMistakeCard).join("")}</details>` : ""}
  `;
  wireNavigationTransitions();
  setPageLoading(false);
}

async function initQuestionBankPage() {
  setPageLoading(true, "正在加载知识点题库，请稍候");
  const user = await requireSession();
  if (!user) {
    setPageLoading(false);
    return;
  }
  setUserProfile(user);
  wireLogoutButton();

  const params = new URLSearchParams(window.location.search);
  const lessonId = params.get("lesson");
  const courseId = params.get("course");
  const root = document.getElementById("question-bank-root");
  const listRoot = root?.querySelector("[data-question-bank-list]");
  const emptyRoot = root?.querySelector("[data-question-bank-empty]");
  const countNode = root?.querySelector("[data-question-bank-count]");
  if (!lessonId || !root) {
    if (listRoot) {
      listRoot.innerHTML = '<div class="card"><p class="muted mistakes-empty-text">未找到要练习的知识点。</p></div>';
      root.classList.remove("is-hidden");
    }
    setPageLoading(false);
    return;
  }

  let result;
  try {
    result = await apiFetch(`/api/lessons/${lessonId}/question-bank`);
  } catch (error) {
    keepStaticPage(error);
    if (listRoot) {
      listRoot.innerHTML = `<div class="card"><p class="muted mistakes-empty-text">${escapeHtml(error.message)}</p></div>`;
      root.classList.remove("is-hidden");
    }
    setPageLoading(false);
    return;
  }

  const data = result.data;
  const title = document.getElementById("question-bank-title");
  const subtitle = document.getElementById("question-bank-subtitle");
  const backLink = document.getElementById("question-bank-back-link");
  const summary = document.getElementById("question-bank-summary");
  const gradeLockNode = document.querySelector(
    "[data-question-bank-grade-lock]",
  );
  if (title) {
    title.textContent = `${data.lesson.order}. ${data.lesson.title}`;
  }
  if (subtitle) {
    subtitle.textContent = `${cleanCourseDisplayTitle(data.course.title)} / ${data.course.grade} / ${data.course.subject}`;
  }
  if (backLink) {
    backLink.href = buildLessonHref(courseId || data.course.id, data.lesson.id);
  }
  if (summary) {
    summary.innerHTML = `
      <span class="workspace-badge"><strong>${data.questions.length}</strong><span>题目</span></span>
      <span class="workspace-badge"><strong>${escapeHtml(data.grade_lock?.grade || data.course.grade)}</strong><span>题库锁</span></span>
      <span class="workspace-badge"><strong>${escapeHtml(data.course.subject)}</strong><span>学科</span></span>
    `;
  }
  if (gradeLockNode) {
    gradeLockNode.textContent = data.grade_lock?.message ||
      `本页只展示${data.course.grade}范围内的题目。`;
  }
  if (countNode) {
    countNode.textContent = `${data.questions.length} 道`;
  }

  if (!data.questions.length) {
    if (listRoot) {
      listRoot.innerHTML = "";
    }
    emptyRoot?.classList.remove("is-hidden");
    root.classList.remove("is-hidden");
    setPageLoading(false);
    return;
  }

  emptyRoot?.classList.add("is-hidden");
  if (listRoot) {
    listRoot.innerHTML = renderPracticeSession({
      questions: data.questions,
      scopeId: `bank-${data.lesson.id}`,
      title: "本年级题库练习",
      kicker: "GRADE-LOCKED DRILL",
      description: "题目已锁定当前年级。先逐题提交，最后统一对答案和看解析。",
      className: "bank-practice-session",
      sourcePrefix: "题库第",
      cardClass: "bank-page-question",
    });
  }
  root.classList.remove("is-hidden");
  wireQuestionSubmitButtons(root);
  setPageLoading(false);
}

document.addEventListener("DOMContentLoaded", async () => {
  hydrateCachedUserProfile();
  hydrateSubjectNavLinks();
  wireAvatarDropdown();
  setupMotionSystem();
  wireNavigationTransitions();
  const page = document.body.dataset.page;
  if (page === "login") {
    await initLoginPage();
    return;
  }
  if (page === "welcome") {
    await initWelcomePage();
    return;
  }
  if (page === "dashboard") {
    await initDashboardPage();
    return;
  }
  if (page === "course") {
    await initCoursePage();
    return;
  }
  if (page === "question-bank") {
    await initQuestionBankPage();
    return;
  }
  if (page === "mistakes") {
    await initMistakesPage();
    return;
  }
  if (page === "subjects") {
    await initSubjectsPage();
    return;
  }
  if (page === "grade") {
    await initGradePage();
    return;
  }
  if (page === "growth") {
    await initGrowthPage();
    return;
  }
  if (page === "teacher") {
    await initTeacherPage();
    return;
  }
});

const SUBJECT_STAGE_CONFIGS = {
  "小学": {
    label: "小学",
    en: "PRIMARY",
    index: "01",
    className: "stage-primary",
  },
  "初中": {
    label: "初中",
    en: "JUNIOR",
    index: "03",
    className: "stage-junior",
  },
  "高中": {
    label: "高中",
    en: "SENIOR",
    index: "04",
    className: "stage-senior",
  },
  "小升初衔接": {
    label: "小升初",
    en: "BRIDGE",
    index: "02",
    className: "stage-bridge",
  },
};

const SUBJECT_GRADE_ORDER = [
  ["一年级", 10],
  ["二年级", 20],
  ["三年级", 30],
  ["四年级", 40],
  ["五年级", 50],
  ["六年级", 60],
  ["六升七", 65],
  ["七年级", 70],
  ["初一", 70],
  ["八年级", 80],
  ["初二", 80],
  ["九年级", 90],
  ["初三", 90],
  ["高一", 100],
  ["高二", 110],
  ["高三", 120],
  ["高中", 100],
];

function subjectGradeIndex(grade) {
  const text = String(grade || "").trim();
  const match = SUBJECT_GRADE_ORDER.find(([name]) => text.includes(name));
  if (!match) {
    return 999;
  }
  let offset = 0;
  if (text.includes("下册")) {
    offset = 0.4;
  } else if (text.includes("全一册")) {
    offset = 0.2;
  } else if (text.includes("选修")) {
    offset = 0.6;
  }
  return match[1] + offset;
}

function buildSubjectCatalogModel(stages = []) {
  const allCourses = stages.flatMap((stage) =>
    (stage.subjects || []).flatMap((subject) =>
      (subject.courses || []).map((course) => ({
        ...course,
        stage: stage.stage,
        subject: subject.subject,
      }))
    )
  );
  allCourses.sort((a, b) =>
    (subjectGradeIndex(a.grade) - subjectGradeIndex(b.grade)) ||
    String(a.subject || "").localeCompare(String(b.subject || ""), "zh-CN") ||
    String(a.title || "").localeCompare(String(b.title || ""), "zh-CN")
  );
  const gradeGroups = [
    ...allCourses.reduce((groups, course) => {
      const key = `${course.stage}::${course.grade}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          stage: course.stage,
          grade: course.grade,
          courses: [],
        });
      }
      groups.get(key).courses.push(course);
      return groups;
    }, new Map()).values(),
  ].sort((a, b) =>
    (subjectGradeIndex(a.grade) - subjectGradeIndex(b.grade)) ||
    String(a.stage || "").localeCompare(String(b.stage || ""), "zh-CN")
  );
  const stageGroups = [
    ...gradeGroups.reduce((groups, group) => {
      const key = group.stage || "其他";
      if (!groups.has(key)) {
        groups.set(key, {
          stage: key,
          grades: [],
          courses: [],
        });
      }
      const stageGroup = groups.get(key);
      stageGroup.grades.push(group);
      stageGroup.courses.push(...group.courses);
      return groups;
    }, new Map()).values(),
  ].sort((a, b) =>
    (SUBJECT_STAGE_CONFIGS[a.stage]?.index || "99").localeCompare(
      SUBJECT_STAGE_CONFIGS[b.stage]?.index || "99",
    ) || String(a.stage || "").localeCompare(String(b.stage || ""), "zh-CN")
  );
  return {
    allCourses,
    gradeGroups,
    stageGroups,
    totalStages: stages.length,
    totalSubjects: new Set(allCourses.map((course) => `${course.stage}/${course.subject}`))
      .size,
    totalCourses: allCourses.length,
    purchasedCount: allCourses.filter((course) => course.purchased).length,
  };
}

function renderSubjectCourseItem(course) {
  const isUnlocked = Boolean(course.purchased);
  const tag = isUnlocked ? "a" : "article";
  const href = isUnlocked ? ` href="/course?id=${course.id}"` : "";
  return `
    <${tag} class="subject-course-item ${isUnlocked ? "subject-course-link is-unlocked" : "is-locked"}"${href}>
      <span class="subject-course-copy">
        <span class="subject-course-name">${escapeHtml(cleanCourseDisplayTitle(course.title))}</span>
        <span class="subject-course-meta">${course.lesson_count || 0} 个知识点 · ${course.question_count || 0} 道练习</span>
      </span>
      <span class="subject-enter-chip">${isUnlocked ? "进入" : "未开通"}</span>
    </${tag}>
  `;
}

function renderGradePicker(model, user = {}) {
  const userStage = String(user.stage || "").trim();
  const userGrade = String(user.grade || "").trim();
  return model.stageGroups.map((stageGroup) => {
    const config = SUBJECT_STAGE_CONFIGS[stageGroup.stage] ||
      SUBJECT_STAGE_CONFIGS["小学"];
    const stageCourses = stageGroup.courses || [];
    const stageSubjects = new Set(stageCourses.map((course) => course.subject));
    const stageUnlocked = stageCourses.filter((course) => course.purchased).length;
    return `
      <section class="grade-stage-section ${config.className}">
        <div class="grade-stage-rail">
          <span class="stage-index">${escapeHtml(config.index)}</span>
          <div>
            <p class="stage-eyebrow">${escapeHtml(config.en)}</p>
            <h3>${escapeHtml(config.label)}</h3>
          </div>
          <span class="grade-stage-count">${stageGroup.grades.length} 个年级 · ${stageSubjects.size} 个科目 · ${stageUnlocked}/${stageCourses.length} 已开通</span>
        </div>
        <div class="grade-entry-grid">
          ${stageGroup.grades.map((group) => {
            const subjects = [...new Set(group.courses.map((course) => course.subject))];
            const unlocked = group.courses.filter((course) => course.purchased).length;
            const progress = group.courses.length ? Math.round((unlocked / group.courses.length) * 100) : 0;
            const isCurrent = group.stage === userStage && group.grade === userGrade;
            return `
              <a class="grade-entry-card ${config.className} ${isCurrent ? "is-current" : ""}" href="${escapeHtml(buildGradeHref(group.stage, group.grade))}">
                <span class="grade-entry-topline">
                  <span class="grade-entry-stage">${escapeHtml(config.label)} · ${escapeHtml(config.en)}</span>
                  ${isCurrent ? '<span class="grade-current-chip">当前</span>' : ""}
                </span>
                <strong>${escapeHtml(group.grade)}</strong>
                <span class="grade-entry-subjects">${subjects.slice(0, 4).map((subject) => `<b>${escapeHtml(subject)}</b>`).join("")}</span>
                <span class="grade-progress-line"><i style="width: ${progress}%"></i></span>
                <span class="grade-entry-foot">
                  <em>${unlocked}/${group.courses.length} 已开通</em>
                  <span>查看科目</span>
                </span>
              </a>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }).join("") ||
    '<div class="subject-empty"><p>当前还没有可学习的课程。请先把课本放入 resources 后重新生成课程。</p></div>';
}

function renderGradeDetail(group) {
  const subjectGroups = [
    ...group.courses.reduce((groups, course) => {
      if (!groups.has(course.subject)) {
        groups.set(course.subject, []);
      }
      groups.get(course.subject).push(course);
      return groups;
    }, new Map()).entries(),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0]), "zh-CN"));
  if (!subjectGroups.length) {
    return '<div class="subject-empty"><p>当前年级还没有可学习的课程。</p></div>';
  }
  const config = SUBJECT_STAGE_CONFIGS[group.stage] || SUBJECT_STAGE_CONFIGS["小学"];
  const subjects = subjectGroups.map(([subjectName]) => subjectName);
  const unlocked = group.courses.filter((course) => course.purchased).length;
  const progress = group.courses.length ? Math.round((unlocked / group.courses.length) * 100) : 0;
  return `
    <section class="grade-overview-panel ${config.className}">
      <div class="grade-overview-copy">
        <span class="grade-entry-stage">${escapeHtml(config.label)} · ${escapeHtml(config.en)}</span>
        <h2>${escapeHtml(group.grade)}学习地图</h2>
        <p>先选科目，再进入已开通课本；每本课本里会按知识点继续拆成学习和练习。</p>
      </div>
      <div class="grade-overview-meter" aria-label="已开通课本进度">
        <strong>${unlocked}/${group.courses.length}</strong>
        <span>课本已开通</span>
        <i><b style="width: ${progress}%"></b></i>
      </div>
      <div class="grade-overview-subjects">
        ${subjects.map((subject) => `<span>${escapeHtml(subject)}</span>`).join("")}
      </div>
    </section>
    <div class="grade-directory-head">
      <div>
        <p class="stage-eyebrow">SUBJECTS</p>
        <h2 class="section-title">选择科目</h2>
      </div>
      <span>${subjectGroups.length} 个科目 · ${group.courses.length} 本课本</span>
    </div>
    ${subjectGroups.map(([subjectName, subjectCourses]) => `
      <section class="subject-column subject-directory-card ${config.className}">
      <div class="subject-directory-head">
        <span class="subject-mark">${escapeHtml(subjectName.slice(0, 1))}</span>
        <div class="subject-directory-copy">
          <h3 class="subject-title">${escapeHtml(subjectName)}</h3>
          <p class="subject-course-meta">${subjectCourses.filter((course) => course.purchased).length}/${subjectCourses.length} 本已开通</p>
        </div>
      </div>
      <div class="subject-course-list">
        ${subjectCourses.map(renderSubjectCourseItem).join("")}
      </div>
    </section>
    `).join("")}
  `;
}

async function initSubjectsPage() {
  setPageLoading(true);
  const user = await requireSession();
  if (!user) {
    setPageLoading(false);
    return;
  }
  if (isTeacherUser(user) && window.location.protocol !== "file:") {
    setPageLoading(false);
    window.location.href = "/teacher";
    return;
  }
  setUserProfile(user);
  wireLogoutButton();

  let result;
  try {
    result = await apiFetch("/api/subjects", {
      cacheTtlMs: API_PREFETCH_CACHE_TTL_MS,
    });
  } catch (error) {
    setPageLoading(false);
    keepStaticPage(error);
    return;
  }
  const subjectsRoot = document.getElementById("subjects-root");
  if (!subjectsRoot) {
    setPageLoading(false);
    return;
  }

  const model = buildSubjectCatalogModel(result.data?.stages || []);
  saveSubjectOverviewLocation();
  hydrateSubjectNavLinks();
  const totalStagesNode = subjectsRoot.querySelector(
    "[data-subject-total-stages]",
  );
  const totalSubjectsNode = subjectsRoot.querySelector(
    "[data-subject-total-subjects]",
  );
  const purchasedTotalNode = subjectsRoot.querySelector(
    "[data-subject-purchased-total]",
  );
  const gradeSummaryNode = subjectsRoot.querySelector(
    "[data-grade-total-summary]",
  );
  const gradeGrid = subjectsRoot.querySelector("[data-grade-grid]");
  if (totalStagesNode) {
    totalStagesNode.textContent = model.totalStages;
  }
  if (totalSubjectsNode) {
    totalSubjectsNode.textContent = model.totalSubjects;
  }
  if (purchasedTotalNode) {
    purchasedTotalNode.textContent = `${model.purchasedCount}/${model.totalCourses}`;
  }
  if (gradeSummaryNode) {
    gradeSummaryNode.textContent = `${model.gradeGroups.length} 个年级 · ${model.totalCourses} 本课本`;
  }
  if (gradeGrid) {
    gradeGrid.innerHTML = renderGradePicker(model, user);
  }
  subjectsRoot.classList.remove("is-hidden");
  wireNavigationTransitions();
  setPageLoading(false);
}

async function initGradePage() {
  const user = await requireSession();
  if (!user) return;
  if (isTeacherUser(user) && window.location.protocol !== "file:") {
    window.location.href = "/teacher";
    return;
  }
  setUserProfile(user);
  wireLogoutButton();

  const params = new URLSearchParams(window.location.search);
  const requestedStage = params.get("stage");
  const requestedGrade = params.get("grade");
  const root = document.getElementById("grade-root");
  if (!root) return;
  const subjectBoard = root.querySelector("[data-grade-subject-board]");

  let result;
  try {
    result = await apiFetch("/api/subjects", {
      cacheTtlMs: API_PREFETCH_CACHE_TTL_MS,
    });
  } catch (error) {
    keepStaticPage(error);
    (subjectBoard || root).innerHTML = `<div class="subject-empty"><p>${escapeHtml(error.message)}</p></div>`;
    root.classList.remove("is-hidden");
    return;
  }
  const model = buildSubjectCatalogModel(result.data?.stages || []);
  const group = model.gradeGroups.find((item) => item.stage === requestedStage && item.grade === requestedGrade);
  if (!group) {
    (subjectBoard || root).innerHTML = '<div class="subject-empty"><p>未找到这个年级的课程。</p></div>';
    root.classList.remove("is-hidden");
    return;
  }

  saveLastSubjectLocation(group.stage, group.grade);
  hydrateSubjectNavLinks();
  const title = document.getElementById("grade-title-main");
  if (title) {
    title.textContent = `${group.grade}课程`;
  }
  const subtitle = document.getElementById("grade-title-subtitle");
  if (subtitle) {
    subtitle.textContent = `${group.stage} / ${group.grade}`;
  }
  const summary = document.getElementById("grade-summary");
  if (summary) {
    const subjects = new Set(group.courses.map((course) => course.subject));
    const unlocked = group.courses.filter((course) => course.purchased).length;
    summary.innerHTML = `
      <span class="workspace-badge"><strong>${subjects.size}</strong><span>科目</span></span>
      <span class="workspace-badge"><strong>${group.courses.length}</strong><span>课本</span></span>
      <span class="workspace-badge"><strong>${unlocked}</strong><span>已开通</span></span>
    `;
  }
  (subjectBoard || root).innerHTML = renderGradeDetail(group);
  root.classList.remove("is-hidden");
  wireNavigationTransitions();
}

async function initTeacherPage() {
  const user = await requireSession();
  if (!user) return;
  if (!isTeacherUser(user)) {
    if (window.location.protocol !== "file:") {
      window.location.href = "/dashboard";
    }
    return;
  }
  setUserProfile(user);
  wireLogoutButton();
  wirePasswordToggles();
  wireStudentCreateForm(user);
  await initTeacherEnrollmentPanel(user);
}

function wireStudentCreateForm(user) {
  const form = document.getElementById("student-create-form");
  const status = document.getElementById("student-create-status");
  const submit = form?.querySelector("[data-create-student]");
  if (!form || form.dataset.studentCreateBound === "1") {
    return;
  }
  form.dataset.studentCreateBound = "1";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      username: String(formData.get("username") || "").trim(),
      password: String(formData.get("password") || "").trim(),
      full_name: String(formData.get("full_name") || "").trim(),
      stage: String(formData.get("stage") || "").trim(),
      grade: String(formData.get("grade") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      access_duration_days: String(formData.get("access_duration_days") || "")
        .trim(),
    };
    if (!payload.username || !payload.password || !payload.full_name) {
      if (status) {
        status.textContent = "账号、密码、姓名必须填写";
      }
      return;
    }
    if (submit) {
      submit.disabled = true;
    }
    if (status) {
      status.textContent = "创建中...";
    }
    try {
      const result = await apiFetch("/api/admin/students", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      const createdName = result.data?.username || payload.username;
      if (status) {
        status.textContent = `已创建学生账号 ${createdName}`;
      }
      await initTeacherEnrollmentPanel(user);
    } catch (error) {
      if (status) {
        status.textContent = error.message;
      }
    } finally {
      if (submit) {
        submit.disabled = false;
      }
    }
  });
}

async function initTeacherEnrollmentPanel(user) {
  const panel = document.getElementById("teacher-admin-panel");
  const root = document.getElementById("teacher-admin-root");
  if (!panel || !root) {
    return;
  }
  if (!isTeacherUser(user)) {
    panel.classList.add("is-hidden");
    return;
  }
  panel.classList.remove("is-hidden");

  let result;
  try {
    result = await apiFetch("/api/admin/enrollments");
  } catch (error) {
    console.warn(error);
    root.innerHTML = "";
    return;
  }

  const { students = [], courses = [] } = result.data || {};
  const subjectGroups = [
    ...courses
      .reduce((groups, course) => {
        const key = `${course.stage}||${course.subject}`;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            stage: course.stage || "",
            subject: course.subject || "",
            courseIds: [],
          });
        }
        groups.get(key).courseIds.push(course.id);
        return groups;
      }, new Map())
      .values(),
  ];
  const selectedSubjectCount = (courseIds) => {
    const selected = new Set(courseIds || []);
    return subjectGroups.filter((group) => group.courseIds.every((courseId) => selected.has(courseId))).length;
  };
  const sortedStudents = [...students].sort((a, b) => {
    const aId = Number(a.id) || 0;
    const bId = Number(b.id) || 0;
    if (aId !== bId) {
      return bId - aId;
    }
    const aName = a.full_name || a.username || "";
    const bName = b.full_name || b.username || "";
    return String(aName).localeCompare(String(bName), "zh-CN", {
      numeric: true,
      sensitivity: "base",
    });
  });

  root.innerHTML = students.length === 0 ? "" : sortedStudents.map((student) => {
    const selected = new Set(student.course_ids || []);
    const subjectOptions = subjectGroups.map((group) => {
      const selectedCount = group.courseIds.filter((courseId) => selected.has(courseId)).length;
      const checked = group.courseIds.length > 0 &&
        selectedCount === group.courseIds.length;
      const partial = selectedCount > 0 &&
        selectedCount < group.courseIds.length;
      return `
            <label class="subject-course-item admin-subject-option">
              <input
                type="checkbox"
                data-subject-course-ids="${escapeHtml(group.courseIds.join(","))}"
                data-subject-partial="${partial ? "true" : "false"}"
                ${checked ? "checked" : ""}
                class="admin-subject-checkbox"
              >
              <span class="subject-course-copy">
                <span class="subject-course-name">${escapeHtml(group.stage)} / ${escapeHtml(group.subject)}</span>
                <span class="subject-course-meta">${group.courseIds.length} 门课程</span>
              </span>
            </label>
          `;
    }).join("");
    const studentName = student.full_name || student.username || "";
    return `
          <article class="subject-column subject-directory-card admin-student-card" data-admin-student-id="${student.id}">
            <button class="subject-directory-head admin-student-toggle" type="button" data-toggle-student aria-expanded="false">
              <span class="subject-mark">${escapeHtml(studentName.slice(0, 1))}</span>
              <span class="subject-directory-copy">
                <span class="subject-title admin-student-title">${escapeHtml(studentName)}（${escapeHtml(student.username || "")}）</span>
                <span class="subject-course-meta admin-student-summary" data-student-enrollment-summary>${escapeHtml(student.stage || "")} · ${escapeHtml(student.grade || "")} · 已开通 ${selectedSubjectCount(student.course_ids)} 个科目</span>
              </span>
              <span class="subject-enter-chip admin-student-toggle-chip" data-student-toggle-chip>
                <span class="admin-toggle-icon" aria-hidden="true">⌄</span>
                <span data-student-toggle-text>展开管理</span>
              </span>
            </button>
            <div class="admin-student-body is-hidden" data-admin-student-body>
              <section class="admin-student-section admin-profile-section">
                <div class="admin-section-heading">
                  <span class="admin-section-index">01</span>
                  <div>
                    <h3>学生资料</h3>
                    <p>修改这个学生的账号、年级和可使用天数。</p>
                  </div>
                </div>
                <form class="student-edit-form" data-student-edit-form>
                <label class="form-group form-group-compact">
                  <span class="form-label">账号</span>
                  <input class="form-input" name="username" value="${escapeHtml(student.username || "")}" required>
                </label>
                <div class="form-group form-group-compact">
                  <span class="form-label-row">
                    <span class="form-label">重置密码</span>
                    <span class="form-inline-help">旧密码不可反查，新密码可点眼睛查看</span>
                  </span>
                  <div class="password-field">
                    <input class="form-input" name="password" type="password" autocomplete="new-password" placeholder="留空不修改，输入后可查看">
                    <button class="password-toggle" type="button" data-toggle-password aria-label="显示密码">
                      <span aria-hidden="true">👁</span>
                    </button>
                  </div>
                </div>
                <label class="form-group form-group-compact">
                  <span class="form-label">姓名</span>
                  <input class="form-input" name="full_name" value="${escapeHtml(student.full_name || "")}" required>
                </label>
                <label class="form-group form-group-compact">
                  <span class="form-label">阶段</span>
                  <select class="form-input" name="stage">
                    ${["小学", "初中", "高中"].map((stage) => `<option value="${stage}" ${student.stage === stage ? "selected" : ""}>${stage}</option>`).join("")}
                  </select>
                </label>
                <label class="form-group form-group-compact">
                  <span class="form-label">年级</span>
                  <input class="form-input" name="grade" value="${escapeHtml(student.grade || "")}">
                </label>
                <label class="form-group form-group-compact">
                  <span class="form-label">邮箱</span>
                  <input class="form-input" name="email" type="email" value="${escapeHtml(student.email || "")}">
                </label>
                <label class="form-group form-group-compact">
                  <span class="form-label-row">
                    <span class="form-label">可使用天数</span>
                    <span class="form-inline-help">今天算第 1 天，留空=长期</span>
                  </span>
                  <input class="form-input" name="access_duration_days" type="number" min="1" max="36500" step="1" value="${student.access_expires_on ? Number(student.access_remaining_days || 0) : ""}" placeholder="留空表示长期有效">
                </label>
                <div class="student-edit-actions">
                  <button class="secondary-btn" type="submit" data-save-student-info>保存资料</button>
                  <button class="secondary-btn danger-soft-btn" type="button" data-delete-student>删除学生</button>
                  <span class="save-feedback" data-profile-save-status aria-live="polite"></span>
                </div>
                </form>
              </section>
              <section class="admin-student-section admin-enrollment-section">
                <div class="admin-section-heading">
                  <span class="admin-section-index">02</span>
                  <div>
                    <h3>购课选择</h3>
                    <p>下面所有课程都属于当前学生：${escapeHtml(studentName)}。</p>
                  </div>
                </div>
                <div class="admin-enrollment-toolbar">
                  <button class="ghost-btn" type="button" data-select-all-enrollments>全选课程</button>
                  <button class="ghost-btn" type="button" data-clear-enrollments>清空选择</button>
                </div>
                <div class="admin-subject-grid">
                  ${subjectOptions}
                </div>
                <div class="admin-actions">
                  <button class="primary-btn" type="button" data-save-enrollment>保存购课</button>
                  <span class="save-feedback" data-save-status aria-live="polite"></span>
                </div>
              </section>
            </div>
          </article>
        `;
  }).join("");

  root.querySelectorAll("[data-subject-partial='true']").forEach((input) => {
    input.indeterminate = true;
  });
  wirePasswordToggles(root);

  root.querySelectorAll("[data-select-all-enrollments]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-admin-student-id]");
      card?.querySelectorAll("input[data-subject-course-ids]").forEach(
        (input) => {
          input.checked = true;
          input.indeterminate = false;
        },
      );
      const status = card?.querySelector("[data-save-status]");
      if (status) {
        status.textContent = "已全选，点击“保存购课”后生效";
      }
    });
  });

  root.querySelectorAll("[data-clear-enrollments]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-admin-student-id]");
      card?.querySelectorAll("input[data-subject-course-ids]").forEach(
        (input) => {
          input.checked = false;
          input.indeterminate = false;
        },
      );
      const status = card?.querySelector("[data-save-status]");
      if (status) {
        status.textContent = "已清空，点击“保存购课”后生效";
      }
    });
  });

  root.querySelectorAll("input[data-subject-course-ids]").forEach((input) => {
    input.addEventListener("change", () => {
      input.indeterminate = false;
      const card = input.closest("[data-admin-student-id]");
      const status = card?.querySelector("[data-save-status]");
      if (status) {
        status.textContent = "购课选择已变更，记得保存";
      }
    });
  });

  root.querySelectorAll("[data-student-edit-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const card = form.closest("[data-admin-student-id]");
      const status = card?.querySelector("[data-profile-save-status]");
      const button = form.querySelector("[data-save-student-info]");
      const buttonLabel = button?.textContent || "保存资料";
      const title = card?.querySelector(".subject-title");
      const summary = card?.querySelector("[data-student-enrollment-summary]");
      const studentId = Number(card?.dataset.adminStudentId);
      if (!card || !studentId) {
        return;
      }
      const formData = new FormData(form);
      const payload = {
        username: String(formData.get("username") || "").trim(),
        password: String(formData.get("password") || "").trim(),
        full_name: String(formData.get("full_name") || "").trim(),
        stage: String(formData.get("stage") || "").trim(),
        grade: String(formData.get("grade") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        access_duration_days: String(formData.get("access_duration_days") || "")
          .trim(),
      };
      if (!payload.username || !payload.full_name) {
        if (status) {
          status.textContent = "账号、姓名必须填写";
        }
        return;
      }
      if (button) {
        button.disabled = true;
        button.classList.add("is-saving");
        button.textContent = "正在保存资料...";
      }
      if (status) {
        status.className = "save-feedback is-saving-text";
        status.textContent = "正在保存学生资料，请稍候…";
      }
      try {
        const result = await apiFetch(`/api/admin/students/${studentId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        const saved = result.data || payload;
        if (title) {
          title.textContent = `${saved.full_name || payload.full_name}（${saved.username || payload.username}）`;
        }
        if (summary) {
          const openText = summary.textContent.match(/已开通 \d+ 个科目$/)?.[0] ||
            `已开通 ${selectedSubjectCount(student.course_ids)} 个科目`;
          summary.textContent = `${saved.stage || payload.stage} · ${saved.grade || payload.grade} · ${openText}`;
        }
        const mark = card.querySelector(".subject-mark");
        if (mark) {
          mark.textContent = String(saved.full_name || payload.full_name).slice(
            0,
            1,
          );
        }
        form.querySelector('input[name="password"]').value = "";
        if (status) {
          status.className = "save-feedback is-success";
          status.textContent = "✓ 学生资料已保存";
        }
      } catch (error) {
        if (status) {
          status.className = "save-feedback is-error";
          status.textContent = `保存失败：${error.message}`;
        }
      } finally {
        if (button) {
          button.disabled = false;
          button.classList.remove("is-saving");
          button.textContent = buttonLabel;
        }
      }
    });
  });

  root.querySelectorAll("[data-toggle-student]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-admin-student-id]");
      const body = card?.querySelector("[data-admin-student-body]");
      const chip = card?.querySelector("[data-student-toggle-chip]");
      const text = chip?.querySelector("[data-student-toggle-text]");
      if (!body) {
        return;
      }
      const shouldOpen = body.classList.contains("is-hidden");
      body.classList.toggle("is-hidden", !shouldOpen);
      card?.classList.toggle("is-open", shouldOpen);
      button.setAttribute("aria-expanded", String(shouldOpen));
      if (text) {
        text.textContent = shouldOpen ? "收起管理" : "展开管理";
      }
    });
  });

  root.querySelectorAll("[data-save-enrollment]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-admin-student-id]");
      const status = card?.querySelector("[data-save-status]");
      const buttonLabel = button.textContent || "保存购课";
      const studentId = Number(card?.dataset.adminStudentId);
      if (!card || !studentId) {
        return;
      }
      const checkedSubjects = [
        ...card.querySelectorAll("input[data-subject-course-ids]:checked"),
      ];
      const courseIds = [
        ...new Set(
          checkedSubjects.flatMap((input) =>
            (input.dataset.subjectCourseIds || "")
              .split(",")
              .filter(Boolean)
              .map((courseId) => Number(courseId))
          ),
        ),
      ].sort((a, b) => a - b);
      button.disabled = true;
      button.classList.add("is-saving");
      button.textContent = "正在保存购课...";
      if (status) {
        status.className = "save-feedback is-saving-text";
        status.textContent = "正在保存当前学生的购课选择，请稍候…";
      }
      try {
        await apiFetch("/api/admin/enrollments", {
          method: "POST",
          body: JSON.stringify({
            student_id: studentId,
            course_ids: courseIds,
          }),
        });
        if (status) {
          status.className = "save-feedback is-success";
          status.textContent = `✓ 已保存 ${checkedSubjects.length} 个科目`;
        }
        const summary = card.querySelector("[data-student-enrollment-summary]");
        if (summary) {
          summary.textContent = summary.textContent.replace(
            /已开通 \d+ 个科目$/,
            `已开通 ${checkedSubjects.length} 个科目`,
          );
        }
      } catch (error) {
        if (status) {
          status.className = "save-feedback is-error";
          status.textContent = `保存失败：${error.message}`;
        }
      } finally {
        button.disabled = false;
        button.classList.remove("is-saving");
        button.textContent = buttonLabel;
      }
    });
  });

  root.querySelectorAll("[data-delete-student]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-admin-student-id]");
      const status = card?.querySelector("[data-profile-save-status]");
      const studentId = Number(card?.dataset.adminStudentId);
      const studentName = card?.querySelector(".subject-title")?.textContent?.trim() || "该学生";
      if (!card || !studentId) {
        return;
      }
      if (
        !window.confirm(
          `确定删除 ${studentName} 吗？删除后该学生账号、购课记录和学习记录都会被移除。`,
        )
      ) {
        return;
      }
      button.disabled = true;
      if (status) {
        status.textContent = "删除中...";
      }
      try {
        await apiFetch(`/api/admin/students/${studentId}`, {
          method: "DELETE",
        });
        card.remove();
      } catch (error) {
        if (status) {
          status.textContent = error.message;
        }
        button.disabled = false;
      }
    });
  });
}

async function initGrowthPage() {
  setPageLoading(true);
  const user = await requireSession();
  if (!user) {
    setPageLoading(false);
    return;
  }
  setUserProfile(user);
  wireLogoutButton();

  let result;
  try {
    result = await apiFetch("/api/growth", {
      cacheTtlMs: API_PREFETCH_CACHE_TTL_MS,
    });
  } catch (error) {
    setPageLoading(false);
    keepStaticPage(error);
    return;
  }
  const data = result.data;
  const root = document.getElementById("growth-root");
  if (!root) {
    setPageLoading(false);
    return;
  }

  const studyHours = `${Math.floor((data.metrics.study_minutes || 0) / 60)}h ${String((data.metrics.study_minutes || 0) % 60).padStart(2, "0")}m`;
  const radarLabelMap = ["l1", "l2", "l3", "l4", "l5"];
  const radarLabels = data.radar
    .map(
      (item, index) => `<div class="radar-label ${radarLabelMap[index] || ""}">${escapeHtml(item.label)} ${item.value}%</div>`,
    )
    .join("");
  const polygonStyle = data.radar
    .map((item, index) => {
      const angle = (-90 + index * 72) * (Math.PI / 180);
      const radius = item.value / 2;
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      return `${x}% ${y}%`;
    })
    .join(", ");

  root.innerHTML = `
    <div class="growth-ai-hero">
      <div class="growth-ai-text">
        <div class="ai-badge">✨ 星途 AI 学情引擎</div>
        <h2 class="growth-ai-title">${escapeHtml(data.headline)}</h2>
        <p class="growth-ai-desc">${escapeHtml(data.summary)}</p>
        <div class="growth-highlight-row">
          <span class="mini-chip">优势学科：${escapeHtml(data.strong_subject)}</span>
          <span class="mini-chip">重点回流：${escapeHtml(data.weak_subject)}</span>
        </div>
      </div>
      <div class="radar-container">
        <div class="radar-ring"></div>
        <div class="radar-ring"></div>
        <div class="radar-ring"></div>
        <div class="radar-polygon" data-radar-polygon="${escapeHtml(polygonStyle)}"></div>
        ${radarLabels}
      </div>
    </div>

    <div class="growth-stats-grid">
      <div class="growth-stat-card">
        <div class="growth-stat-label">近阶段学习时长</div>
        <div class="growth-stat-value">${studyHours}</div>
        <div class="muted growth-stat-note">依据课程页实际学习停留记录</div>
      </div>
      <div class="growth-stat-card">
        <div class="growth-stat-label">AI 评估掌握率</div>
        <div class="growth-stat-value">${data.metrics.mastery_rate}<span class="growth-stat-unit is-percent">%</span></div>
        <div class="muted growth-stat-note">基于完成节点与复习状态测算</div>
      </div>
      <div class="growth-stat-card">
        <div class="growth-stat-label">最近平均得分</div>
        <div class="growth-stat-value">${data.metrics.avg_score}<span class="growth-stat-unit">分</span></div>
        <div class="muted growth-stat-note">当前错题 ${data.metrics.mistake_count} 道</div>
      </div>
    </div>

    <div class="growth-rule-grid">
      <article class="card">
        <div class="section-head">
          <h2 class="section-title">AI 判断规则结果</h2>
          <span class="stat-chip">动态生成</span>
        </div>
        <div class="growth-rule-list">
          ${data.focus_rules.map((rule) => `<div class="growth-rule-item">${escapeHtml(rule)}</div>`).join("")}
        </div>
      </article>
      <article class="card">
        <div class="section-head">
          <h2 class="section-title">最近学习行为</h2>
          <span class="stat-chip">学习记录</span>
        </div>
        <div class="growth-activity-list">
          ${
    data.recent_actions.length
      ? data.recent_actions
        .map(
          (item) => `
                    <div class="growth-activity-item">
                      <div class="growth-activity-dot"></div>
                      <div>
                        <strong>${escapeHtml(item.title)}</strong>
                        <p>${escapeHtml(item.summary)}</p>
                        <span>${escapeHtml(item.time)}</span>
                      </div>
                    </div>
                  `,
        )
        .join("")
      : '<p class="muted compact-empty-text">暂无最近学习行为。</p>'
  }
        </div>
      </article>
    </div>
  `;
  const radarPolygon = root.querySelector(".radar-polygon");
  if (radarPolygon) {
    radarPolygon.style.setProperty(
      "--radar-polygon",
      `polygon(${polygonStyle})`,
    );
  }
  setPageLoading(false);
}
