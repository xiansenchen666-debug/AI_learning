const USER_CACHE_KEY = "stq-user-profile";
const LAST_SUBJECT_LOCATION_KEY = "stq-last-subject-location";
const ROUTE_LOADING_LABEL_KEY = "stq-route-loading-label";
const API_PREFETCH_CACHE_PREFIX = "stq-api-prefetch:";
const API_PREFETCH_CACHE_TTL_MS = 10 * 60 * 1000;
const API_COURSE_CACHE_TTL_MS = 30 * 60 * 1000;
const API_INFLIGHT_REQUESTS = new Map();

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
    clearApiPrefetchCache(/^\/api\/(admin|login|logout)/.test(String(url)));
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
  const inflightKey = method === "GET" ? String(url) : "";
  if (inflightKey && API_INFLIGHT_REQUESTS.has(inflightKey)) {
    return await API_INFLIGHT_REQUESTS.get(inflightKey);
  }
  const request = (async () => {
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
  })();
  if (inflightKey) API_INFLIGHT_REQUESTS.set(inflightKey, request);
  try {
    return await request;
  } finally {
    if (inflightKey) API_INFLIGHT_REQUESTS.delete(inflightKey);
  }
}

function defaultApiCacheTtl(url) {
  const path = String(url || "");
  if (!path.startsWith("/api/")) {
    return 0;
  }
  if (
    /^\/api\/course\/\d+/.test(path) ||
    /^\/api\/lessons\/\d+\/question-bank/.test(path) ||
    /^\/api\/teacher\/students\/\d+\/(growth|overview)/.test(path)
  ) {
    return API_COURSE_CACHE_TTL_MS;
  }
  if (
    path === "/api/dashboard" ||
    path === "/api/subjects" ||
    path === "/api/mistakes" ||
    path === "/api/growth" ||
    path === "/api/session" ||
    path === "/api/teacher/students" ||
    path === "/api/admin/enrollments"
  ) {
    return API_PREFETCH_CACHE_TTL_MS;
  }
  return 0;
}

function clearApiPrefetchCache(includeStatic = true) {
  try {
    const keys = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(API_PREFETCH_CACHE_PREFIX)) {
        const apiPath = key.slice(API_PREFETCH_CACHE_PREFIX.length);
        if (
          !includeStatic &&
          (apiPath === "/api/subjects" ||
            /^\/api\/course\/\d+/.test(apiPath) ||
            /^\/api\/lessons\/\d+\/question-bank/.test(apiPath))
        ) {
          continue;
        }
        keys.push(key);
      }
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Ignore cache errors silently.
  }
}

function clearQuestionProgressCache() {
  try {
    const keys = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(API_PREFETCH_CACHE_PREFIX)) continue;
      const apiPath = key.slice(API_PREFETCH_CACHE_PREFIX.length);
      if (
        /^\/api\/lessons\/\d+\/question-bank/.test(apiPath) ||
        /^\/api\/course\/\d+/.test(apiPath)
      ) {
        keys.push(key);
      }
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Ignore storage errors silently.
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

function redirectTeacherToPortal(user) {
  if (!isTeacherUser(user) || window.location.protocol === "file:") {
    return false;
  }
  setPageLoading(false);
  window.location.replace("/teacher");
  return true;
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
  const responseInput = card.querySelector("[data-question-response]");
  const selectedValue = selected?.value || responseInput?.value.trim() || "";
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
  if (responseInput) {
    responseInput.disabled = isLocked;
  }
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
  const assessedCards = submittedCards.filter((card) =>
    card.dataset.correct === "1" || card.dataset.correct === "0"
  );
  const reviewed = session.dataset.reviewed === "1";
  const correctCount = assessedCards.filter((card) =>
    card.dataset.correct === "1"
  ).length;
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
    reviewButton.disabled = submittedCards.length < total || reviewed;
    reviewButton.textContent = submittedCards.length >= total
      ? "对答案"
      : `完成后对答案（${submittedCards.length}/${total}）`;
  }
  if (hint) {
    if (reviewed) {
      const pendingCount = submittedCards.length - assessedCards.length;
      hint.textContent = pendingCount
        ? `还有 ${pendingCount} 道主观题需要核对参考答案并自评。`
        : `已对答案：${correctCount}/${assessedCards.length || 0} 题正确。`;
    } else if (submittedCards.length === 0) {
      hint.textContent = "先完成作答并提交，解析会在对答案后出现。";
    } else if (submittedCards.length < total) {
      hint.textContent = `还有 ${total - submittedCards.length} 题未提交，请完成全部题目后统一对答案。`;
    } else {
      hint.textContent = "本组题已提交完成，现在可以统一对答案。";
    }
  }
}

function updatePracticeReviewSummary(session) {
  const cards = [...session.querySelectorAll("[data-question-id]")];
  const submittedCards = cards.filter((card) => card.dataset.submitted === "1");
  const assessedCards = submittedCards.filter((card) =>
    card.dataset.correct === "1" || card.dataset.correct === "0"
  );
  const correctCount = assessedCards.filter((card) =>
    card.dataset.correct === "1"
  ).length;
  const wrongCount = assessedCards.length - correctCount;
  const pendingCount = submittedCards.length - assessedCards.length;
  const accuracy = assessedCards.length
    ? Math.round((correctCount / assessedCards.length) * 100)
    : 0;
  const summary = session.querySelector("[data-practice-summary]");
  if (!summary) return;
  let reviewAdvice = "本次已提交题目全部掌握，可以继续完成剩余题目。";
  if (pendingCount) {
    reviewAdvice = `还有 ${pendingCount} 道主观题需要自评。`;
  } else if (wrongCount) {
    reviewAdvice = `有 ${wrongCount} 题需要订正，先看标记题目，再回到正文补概念。`;
  }
  summary.classList.remove("is-hidden");
  summary.innerHTML = `
    <strong>${assessedCards.length ? `${accuracy}分` : "待自评"}</strong>
    <span>已提交 ${submittedCards.length}/${cards.length} 题，已评 ${assessedCards.length} 题。${reviewAdvice}</span>
  `;
}

function revealPracticeAnswers(session) {
  if (!session) {
    return;
  }
  session.dataset.reviewed = "1";
  const cards = [...session.querySelectorAll("[data-question-id]")];
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
    if (
      card.dataset.requiresSelfAssessment === "1" &&
      card.dataset.correct !== "1" && card.dataset.correct !== "0"
    ) {
      resultNode.textContent = `你的答案：${selectedAnswer}。请核对参考答案后选择“已掌握”或“需复习”。`;
      resultNode.className = "question-result is-info";
      return;
    }
    if (card.dataset.correct === "1") {
      resultNode.textContent = `答对了。你的答案：${selectedAnswer}`;
      resultNode.className = "question-result is-success";
    } else {
      resultNode.textContent = `需要订正。你的答案：${selectedAnswer}；正确答案：${card.dataset.correctAnswer || "暂无"}`;
      resultNode.className = "question-result is-error";
    }
  });
  updatePracticeReviewSummary(session);
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
    session.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) ||
        !target.matches("[data-question-response]")) {
        return;
      }
      const card = target.closest("[data-question-id]");
      if (!card || card.dataset.submitted === "1") return;
      const resultNode = card.querySelector(".question-result");
      if (resultNode) {
        resultNode.textContent = target.value.trim()
          ? "已填写，点击“提交本题”后进入对答案队列。"
          : "请填写你的答案。";
        resultNode.className = "question-result is-info";
      }
      syncQuestionOptionState(card);
    });

    session.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const submitButton = target?.closest('[data-action="submit-question"]');
      const reviewButton = target?.closest('[data-action="review-answers"]');
      const selfAssessButton = target?.closest('[data-action="self-assess"]');
      if (reviewButton && session.contains(reviewButton)) {
        revealPracticeAnswers(session);
        return;
      }
      if (selfAssessButton && session.contains(selfAssessButton)) {
        const card = selfAssessButton.closest("[data-question-id]");
        const questionId = card?.dataset.questionId;
        const statusNode = card?.querySelector("[data-self-assessment-status]");
        const resultNode = card?.querySelector(".question-result");
        const correct = selfAssessButton.dataset.selfAssessment === "1";
        if (!card || !questionId || !card.dataset.submittedAnswer) return;
        const buttons = [...card.querySelectorAll('[data-action="self-assess"]')];
        buttons.forEach((button) => button.disabled = true);
        if (statusNode) statusNode.textContent = "正在保存...";
        try {
          const result = await apiFetch(`/api/questions/${questionId}/submit`, {
            method: "POST",
            body: JSON.stringify({
              answer: card.dataset.submittedAnswer,
              self_assessed_correct: correct,
            }),
          });
          clearQuestionProgressCache();
          card.dataset.correct = result.data.correct ? "1" : "0";
          selfAssessButton.classList.add("is-selected");
          if (statusNode) {
            statusNode.textContent = result.data.correct
              ? "已记录为掌握"
              : "已加入错题本";
          }
          if (resultNode) {
            resultNode.textContent = result.data.correct
              ? "已掌握，本题记录已保存。"
              : "已标记为需复习，并加入错题本。";
            resultNode.className = result.data.correct
              ? "question-result is-success"
              : "question-result is-error";
          }
          updatePracticeReviewSummary(session);
          updatePracticeSessionState(session);
          selfAssessButton.dispatchEvent(
            new CustomEvent("question-submitted", {
              bubbles: true,
              detail: result.data,
            }),
          );
        } catch (error) {
          buttons.forEach((button) => button.disabled = false);
          if (statusNode) statusNode.textContent = `保存失败：${error.message}`;
        }
        return;
      }
      if (!submitButton || !session.contains(submitButton)) {
        return;
      }
      const card = submitButton.closest("[data-question-id]");
      const resultNode = card?.querySelector(".question-result");
      const questionId = card?.dataset.questionId;
      const selected = card?.querySelector("input[type='radio']:checked");
      const responseInput = card?.querySelector("[data-question-response]");
      const submittedAnswer = selected?.value || responseInput?.value.trim() ||
        "";
      if (!card || !questionId || !resultNode) {
        return;
      }
      if (!submittedAnswer) {
        resultNode.textContent = responseInput
          ? "请先填写你的答案。"
          : "请先选择一个答案。";
        resultNode.className = "question-result is-error";
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = "提交中";
      if (responseInput) {
        card.dataset.submitted = "1";
        card.dataset.submittedAnswer = submittedAnswer;
        resultNode.textContent = "已提交。完成本组后点“对答案”，再核对参考答案并自评。";
        resultNode.className = "question-result is-info";
        submitButton.textContent = "已提交";
        syncQuestionOptionState(card);
        updatePracticeSessionState(session);
        return;
      }
      try {
        const result = await apiFetch(`/api/questions/${questionId}/submit`, {
          method: "POST",
          body: JSON.stringify({ answer: submittedAnswer }),
        });
        clearQuestionProgressCache();
        card.dataset.submitted = "1";
        card.dataset.submittedAnswer = submittedAnswer;
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
        submitButton.disabled = !submittedAnswer;
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
  warmAllPageCache(result.user);
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
  document.querySelectorAll("[data-user-display-name]").forEach((node) => {
    const fullName = String(user.full_name || user.username || "").trim();
    node.textContent = user.role === "admin"
      ? "超级管理员"
      : user.role === "teacher" && fullName && !fullName.endsWith("老师")
      ? `${fullName}老师`
      : fullName;
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
  ensureStudentPortalTopbar(user);
  applyUserProfile(user);
  cacheUserProfile(user);
  document.body.classList.add("profile-ready");
}

function ensureStudentPortalTopbar(user) {
  const page = document.body.dataset.page || "";
  const supportedPages = new Set([
    "dashboard",
    "subjects",
    "grade",
    "course",
    "mistakes",
    "growth",
    "question-bank",
  ]);
  if (user?.role !== "student" || !supportedPages.has(page)) return;
  document.body.classList.add("is-student-portal");
  if (document.querySelector("[data-student-portal-topbar]")) return;
  const pageLabels = {
    dashboard: "学习中心",
    subjects: "全部课程",
    grade: "年级课程",
    course: "课程学习",
    mistakes: "智能错题本",
    growth: "成长轨迹",
    "question-bank": "题库练习",
  };
  const header = document.createElement("header");
  header.className = "student-portal-topbar";
  header.setAttribute("data-student-portal-topbar", "");
  header.innerHTML = `
    <strong>${escapeHtml(pageLabels[page] || "学习中心")}</strong>
    <div class="student-portal-account">
      <span class="student-topbar-avatar" data-avatar-text></span>
      <span class="student-topbar-name" data-user-name></span>
      <a href="/login" data-action="logout">退出</a>
    </div>`;
  const shell = document.querySelector(".app-shell");
  document.body.insertBefore(header, shell || document.body.firstChild);
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
  if (url.pathname === "/course") {
    const courseId = url.searchParams.get("id") || url.searchParams.get("course");
    return courseId ? `/api/course/${encodeURIComponent(courseId)}` : "";
  }
  if (url.pathname === "/question-bank") {
    const lessonId = url.searchParams.get("lesson");
    return lessonId
      ? `/api/lessons/${encodeURIComponent(lessonId)}/question-bank`
      : "";
  }
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

function warmStudentApiCache(user) {
  if (!user || isTeacherUser(user)) {
    return;
  }
  ["/api/dashboard", "/api/mistakes", "/api/growth"]
    .forEach((url) => {
      apiFetch(url, { cacheTtlMs: API_PREFETCH_CACHE_TTL_MS }).catch(() => {});
    });
  apiFetch("/api/subjects", { cacheTtlMs: API_PREFETCH_CACHE_TTL_MS })
    .then((result) => {
      const purchasedCourses = (result.data?.stages || [])
        .flatMap((stage) =>
          (stage.subjects || []).flatMap((subject) => subject.courses || [])
        )
        .filter((course) => course.purchased !== false && course.id);
      purchasedCourses.forEach((course, index) => {
        scheduleBackgroundTask(async () => {
          try {
            const courseResult = await apiFetch(`/api/course/${course.id}`, {
              cacheTtlMs: API_COURSE_CACHE_TTL_MS,
            });
            if (index === 0) {
              prefetchCourseQuestionBanks(courseResult.data?.lessons || []);
            }
          } catch {
            // A later page visit can retry an individual course.
          }
        }, 150 + index * 180);
      });
    })
    .catch(() => {});
}

function warmTeacherApiCache(user) {
  if (!user || user.role !== "teacher") return;
  apiFetch("/api/teacher/students", {
    cacheTtlMs: API_PREFETCH_CACHE_TTL_MS,
  }).then((result) => {
    const students = result.data?.students || [];
    students.forEach((student, index) => {
      if (!student?.id) return;
      scheduleBackgroundTask(() => {
        Promise.allSettled([
          apiFetch(`/api/teacher/students/${student.id}/overview`, {
            cacheTtlMs: API_COURSE_CACHE_TTL_MS,
          }),
          apiFetch(`/api/teacher/students/${student.id}/growth`, {
            cacheTtlMs: API_COURSE_CACHE_TTL_MS,
          }),
        ]);
      }, 200 + index * 260);
    });
  }).catch(() => {});
}

function warmAllPageCache(user) {
  const pages = [
    "/dashboard",
    "/subjects",
    "/grade",
    "/course",
    "/question-bank",
    "/mistakes",
    "/growth",
    "/teacher",
  ];
  pages.forEach((path) => {
    prefetchPage(new URL(path, window.location.origin));
  });
  warmStudentApiCache(user);
  if (user?.role === "teacher") {
    warmTeacherApiCache(user);
  } else if (user?.role === "admin") {
    apiFetch("/api/admin/enrollments", {
      cacheTtlMs: API_PREFETCH_CACHE_TTL_MS,
    }).catch(() => {});
  }
}

function prefetchCourseQuestionBanks(lessons = []) {
  lessons.filter((lesson) =>
    Number(lesson?.bank_question_count || lesson?.textbook_question_count) > 0
  ).forEach((lesson, index) => {
    if (!lesson.id) {
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
  if (redirectTeacherToPortal(user)) return;
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
  const sourceLabel = question.lesson_label || question.source_label ||
    `${sourcePrefix} ${index + 1} 题`;
  const answerControl = options.length
    ? `<div class="question-options" role="radiogroup" aria-label="${escapeHtml(sourceLabel)}">
        ${
      options.map((option, optionIndex) => `
          <label class="question-option">
            <input type="radio" name="${escapeHtml(questionName)}" value="${escapeHtml(option)}">
            <span class="question-option-mark">${String.fromCharCode(65 + optionIndex)}</span>
            <span class="question-option-text">${escapeHtml(option)}</span>
          </label>
        `).join("")
    }
      </div>`
    : `<label class="question-free-response">
        <span>你的作答</span>
        <textarea data-question-response rows="3" maxlength="1000" placeholder="在这里填写答案"></textarea>
      </label>`;
  return `
    <article
      class="practice-question-card ${cardClass}"
      data-question-id="${question.id}"
      data-correct-answer="${escapeHtml(question.answer || "")}"
      data-explanation="${escapeHtml(question.explanation || "暂无解析。")}"
      data-requires-self-assessment="${options.length ? "0" : "1"}"
      data-submitted="0"
    >
      <div class="practice-question-topline">
        <p class="question-source-label">${escapeHtml(sourceLabel)}</p>
        <span>第 ${index + 1} 题</span>
      </div>
      <h4 class="lesson-question-title">${escapeHtml(question.question)}</h4>
      ${renderQuestionSourceFigure(question)}
      ${answerControl}
      <div class="lesson-question-actions">
        <button class="primary-button submit-question" type="button" data-action="submit-question" disabled>提交本题</button>
        <span class="question-result is-info">${options.length ? "请选择一个答案。" : "请填写你的答案。"}</span>
      </div>
      <div class="feedback-box lesson-answer-box answer-review-box is-hidden" data-answer-review>
        <p><strong>正确答案：</strong><span data-review-answer>${escapeHtml(question.answer || "暂无答案")}</span></p>
        <p><strong>解析：</strong><span data-review-explanation>${escapeHtml(question.explanation || "暂无解析。")}</span></p>
        ${
    options.length
      ? ""
      : `<div class="question-self-assessment">
            <span>核对后自评</span>
            <div>
              <button type="button" data-action="self-assess" data-self-assessment="1">已掌握</button>
              <button type="button" data-action="self-assess" data-self-assessment="0">需复习</button>
            </div>
            <small data-self-assessment-status aria-live="polite"></small>
          </div>`
  }
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
  if (redirectTeacherToPortal(user)) return;
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
      if (typeof detail.correct_count === "number") {
        targetLesson.correct_count = detail.correct_count;
      } else if (
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
  if (redirectTeacherToPortal(user)) return;
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
  if (redirectTeacherToPortal(user)) return;
  setUserProfile(user);
  wireLogoutButton();

  const params = new URLSearchParams(window.location.search);
  let lessonId = params.get("lesson");
  let courseId = params.get("course");
  const root = document.getElementById("question-bank-root");
  const listRoot = root?.querySelector("[data-question-bank-list]");
  const emptyRoot = root?.querySelector("[data-question-bank-empty]");
  const countNode = root?.querySelector("[data-question-bank-count]");
  if (!root) {
    setPageLoading(false);
    return;
  }
  if (!lessonId) {
    try {
      const subjects = await apiFetch("/api/subjects", {
        cacheTtlMs: API_PREFETCH_CACHE_TTL_MS,
      });
      const firstCourse = (subjects.data?.stages || []).flatMap((stage) => (stage.subjects || []).flatMap((subject) => subject.courses || [])).find((course) => course.purchased !== false);
      if (firstCourse) {
        const courseResult = await apiFetch(`/api/course/${firstCourse.id}`, {
          cacheTtlMs: API_COURSE_CACHE_TTL_MS,
        });
        const courseLessons = courseResult.data?.lessons || [];
        const firstLesson = courseLessons.find((item) =>
          Number(item.bank_question_count || item.textbook_question_count) > 0
        ) || courseLessons[0];
        courseId = String(firstCourse.id);
        lessonId = firstLesson ? String(firstLesson.id) : "";
      }
    } catch (error) {
      if (listRoot) {
        listRoot.innerHTML = `<div class="card"><p class="muted mistakes-empty-text">${escapeHtml(error.message)}</p></div>`;
      }
    }
  }
  if (!lessonId) {
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
  const modeTitle = root.querySelector("[data-question-bank-mode-title]");
  const emptyTitle = root.querySelector("[data-question-bank-empty-title]");
  const emptyCopy = root.querySelector("[data-question-bank-empty-copy]");
  const gradeLockNode = root.querySelector("[data-question-bank-grade-lock]");
  const modeButtons = [...document.querySelectorAll("[data-practice-mode]")];
  const modeQuestions = {
    chapter: data.practice_modes?.chapter || data.questions || [],
    exam: data.practice_modes?.exam || data.questions || [],
    focus: data.practice_modes?.focus || data.questions || [],
  };
  const courseTitle = cleanCourseDisplayTitle(data.course.title);
  const lessonCount = Number(
    data.practice_mode_meta?.course_lesson_count || 0,
  );
  const chapterQuestionCount = Number(
    data.practice_mode_meta?.chapter_question_count ||
      modeQuestions.chapter.length,
  );
  const focusMistakeCount = Number(
    data.practice_mode_meta?.focus_mistake_count || 0,
  );
  const modeConfigs = {
    chapter: {
      heading: `${data.lesson.order}. ${data.lesson.title}`,
      subtitle: `${courseTitle} / ${data.course.grade} / ${data.course.subject}`,
      panelTitle: "章节练习",
      kicker: "CHAPTER PRACTICE",
      description: chapterQuestionCount > modeQuestions.chapter.length
        ? `当前知识点共 ${chapterQuestionCount} 道题，本次练习 ${modeQuestions.chapter.length} 道。`
        : "练习当前知识点题目，逐题提交后再统一查看答案和解析。",
      emptyTitle: "当前章节暂无题目",
      emptyCopy: "可返回课程选择其他知识点，或切换到模拟考试。",
    },
    exam: {
      heading: `${courseTitle} · 模拟考试`,
      subtitle: `${data.course.grade} / ${data.course.subject} / ${lessonCount || 1} 个知识点综合组卷`,
      panelTitle: "课程模拟考试",
      kicker: "COURSE MOCK EXAM",
      description: "从本课程不同知识点抽取题目，完成后统一核对结果。",
      emptyTitle: "当前课程暂无可组卷题目",
      emptyCopy: "可返回全部课程选择其他已开通课程。",
    },
    focus: {
      heading: `${data.course.subject} · 专项练习`,
      subtitle: focusMistakeCount
        ? `优先安排 ${focusMistakeCount} 道历史薄弱题`
        : "暂无历史错题，先从未练题目建立学习记录",
      panelTitle: "薄弱点专项练习",
      kicker: "FOCUSED PRACTICE",
      description: focusMistakeCount
        ? "历史错题排在前面，完成订正后再继续同课程练习。"
        : "从尚未作答的题目开始，答错内容会自动进入错题本。",
      emptyTitle: "暂无专项练习题目",
      emptyCopy: "完成章节练习后，系统会根据作答记录更新专项内容。",
    },
  };
  if (backLink) {
    backLink.href = buildLessonHref(
      courseId || data.course.id,
      data.lesson.id,
    );
  }
  const modeSessions = new Map();
  let activeMode = "";

  const renderMode = (requestedMode, updateUrl = false) => {
    const mode = Object.hasOwn(modeConfigs, requestedMode)
      ? requestedMode
      : "chapter";
    const config = modeConfigs[mode];
    const questions = modeQuestions[mode] || [];
    if (title) title.textContent = config.heading;
    if (subtitle) subtitle.textContent = config.subtitle;
    if (modeTitle) modeTitle.textContent = config.panelTitle;
    if (gradeLockNode) {
      gradeLockNode.textContent = data.grade_lock?.message ||
        `本页只展示${data.course.grade}范围内的题目。`;
    }
    if (countNode) countNode.textContent = `${questions.length} 道`;
    if (summary) {
      summary.innerHTML = `
        <span class="workspace-badge"><strong>${questions.length}</strong><span>题目</span></span>
        <span class="workspace-badge"><strong>${escapeHtml(data.grade_lock?.grade || data.course.grade)}</strong><span>题库锁</span></span>
        <span class="workspace-badge"><strong>${escapeHtml(data.course.subject)}</strong><span>学科</span></span>
      `;
    }
    modeButtons.forEach((button) => {
      const active = button.dataset.practiceMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (listRoot) {
      const currentSession = listRoot.querySelector(".practice-session");
      if (activeMode && currentSession) {
        modeSessions.set(activeMode, currentSession);
      }
      const savedSession = modeSessions.get(mode);
      if (savedSession) {
        listRoot.replaceChildren(savedSession);
      } else {
        listRoot.innerHTML = questions.length
          ? renderPracticeSession({
            questions,
            scopeId: `bank-${mode}-${data.lesson.id}`,
            title: config.panelTitle,
            kicker: config.kicker,
            description: config.description,
            className: `bank-practice-session is-${mode}-mode`,
            sourcePrefix: "题库第",
            cardClass: "bank-page-question",
          })
          : "";
        const createdSession = listRoot.querySelector(".practice-session");
        if (createdSession) modeSessions.set(mode, createdSession);
      }
    }
    activeMode = mode;
    emptyRoot?.classList.toggle("is-hidden", questions.length > 0);
    if (emptyTitle) emptyTitle.textContent = config.emptyTitle;
    if (emptyCopy) emptyCopy.textContent = config.emptyCopy;
    root.classList.remove("is-hidden");
    wireQuestionSubmitButtons(root);
    if (updateUrl && window.history?.replaceState) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("mode", mode);
      window.history.replaceState(
        window.history.state,
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
      );
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      renderMode(button.dataset.practiceMode || "chapter", true);
    });
  });
  renderMode(params.get("mode") || "chapter");
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

const STUDENT_STAGE_OPTIONS = ["小学", "初中", "高中", "所有阶段"];

function renderStudentStageOptions(selectedStage = "") {
  const selected = String(selectedStage || "").trim();
  const options = STUDENT_STAGE_OPTIONS.includes(selected) || !selected ? STUDENT_STAGE_OPTIONS : [...STUDENT_STAGE_OPTIONS, selected];
  return options.map((stage) => {
    const selectedAttr = selected === stage ? " selected" : "";
    return `<option value="${escapeHtml(stage)}"${selectedAttr}>${escapeHtml(stage)}</option>`;
  }).join("");
}

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
          ${
      stageGroup.grades.map((group) => {
        const subjects = [
          ...new Set(group.courses.map((course) => course.subject)),
        ];
        const unlocked = group.courses.filter((course) => course.purchased).length;
        const progress = group.courses.length ? Math.round((unlocked / group.courses.length) * 100) : 0;
        const isCurrent = group.stage === userStage &&
          group.grade === userGrade;
        return `
              <a class="grade-entry-card ${config.className} ${isCurrent ? "is-current" : ""}" href="${escapeHtml(buildGradeHref(group.stage, group.grade))}">
                <span class="grade-entry-topline">
                  <span class="grade-entry-stage">${escapeHtml(config.label)} · ${escapeHtml(config.en)}</span>
                  ${isCurrent ? '<span class="grade-current-chip">当前</span>' : ""}
                </span>
                <strong>${escapeHtml(group.grade)}</strong>
                <span class="grade-entry-subjects">${
          subjects.slice(0, 4).map((subject) => `<b>${escapeHtml(subject)}</b>`)
            .join("")
        }</span>
                <span class="grade-progress-line"><i style="width: ${progress}%"></i></span>
                <span class="grade-entry-foot">
                  <em>${unlocked}/${group.courses.length} 已开通</em>
                  <span>查看科目</span>
                </span>
              </a>
            `;
      }).join("")
    }
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
  const config = SUBJECT_STAGE_CONFIGS[group.stage] ||
    SUBJECT_STAGE_CONFIGS["小学"];
  return `
    <div class="grade-directory-head">
      <div>
        <p class="stage-eyebrow">SUBJECTS</p>
        <h2 class="section-title">选择科目</h2>
      </div>
      <span>${subjectGroups.length} 个科目 · ${group.courses.length} 本课本</span>
    </div>
    ${
    subjectGroups.map(([subjectName, subjectCourses]) => `
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
    `).join("")
  }
  `;
}

async function initSubjectsPage() {
  setPageLoading(true);
  const user = await requireSession();
  if (!user) {
    setPageLoading(false);
    return;
  }
  if (redirectTeacherToPortal(user)) return;
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
  if (redirectTeacherToPortal(user)) return;
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
  document.body.classList.toggle("is-teacher-portal", user.role === "teacher");
  document.body.classList.toggle("is-admin-portal", user.role === "admin");
  document.querySelector("[data-teacher-portal-topbar]")?.classList.toggle(
    "is-hidden",
    user.role !== "teacher",
  );
  document.querySelector("[data-admin-portal-topbar]")?.classList.toggle(
    "is-hidden",
    user.role !== "admin",
  );
  document.querySelectorAll("[data-admin-only]").forEach((node) => {
    node.classList.toggle("is-hidden", user.role !== "admin");
  });
  if (user.role === "admin") {
    wireAdminReferenceDialogs();
    wireStudentCreateForm(user);
    wireTeacherCreateForm();
  }
  wireTeacherPortalMenus(user);
  initTeacherManagementTabs(user);
  await Promise.all([
    initModelSettingsPanel(user),
    initTeacherEnrollmentPanel(user),
    initTeacherStudentSwitcher(user),
    initTeacherOverview(user),
    initTeacherRecordPanel(user),
    initTeacherGrowthPanel(user),
  ]);
  syncTeacherStudentSelection();
  window.dispatchEvent(new CustomEvent("teacher-management-view-changed", {
    detail: {
      view: new URL(window.location.href).searchParams.get("view"),
    },
  }));
}

function wireTeacherPortalMenus(user) {
  if (user?.role !== "teacher") return;
  const trigger = document.querySelector("[data-teacher-workspace-trigger]");
  const dropdown = document.querySelector("[data-teacher-workspace-dropdown]");
  if (!trigger || !dropdown || trigger.dataset.bound === "1") return;
  trigger.dataset.bound = "1";
  const closeMenu = () => {
    dropdown.classList.add("is-hidden");
    trigger.setAttribute("aria-expanded", "false");
  };
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const shouldOpen = dropdown.classList.contains("is-hidden");
    dropdown.classList.toggle("is-hidden", !shouldOpen);
    trigger.setAttribute("aria-expanded", String(shouldOpen));
  });
  dropdown.addEventListener("click", (event) => {
    if (event.target.closest("[data-management-view-link]")) closeMenu();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".teacher-workspace-menu")) closeMenu();
  });
}

function initTeacherManagementTabs(user) {
  const menu = document.querySelector("[data-management-menu]");
  const title = document.querySelector("[data-management-page-title]");
  const links = () => [
    ...document.querySelectorAll("[data-management-view-link]"),
  ];
  const panels = [...document.querySelectorAll("[data-management-view-panel]")];
  if (!menu || !links().length || !panels.length) return;

  const adminViews = ["teachers", "students", "enrollments", "data", "models"];
  const teacherViews = ["overview", "records", "growth"];
  const allowedViews = user.role === "admin" ? adminViews : teacherViews;
  const defaultView = allowedViews[0];
  const viewLabels = {
    teachers: "教师账号管理",
    students: "学生账号管理",
    enrollments: "学生分配与购课",
    models: "AI 模型配置",
    data: "数据中心",
    overview: "学生总览",
    records: "课后辅导记录",
    growth: "学生成长规划",
  };

  links().forEach((link) => {
    const adminLink = link.hasAttribute("data-admin-management-link");
    const teacherLink = link.hasAttribute("data-teacher-management-link");
    link.classList.toggle(
      "is-hidden",
      (adminLink && user.role !== "admin") ||
        (teacherLink && user.role !== "teacher"),
    );
  });
  menu.classList.remove("is-hidden");

  const activateView = (requestedView, updateHistory = false) => {
    const view = allowedViews.includes(requestedView)
      ? requestedView
      : defaultView;
    panels.forEach((panel) => {
      panel.classList.toggle(
        "is-hidden",
        panel.dataset.managementViewPanel !== view,
      );
    });
    links().forEach((link) => {
      const activeView = user.role === "admin" && view === "enrollments"
        ? "students"
        : view;
      const isActive = link.dataset.managementViewLink === activeView;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (title) title.textContent = viewLabels[view] || "老师管理";

    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (updateHistory) history.pushState({ managementView: view }, "", nextUrl);
    else history.replaceState({ managementView: view }, "", nextUrl);
    window.dispatchEvent(new CustomEvent("teacher-management-view-changed", {
      detail: { view },
    }));
  };

  if (document.body.dataset.managementTabsBound !== "1") {
    document.body.dataset.managementTabsBound = "1";
    document.addEventListener("click", (event) => {
      const link = event.target.closest("[data-management-view-link]");
      if (!link || link.classList.contains("is-hidden")) return;
      const requestedView = link.dataset.managementViewLink;
      if (!allowedViews.includes(requestedView)) return;
      event.preventDefault();
      const studentId = String(link.dataset.studentId || "");
      if (studentId) {
        const url = new URL(window.location.href);
        url.searchParams.set("student", studentId);
        history.replaceState(
          history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      }
      activateView(requestedView, true);
    });
    window.addEventListener("popstate", () => {
      const view = new URL(window.location.href).searchParams.get("view");
      activateView(view, false);
    });
  }

  activateView(new URL(window.location.href).searchParams.get("view"), false);
}

function syncTeacherStudentSelection(studentId = "") {
  const topSelect = document.querySelector("[data-teacher-student-select]");
  if (!topSelect || topSelect.disabled) return "";
  const requestedId = String(
    studentId || new URL(window.location.href).searchParams.get("student") ||
      topSelect.value || "",
  );
  const validId = [...topSelect.options].some((option) =>
      option.value === requestedId
    )
    ? requestedId
    : String(topSelect.options[0]?.value || "");
  if (!validId) return "";
  topSelect.value = validId;

  const recordSelect = document.querySelector("[data-record-student-select]");
  const growthSelect = document.querySelector("[data-growth-student-select]");
  if (recordSelect) recordSelect.value = validId;
  if (growthSelect) growthSelect.value = validId;

  const selectedName = topSelect.selectedOptions[0]?.textContent?.trim() ||
    "当前学生";
  document.querySelectorAll("[data-current-teacher-student]").forEach((node) => {
    node.textContent = `当前学生：${selectedName}`;
  });
  return validId;
}

async function initTeacherStudentSwitcher(user) {
  const switcher = document.querySelector("[data-teacher-student-switcher]");
  const select = switcher?.querySelector("[data-teacher-student-select]");
  if (!switcher || !select || user.role !== "teacher") return;
  switcher.classList.remove("is-hidden");
  try {
    const result = await apiFetch("/api/teacher/students");
    const students = result.data?.students || [];
    if (!students.length) {
      select.innerHTML = '<option value="">暂无分配学生</option>';
      select.disabled = true;
      return;
    }
    select.innerHTML = students.map((student) => {
      const name = student.full_name || student.username || "学生";
      const account = student.username && student.username !== name
        ? `（${student.username}）`
        : "";
      return `<option value="${student.id}">${escapeHtml(`${name}${account}`)}</option>`;
    }).join("");
    select.disabled = false;
    const selectedId = syncTeacherStudentSelection();
    const url = new URL(window.location.href);
    url.searchParams.set("student", selectedId);
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (switcher.dataset.bound !== "1") {
      switcher.dataset.bound = "1";
      select.addEventListener("change", () => {
        const studentId = syncTeacherStudentSelection(select.value);
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("student", studentId);
        history.replaceState(
          history.state,
          "",
          `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
        );
        window.dispatchEvent(new CustomEvent("teacher-student-selected", {
          detail: { studentId },
        }));
      });
    }
  } catch (error) {
    select.innerHTML = '<option value="">学生读取失败</option>';
    select.disabled = true;
    console.warn(error);
  }
}

function showAdminNotice(message, state = "success") {
  let notice = document.querySelector("[data-admin-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.dataset.adminNotice = "";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    document.body.appendChild(notice);
  }
  window.clearTimeout(Number(notice.dataset.timer || 0));
  notice.className = `admin-reference-toast is-${state}`;
  notice.textContent = message;
  notice.classList.add("is-visible");
  notice.dataset.timer = String(window.setTimeout(() => {
    notice.classList.remove("is-visible");
  }, 3200));
}

function closeAdminModal(modal) {
  if (!modal) return;
  modal.classList.add("is-hidden");
  document.body.classList.remove("has-admin-modal");
}

function wireAdminReferenceDialogs() {
  const definitions = [
    {
      modal: document.querySelector("[data-teacher-create-modal]"),
      openSelector: "[data-open-teacher-create]",
      closeSelector: "[data-close-teacher-create]",
    },
    {
      modal: document.querySelector("[data-student-create-modal]"),
      openSelector: "[data-open-student-create]",
      closeSelector: "[data-close-student-create]",
    },
    {
      modal: document.querySelector("[data-student-edit-modal]"),
      openSelector: "[data-edit-student-account]",
      closeSelector: "[data-close-student-edit]",
    },
  ];
  definitions.forEach(({ modal, openSelector, closeSelector }) => {
    if (!modal || modal.dataset.bound === "1") return;
    modal.dataset.bound = "1";
    const form = modal.querySelector("form");
    const firstInput = form?.querySelector("input, select, textarea");
    const open = () => {
      form?.reset();
      modal.querySelectorAll("[aria-live]").forEach((node) => {
        node.textContent = "";
        node.className = "admin-reference-form-status";
      });
      modal.classList.remove("is-hidden");
      document.body.classList.add("has-admin-modal");
      window.requestAnimationFrame(() => firstInput?.focus());
    };
    document.querySelectorAll(openSelector).forEach((button) => {
      button.addEventListener("click", open);
    });
    modal.querySelectorAll(closeSelector).forEach((button) => {
      button.addEventListener("click", () => closeAdminModal(modal));
    });
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeAdminModal(modal);
    });
  });

  const modelEditor = document.querySelector("[data-model-editor]");
  if (modelEditor && modelEditor.dataset.bound !== "1") {
    modelEditor.dataset.bound = "1";
    document.querySelectorAll("[data-open-model-editor]").forEach((button) => {
      button.addEventListener("click", () => {
        modelEditor.classList.remove("is-hidden");
        modelEditor.scrollIntoView({ behavior: "smooth", block: "start" });
        modelEditor.querySelector("input")?.focus({ preventScroll: true });
      });
    });
    modelEditor.querySelectorAll("[data-close-model-editor]").forEach(
      (button) => {
        button.addEventListener("click", () => {
          modelEditor.classList.add("is-hidden");
        });
      },
    );
  }

  if (document.body.dataset.adminDialogEscapeBound !== "1") {
    document.body.dataset.adminDialogEscapeBound = "1";
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll(".admin-reference-modal:not(.is-hidden)")
        .forEach(closeAdminModal);
    });
  }
}

function wireTeacherCreateForm() {
  const form = document.getElementById("teacher-create-form");
  const status = document.getElementById("teacher-create-status");
  const submit = form?.querySelector('button[type="submit"]');
  if (!form || form.dataset.bound === "1") return;
  form.reset();
  const usernameInput = form.querySelector('[name="username"]');
  const passwordInput = form.querySelector('[name="password"]');
  if (usernameInput) usernameInput.value = "";
  if (passwordInput) passwordInput.value = "";
  form.dataset.bound = "1";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = Object.fromEntries(
      [...data.entries()].map(([key, value]) => [key, String(value).trim()]),
    );
    if (submit) submit.disabled = true;
    if (status) {
      status.className = "admin-reference-form-status is-saving-text";
      status.textContent = "正在创建教师账号...";
    }
    try {
      await apiFetch("/api/admin/teachers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      if (status) status.textContent = `教师账号 ${payload.username} 已创建`;
      await initTeacherEnrollmentPanel(readCachedUserProfile());
      closeAdminModal(document.querySelector("[data-teacher-create-modal]"));
      showAdminNotice(`教师账号 ${payload.username} 已创建`);
    } catch (error) {
      if (status) {
        status.className = "admin-reference-form-status is-error";
        status.textContent = error.message;
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

function renderTeacherAccountDirectory(teachers, students) {
  const list = document.getElementById("teacher-account-list");
  const count = document.querySelector("[data-teacher-account-count]");
  if (!list || !count) return;
  const sortedTeachers = [...teachers].sort((a, b) =>
    (Number(b.id) || 0) - (Number(a.id) || 0)
  );
  count.textContent = `${sortedTeachers.length} 个教师账号`;
  if (!sortedTeachers.length) {
    list.innerHTML = '<p class="teacher-account-empty">尚未创建教师账号</p>';
    return;
  }
  list.innerHTML = `
    <table class="admin-reference-table">
      <thead><tr><th>教师账号</th><th>姓名</th><th>邮箱</th><th>所属阶段</th><th>名下学生数</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>${sortedTeachers.map((teacher) => {
    const teacherName = teacher.full_name || teacher.username || "教师";
    const studentCount = students.filter((student) =>
      Number(student.teacher_id) === Number(teacher.id)
    ).length;
    return `
      <tr data-admin-search-row data-search-text="${escapeHtml(`${teacher.username || ""} ${teacherName} ${teacher.email || ""}`.toLowerCase())}">
        <td><strong>${escapeHtml(teacher.username || "")}</strong></td>
        <td><span class="admin-table-person"><i>${escapeHtml(teacherName.slice(0, 1))}</i>${escapeHtml(teacherName)}</span></td>
        <td>${escapeHtml(teacher.email || "未填写")}</td>
        <td>${escapeHtml(teacher.stage || "全部阶段")}</td>
        <td>${studentCount} 名</td>
        <td><span class="admin-status-pill">可用</span></td>
        <td>—</td>
      </tr>`;
  }).join("")}</tbody>
    </table>`;
}

function renderAdminStudentDirectory(students, teachers) {
  const list = document.getElementById("student-account-list");
  if (!list) return;
  const sortedStudents = [...students].sort((a, b) =>
    (Number(b.id) || 0) - (Number(a.id) || 0)
  );
  if (!sortedStudents.length) {
    list.innerHTML = '<p class="teacher-account-empty">尚未创建学生账号</p>';
    return;
  }
  list.innerHTML = `
    <table class="admin-reference-table">
      <thead><tr><th>学生账号</th><th>姓名</th><th>阶段</th><th>年级</th><th>负责教师</th><th>已购课程数</th><th>账号状态</th><th>有效期</th><th>操作</th></tr></thead>
      <tbody>${sortedStudents.map((student) => {
    const studentName = student.full_name || student.username || "学生";
    const teacher = teachers.find((item) =>
      Number(item.id) === Number(student.teacher_id)
    );
    const teacherName = teacher?.full_name || teacher?.username || "未分配";
    const isExpired = Number(student.access_remaining_days) === 0 &&
      Boolean(student.access_expires_on);
    return `
      <tr data-admin-search-row data-search-text="${escapeHtml(`${student.username || ""} ${studentName} ${teacherName}`.toLowerCase())}">
        <td><strong>${escapeHtml(student.username || "")}</strong></td>
        <td><span class="admin-table-person"><i>${escapeHtml(studentName.slice(0, 1))}</i>${escapeHtml(studentName)}</span></td>
        <td>${escapeHtml(student.stage || "-")}</td>
        <td>${escapeHtml(student.grade || "-")}</td>
        <td><select class="admin-reference-row-select" data-admin-assignment-select data-student-id="${student.id}" aria-label="为 ${escapeHtml(studentName)} 分配教师"><option value="">未分配</option>${teachers.map((item) => `<option value="${item.id}" ${Number(item.id) === Number(student.teacher_id) ? "selected" : ""}>${escapeHtml(item.full_name || item.username || "教师")}</option>`).join("")}</select></td>
        <td>${(student.course_ids || []).length}</td>
        <td><span class="admin-status-pill ${isExpired ? "is-expired" : ""}">${isExpired ? "已到期" : "有效"}</span></td>
        <td>${escapeHtml(student.access_expires_on || "长期有效")}</td>
        <td><span class="admin-table-actions"><button class="admin-table-action" type="button" data-edit-student-account data-student-id="${student.id}">编辑</button><button class="admin-table-action" type="button" data-save-admin-assignment data-student-id="${student.id}">保存教师</button><button class="admin-table-action" type="button" data-management-view-link="enrollments" data-admin-management-link data-student-id="${student.id}">课程</button></span></td>
      </tr>`;
  }).join("")}</tbody>
    </table>`;
  wireAdminStudentAssignments(students);
  wireAdminStudentEditor(students, teachers);
}

function wireAdminStudentAssignments(students) {
  document.querySelectorAll("[data-save-admin-assignment]").forEach((button) => {
    if (button.dataset.bound === "1") return;
    button.dataset.bound = "1";
    button.addEventListener("click", async () => {
      const studentId = Number(button.dataset.studentId);
      const select = document.querySelector(
        `[data-admin-assignment-select][data-student-id="${studentId}"]`,
      );
      if (!studentId || !select) return;
      const originalLabel = button.textContent || "保存教师";
      button.disabled = true;
      button.textContent = "保存中...";
      try {
        await apiFetch("/api/admin/assignments", {
          method: "POST",
          body: JSON.stringify({
            student_id: studentId,
            teacher_id: select.value || null,
          }),
        });
        const student = students.find((item) => Number(item.id) === studentId);
        if (student) student.teacher_id = select.value ? Number(select.value) : null;
        const teacherName = select.selectedOptions[0]?.textContent?.trim() ||
          "未分配";
        button.textContent = "已保存";
        showAdminNotice(`教师分配已保存：${teacherName}`);
        window.dispatchEvent(new CustomEvent("admin-data-updated"));
      } catch (error) {
        button.textContent = "保存失败";
        showAdminNotice(`教师分配失败：${error.message}`, "error");
      } finally {
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = originalLabel;
        }, 900);
      }
    });
  });
}

function wireAdminStudentEditor(students, teachers) {
  const modal = document.querySelector("[data-student-edit-modal]");
  const form = modal?.querySelector("[data-admin-student-edit-form]");
  const status = modal?.querySelector("[data-student-edit-status]");
  const deleteButton = modal?.querySelector("[data-delete-student-account]");
  if (!modal || !form || !deleteButton) return;
  modal.studentEditorContext = { students, teachers };

  const setStatus = (message = "", state = "") => {
    if (!status) return;
    status.textContent = message;
    status.className = `admin-reference-form-status${state ? ` is-${state}` : ""}`;
  };
  const fillForm = (student) => {
    form.elements.student_id.value = String(student.id);
    form.elements.username.value = student.username || "";
    form.elements.password.value = "";
    form.elements.full_name.value = student.full_name || "";
    form.elements.stage.value = student.stage || "小学";
    form.elements.grade.value = student.grade || "";
    form.elements.email.value = student.email || "";
    form.elements.access_unlimited.checked = !student.access_expires_on;
    form.dataset.originalUnlimited = student.access_expires_on ? "0" : "1";
    form.elements.access_duration_days.value = "";
    form.elements.access_duration_days.disabled =
      form.elements.access_unlimited.checked;
    form.elements.access_duration_days.required = false;
    setStatus();
    modal.classList.remove("is-hidden");
    document.body.classList.add("has-admin-modal");
    window.requestAnimationFrame(() => form.elements.username.focus());
  };

  document.querySelectorAll("[data-edit-student-account]").forEach((button) => {
    if (button.dataset.bound === "1") return;
    button.dataset.bound = "1";
    button.addEventListener("click", () => {
      const context = modal.studentEditorContext;
      const student = context?.students.find((item) =>
        Number(item.id) === Number(button.dataset.studentId)
      );
      if (student) fillForm(student);
    });
  });

  if (form.dataset.bound === "1") return;
  form.dataset.bound = "1";
  form.elements.access_unlimited.addEventListener("change", () => {
    const isUnlimited = form.elements.access_unlimited.checked;
    form.elements.access_duration_days.disabled = isUnlimited;
    form.elements.access_duration_days.required = !isUnlimited &&
      form.dataset.originalUnlimited === "1";
    if (form.elements.access_unlimited.checked) {
      form.elements.access_duration_days.value = "";
    } else if (form.elements.access_duration_days.required) {
      form.elements.access_duration_days.focus();
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const context = modal.studentEditorContext;
    const studentId = Number(form.elements.student_id.value);
    const student = context?.students.find((item) =>
      Number(item.id) === studentId
    );
    if (!student) {
      setStatus("未找到当前学生，请刷新后重试", "error");
      return;
    }
    const submitButton = form.querySelector('button[type="submit"]');
    const payload = {
      username: form.elements.username.value.trim(),
      password: form.elements.password.value.trim(),
      full_name: form.elements.full_name.value.trim(),
      stage: form.elements.stage.value,
      grade: form.elements.grade.value.trim(),
      email: form.elements.email.value.trim(),
    };
    const duration = form.elements.access_duration_days.value.trim();
    if (form.elements.access_unlimited.checked) payload.access_expires_on = null;
    else if (duration) payload.access_duration_days = duration;
    else payload.access_expires_on = student.access_expires_on || null;
    submitButton.disabled = true;
    setStatus("正在保存学生资料...", "saving-text");
    try {
      const result = await apiFetch(`/api/admin/students/${studentId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      Object.assign(student, result.data || payload);
      form.elements.password.value = "";
      closeAdminModal(modal);
      window.dispatchEvent(new CustomEvent("admin-data-updated"));
      showAdminNotice(`学生资料已保存：${student.full_name || student.username}`);
    } catch (error) {
      setStatus(`保存失败：${error.message}`, "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  deleteButton.addEventListener("click", async () => {
    const context = modal.studentEditorContext;
    const studentId = Number(form.elements.student_id.value);
    const student = context?.students.find((item) =>
      Number(item.id) === studentId
    );
    if (!student) return;
    const studentName = student.full_name || student.username || "该学生";
    if (!window.confirm(`确定删除 ${studentName} 吗？该学生的购课和学习记录也会被移除。`)) {
      return;
    }
    deleteButton.disabled = true;
    setStatus("正在删除学生...", "saving-text");
    try {
      await apiFetch(`/api/admin/students/${studentId}`, { method: "DELETE" });
      closeAdminModal(modal);
      showAdminNotice(`学生 ${studentName} 已删除`);
      await initTeacherEnrollmentPanel(readCachedUserProfile());
    } catch (error) {
      setStatus(`删除失败：${error.message}`, "error");
    } finally {
      deleteButton.disabled = false;
    }
  });
}

function renderAdminMetricCards(targetId, metrics) {
  const root = document.getElementById(targetId);
  if (!root) return;
  const tones = ["", "is-green", "is-orange", "is-purple"];
  const icons = {
    "师": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"></path></svg>',
    "职": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"></path><path d="m9 14 2 2 4-4"></path></svg>',
    "新": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M19 8v6M16 11h6"></path></svg>',
    "生": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    "课": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"></path></svg>',
    "配": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M9 3v4h6V3M8 13l2 2 4-4"></path></svg>',
    "待": '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
    "活": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-6 4 12 2-6h6"></path></svg>',
  };
  root.innerHTML = metrics.map((metric, index) => {
    const value = metric.value === null || metric.value === undefined
      ? "—"
      : Number(metric.value || 0).toLocaleString("zh-CN");
    return `
    <article class="admin-reference-stat ${tones[index % tones.length]}">
      <span class="admin-reference-stat-icon" aria-hidden="true">${icons[metric.icon] || icons["活"]}</span>
      <div><p class="admin-reference-stat-label">${escapeHtml(metric.label || "")}</p><div class="admin-reference-stat-value-row"><strong class="admin-reference-stat-value">${value}</strong><span class="admin-reference-stat-unit">${escapeHtml(metric.unit || "")}</span></div><p class="admin-reference-stat-note">${escapeHtml(metric.note || "数据库实时统计")}</p></div>
    </article>`;
  }).join("");
}

function wireAdminTableSearch(selector, containerId) {
  const input = document.querySelector(selector);
  const container = document.getElementById(containerId);
  if (!input || !container || input.dataset.bound === "1") return;
  input.dataset.bound = "1";
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    container.querySelectorAll("[data-admin-search-row]").forEach((row) => {
      row.classList.toggle(
        "is-hidden",
        Boolean(query) && !String(row.dataset.searchText || "").includes(query),
      );
    });
  });
}

function renderAdminDistribution(targetId, items) {
  const root = document.getElementById(targetId);
  if (!root) return;
  const normalized = items.filter((item) => item.label);
  const maximum = Math.max(1, ...normalized.map((item) => Number(item.value || 0)));
  root.innerHTML = normalized.length
    ? normalized.map((item) => `
      <div class="admin-data-bar-row">
        <span>${escapeHtml(item.label)}</span>
        <div><i style="width:${Math.round((Number(item.value || 0) / maximum) * 100)}%"></i></div>
        <strong>${Number(item.value || 0).toLocaleString("zh-CN")}</strong>
      </div>`).join("")
    : '<p class="admin-reference-empty">暂无数据</p>';
}

function renderAdminSubjectDonut(items) {
  const root = document.getElementById("admin-subject-distribution");
  if (!root) return;
  const normalized = items.filter((item) => item.label && Number(item.value) > 0);
  const total = normalized.reduce(
    (sum, item) => sum + Number(item.value || 0),
    0,
  );
  if (!total) {
    root.innerHTML = '<p class="admin-reference-empty">暂无课程学科数据</p>';
    return;
  }
  const colors = ["#1769f6", "#56a0f6", "#23b88a", "#f4ad45", "#7167e8", "#ef6b6f"];
  let offset = 0;
  const stops = normalized.map((item, index) => {
    const start = offset;
    offset += (Number(item.value || 0) / total) * 100;
    return `${colors[index % colors.length]} ${start.toFixed(2)}% ${offset.toFixed(2)}%`;
  });
  root.innerHTML = `
    <div class="admin-donut" style="--admin-donut:${escapeHtml(`conic-gradient(${stops.join(",")})`)}"><strong>${total.toLocaleString("zh-CN")}</strong><span>课程</span></div>
    <div class="admin-donut-legend">${normalized.slice(0, 8).map((item, index) => `
      <span><i style="background:${colors[index % colors.length]}"></i><b>${escapeHtml(item.label)}</b><em>${Number(item.value).toLocaleString("zh-CN")}</em></span>`).join("")}</div>`;
}

function renderAdminEmptyHeatmap() {
  const root = document.getElementById("admin-time-heatmap");
  if (!root) return;
  const rows = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"];
  root.innerHTML = `
    <div class="admin-heatmap-board">${rows.map((label) => `
      <span class="admin-heatmap-label">${label}时</span><div>${Array.from({ length: 7 }, () => "<i></i>").join("")}</div>`).join("")}
      <span></span><div class="admin-heatmap-days">${["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day) => `<b>${day}</b>`).join("")}</div>
    </div>
    <p class="admin-heatmap-empty">暂无分时学习数据</p>`;
}

function renderAdminEmptyRankings() {
  const activeRoot = document.getElementById("admin-active-students");
  const classRoot = document.getElementById("admin-class-ranking");
  if (activeRoot) {
    activeRoot.innerHTML = '<p class="admin-reference-empty">暂无活跃度排行数据</p>';
  }
  if (classRoot) {
    classRoot.innerHTML = '<p class="admin-reference-empty">当前学生资料未配置班级字段</p>';
  }
}

function adminCsvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function wireAdminReportExport(students, teachers, courses) {
  const button = document.querySelector("[data-export-admin-report]");
  if (!button) return;
  button.adminReportContext = { students, teachers, courses };
  if (button.dataset.bound === "1") return;
  button.dataset.bound = "1";
  button.addEventListener("click", () => {
    const context = button.adminReportContext || {};
    const rows = [["类型", "账号/课程", "姓名/阶段", "教师/年级", "课程数/学科"]];
    (context.students || []).forEach((student) => {
      const teacher = (context.teachers || []).find((item) =>
        Number(item.id) === Number(student.teacher_id)
      );
      rows.push([
        "学生",
        student.username,
        student.full_name,
        teacher?.full_name || teacher?.username || "未分配",
        (student.course_ids || []).length,
      ]);
    });
    (context.teachers || []).forEach((teacher) => {
      rows.push([
        "教师",
        teacher.username,
        teacher.full_name,
        teacher.stage || "所有阶段",
        "",
      ]);
    });
    (context.courses || []).forEach((course) => {
      rows.push([
        "课程",
        course.title,
        course.stage,
        course.grade,
        course.subject,
      ]);
    });
    const csv = `\uFEFF${rows.map((row) => row.map(adminCsvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `启航教育数据报表-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showAdminNotice("数据报表已导出");
  });
}

function renderAdminLoadError(message) {
  const safeMessage = escapeHtml(message || "管理数据读取失败，请刷新后重试");
  [
    "teacher-account-list",
    "student-account-list",
    "teacher-admin-root",
    "admin-subject-distribution",
    "admin-learning-trend",
    "admin-time-heatmap",
    "admin-grade-distribution",
    "admin-active-students",
    "admin-class-ranking",
  ].forEach((targetId) => {
    const target = document.getElementById(targetId);
    if (target) {
      target.innerHTML = `<p class="admin-reference-empty">${safeMessage}</p>`;
    }
  });
  ["admin-teacher-stats", "admin-student-stats", "admin-course-stats", "admin-data-stats"]
    .forEach((targetId) => {
      const target = document.getElementById(targetId);
      if (target) target.innerHTML = "";
    });
}

function renderAdminDataViews(students, teachers, courses) {
  const now = new Date();
  const isCurrentMonth = (value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth();
  };
  const assignedStudentCount = students.filter((student) =>
    Number(student.teacher_id) > 0
  ).length;
  const purchasedCourseCount = students.reduce(
    (total, student) => total + (student.course_ids || []).length,
    0,
  );
  renderAdminMetricCards("admin-teacher-stats", [
    { icon: "师", label: "教师总数", value: teachers.length, unit: "人", note: "当前系统教师账号" },
    { icon: "职", label: "在职教师", value: teachers.length, unit: "人", note: "可正常登录使用" },
    { icon: "新", label: "本月新增", value: teachers.filter((teacher) => isCurrentMonth(teacher.created_at)).length, unit: "人", note: "本月创建账号" },
    { icon: "待", label: "停用教师", value: null, unit: "人", note: "当前未配置停用状态" },
  ]);
  renderAdminMetricCards("admin-student-stats", [
    { icon: "生", label: "学生总数", value: students.length, unit: "人", note: "当前有效学生账号" },
    { icon: "课", label: "已购课程", value: purchasedCourseCount, unit: "门", note: "累计课程分配" },
    { icon: "待", label: "待分配教师", value: students.filter((student) => !student.teacher_id).length, unit: "人", note: "尚未指定负责教师" },
    { icon: "新", label: "本月新增", value: students.filter((student) => isCurrentMonth(student.created_at)).length, unit: "人", note: "本月创建账号" },
  ]);
  renderAdminMetricCards("admin-course-stats", [
    { icon: "课", label: "课程总数", value: courses.length, unit: "门", note: "系统课程目录" },
    { icon: "配", label: "已分配课程", value: purchasedCourseCount, unit: "次", note: "学生课程分配次数" },
  ]);
  renderAdminMetricCards("admin-data-stats", [
    { icon: "生", label: "学生总数", value: students.length, unit: "人", note: "当前有效学生" },
    { icon: "活", label: "今日活跃", value: null, unit: "人", note: "暂未接入日活统计" },
    { icon: "课", label: "完成课程", value: null, unit: "节", note: "暂未接入全站完成量" },
    { icon: "配", label: "平均正确率", value: null, unit: "%", note: "暂未接入全站正确率" },
    { icon: "职", label: "学习时长", value: null, unit: "小时", note: "暂未接入分时统计" },
  ]);
  const countBy = (items, getLabel) =>
    [...items.reduce((map, item) => {
      const label = String(getLabel(item) || "未填写");
      map.set(label, (map.get(label) || 0) + 1);
      return map;
    }, new Map()).entries()].map(([label, value]) => ({ label, value }));
  renderAdminSubjectDonut(countBy(courses, (course) => course.subject));
  renderAdminDistribution(
    "admin-grade-distribution",
    countBy(students, (student) => student.grade || student.stage),
  );
  renderAdminEmptyHeatmap();
  renderAdminEmptyRankings();
  wireAdminReportExport(students, teachers, courses);
  renderTeacherAccountDirectory(teachers, students);
  renderAdminStudentDirectory(students, teachers);
  wireAdminTableSearch("[data-admin-teacher-search]", "teacher-account-list");
  wireAdminTableSearch("[data-admin-student-search]", "student-account-list");
}

function formatTeacherOverviewDate(value, fallback = "") {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function teacherOverviewTrendSvg(trend = []) {
  const items = trend.slice(0, 6);
  const samples = items
    .map((item, index) => ({
      ...item,
      index,
      value: Math.max(0, Math.min(100, Number(item.value || 0))),
    }))
    .filter((item) => Number(item.samples || 0) > 0);
  if (!samples.length) {
    return '<div class="teacher-chart-empty"><strong>暂无趋势数据</strong><span>学生完成课程或练习后，这里会显示最近 6 个月的变化。</span></div>';
  }
  const xFor = (index) => 54 + index * 110;
  const yFor = (value) => 190 - value * 1.45;
  const points = samples.map((item) => ({
    ...item,
    x: xFor(item.index),
    y: yFor(item.value),
  }));
  const path = points.map((point, index) =>
    `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  ).join(" ");
  const area = points.length > 1
    ? `${path} L ${points.at(-1).x.toFixed(1)} 190 L ${points[0].x.toFixed(1)} 190 Z`
    : "";
  const grid = [0, 25, 50, 75, 100].map((value) => {
    const y = yFor(value);
    return `<line x1="50" y1="${y}" x2="606" y2="${y}" class="teacher-chart-grid"/><text x="40" y="${y + 4}" text-anchor="end" class="teacher-chart-axis">${value}</text>`;
  }).join("");
  const labels = items.map((item, index) =>
    `<text x="${xFor(index)}" y="218" text-anchor="middle" class="teacher-chart-axis">${escapeHtml(item.label || "")}</text>`
  ).join("");
  const dots = points.map((point) => `
    <g class="teacher-trend-point">
      <circle cx="${point.x}" cy="${point.y}" r="5"></circle>
      <text x="${point.x}" y="${point.y - 12}" text-anchor="middle">${point.value}</text>
    </g>`).join("");
  return `
    <svg class="teacher-trend-svg" viewBox="0 0 640 230" role="img" aria-label="最近六个月学习趋势">
      ${grid}
      ${area ? `<path d="${area}" class="teacher-trend-area"></path>` : ""}
      <path d="${path}" class="teacher-trend-line"></path>
      ${dots}
      ${labels}
    </svg>`;
}

function teacherOverviewRadarSvg(radar = []) {
  const items = radar.slice(0, 5);
  if (items.length < 3) return "";
  const center = 150;
  const radius = 92;
  const pointAt = (index, scale = 1) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / items.length);
    return {
      x: center + Math.cos(angle) * radius * scale,
      y: center + Math.sin(angle) * radius * scale,
    };
  };
  const polygon = (scale) => items.map((_, index) => {
    const point = pointAt(index, scale);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
  const valuePolygon = items.map((item, index) => {
    const value = Math.max(0, Math.min(100, Number(item.value || 0))) / 100;
    const point = pointAt(index, value);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
  const axes = items.map((_, index) => {
    const point = pointAt(index);
    return `<line x1="${center}" y1="${center}" x2="${point.x}" y2="${point.y}"></line>`;
  }).join("");
  const labels = items.map((item, index) => {
    const point = pointAt(index, 1.25);
    const anchor = point.x < center - 8 ? "end" : point.x > center + 8
      ? "start"
      : "middle";
    return `<text x="${point.x}" y="${point.y + 4}" text-anchor="${anchor}">${escapeHtml(item.label || "")} ${Math.round(Number(item.value || 0))}</text>`;
  }).join("");
  return `
    <svg class="teacher-radar-svg" viewBox="0 0 300 300" role="img" aria-label="学生综合能力雷达图">
      <g class="teacher-radar-grid">
        <polygon points="${polygon(1)}"></polygon>
        <polygon points="${polygon(0.75)}"></polygon>
        <polygon points="${polygon(0.5)}"></polygon>
        <polygon points="${polygon(0.25)}"></polygon>
        ${axes}
      </g>
      <polygon points="${valuePolygon}" class="teacher-radar-value"></polygon>
      <g class="teacher-radar-labels">${labels}</g>
    </svg>`;
}

function teacherLucideIcon(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function teacherMetricIcon(index) {
  const icons = [
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/>',
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    '<rect width="14" height="18" x="5" y="3" rx="2"/><path d="M9 3V1h6v2M9 14l2 2 4-4"/>',
    '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
  ];
  return teacherLucideIcon(icons[index % icons.length]);
}

function teacherHeadingIcon(kind) {
  const icons = {
    summary: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    observation: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    timeline: '<rect width="14" height="18" x="5" y="3" rx="2"/><path d="M9 3V1h6v2M9 12h6M9 16h6M9 8h2"/>',
  };
  return teacherLucideIcon(icons[kind] || icons.summary);
}

function renderTeacherOverview(data) {
  const student = data.student || {};
  const profile = data.profile || {};
  const metrics = data.metrics || [];
  const summary = data.summary || {};
  const observation = data.observation;
  const timeline = data.timeline || [];
  const subjectSummary = (data.subjects || []).filter((item) =>
    Number(item.samples || 0) > 0
  ).slice(0, 4);
  return `
    <div class="teacher-overview-detail">
      <section class="teacher-student-hero" aria-labelledby="teacher-current-student-name">
        <div class="teacher-student-avatar" aria-hidden="true">${escapeHtml(student.avatar_text || String(student.full_name || student.username || "学").slice(0, 2))}</div>
        <div class="teacher-student-profile-copy">
          <div class="teacher-student-name-row">
            <h2 id="teacher-current-student-name">${escapeHtml(student.full_name || student.username || "学生")}</h2>
            <span class="teacher-student-account">${escapeHtml(student.username ? `(${student.username})` : "")}</span>
            <span class="teacher-student-grade">${escapeHtml([student.stage, student.grade].filter(Boolean).join(" · ") || "年级未填写")}</span>
          </div>
          <div class="teacher-profile-tags">${(profile.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          <p>${escapeHtml(profile.summary || "暂无学生画像说明。")}</p>
        </div>
        <div class="teacher-hero-signal has-image" aria-hidden="true">
          <span class="teacher-signal-bar bar-one"></span>
          <span class="teacher-signal-bar bar-two"></span>
          <span class="teacher-signal-bar bar-three"></span>
          <span class="teacher-signal-line"></span>
        </div>
        <button class="teacher-student-switch" type="button" data-teacher-switch-student>${teacherLucideIcon('<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>')}<span>切换学生</span></button>
      </section>

      <div class="teacher-analytics-grid">
        <section class="teacher-dashboard-card teacher-trend-card">
          <header><h3>学习趋势</h3><span>近 6 个月</span></header>
          ${teacherOverviewTrendSvg(data.trend || [])}
          <p class="teacher-card-caption">综合课程得分与练习正确率</p>
        </section>
        <section class="teacher-dashboard-card teacher-radar-card">
          <header><h3>学科能力雷达图</h3><span>当前画像</span></header>
          ${teacherOverviewRadarSvg(data.radar || [])}
          ${subjectSummary.length ? `<div class="teacher-subject-summary">${subjectSummary.map((item) => `<span><i></i>${escapeHtml(item.label)} ${Math.round(Number(item.value || 0))}</span>`).join("")}</div>` : '<p class="teacher-card-caption">暂无可用的学科练习数据</p>'}
        </section>
        <section class="teacher-dashboard-card teacher-metrics-card">
          <header><h3>关键成长指标</h3></header>
          <div class="teacher-metric-grid">
            ${metrics.map((metric, index) => `
              <div class="teacher-metric-item tone-${escapeHtml(metric.tone || "blue")}">
                <span class="teacher-metric-icon" aria-hidden="true">${teacherMetricIcon(index)}</span>
                <div>
                  <span class="teacher-metric-label">${escapeHtml(metric.label || "")}</span>
                  <strong>${Math.round(Number(metric.value || 0))}<small>%</small></strong>
                  <p>${escapeHtml(metric.note || "")}</p>
                </div>
              </div>`).join("")}
          </div>
        </section>
      </div>

      <div class="teacher-narrative-grid">
        <section class="teacher-dashboard-card teacher-summary-card">
          <header><h3 class="teacher-card-heading"><span class="teacher-card-heading-icon" aria-hidden="true">${teacherHeadingIcon("summary")}</span>${escapeHtml(summary.headline || "近期成长总结")}</h3><span>${escapeHtml(formatTeacherOverviewDate(summary.updated_at, "实时汇总"))}</span></header>
          <div class="teacher-summary-group is-strength">
            <strong>优势表现</strong>
            <ul>${(summary.strengths || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
          <div class="teacher-summary-group is-improvement">
            <strong>待提升方向</strong>
            <ul>${(summary.improvements || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
        </section>
        <section class="teacher-dashboard-card teacher-observation-card">
          <header><h3 class="teacher-card-heading"><span class="teacher-card-heading-icon" aria-hidden="true">${teacherHeadingIcon("observation")}</span>教师观察</h3><span>${escapeHtml(observation ? formatTeacherOverviewDate(observation.date) : "暂无记录")}</span></header>
          ${observation ? `
            <h4>${escapeHtml(observation.title || "最新课后观察")}</h4>
            <p>${escapeHtml(observation.content || "")}</p>
            <footer><span>${escapeHtml(observation.teacher || "教师")}</span></footer>
          ` : '<div class="teacher-panel-empty"><strong>还没有课后观察</strong><span>在“课后记录”中提交内容后会显示在这里。</span></div>'}
        </section>
        <section class="teacher-dashboard-card teacher-timeline-card">
          <header><h3 class="teacher-card-heading"><span class="teacher-card-heading-icon" aria-hidden="true">${teacherHeadingIcon("timeline")}</span>成长轨迹</h3><span>${timeline.length} 条近期记录</span></header>
          ${timeline.length ? `<ol class="teacher-timeline-list">${timeline.map((item) => `
            <li class="tone-${escapeHtml(item.tone || "progress")}">
              <time>${escapeHtml(formatTeacherOverviewDate(item.date, ""))}</time>
              <div><strong>${escapeHtml(item.title || "成长记录")}</strong><p>${escapeHtml(item.description || "")}</p></div><span class="teacher-timeline-tag">${item.tone === "attention" ? "待提升" : item.tone === "teacher" ? "教师记录" : "进步"}</span>
            </li>`).join("")}</ol>` : '<div class="teacher-panel-empty"><strong>暂无成长轨迹</strong><span>课程学习和教师记录会按时间汇总在这里。</span></div>'}
          <a class="teacher-timeline-more" href="/teacher?view=growth&student=${encodeURIComponent(student.id || "")}">查看更多成长记录 ›</a>
        </section>
      </div>
    </div>`;
}

async function initTeacherOverview(user) {
  const panel = document.getElementById("teacher-overview-panel");
  const root = document.getElementById("teacher-overview-root");
  if (!panel || !root || user.role !== "teacher") return;
  try {
    const result = await apiFetch("/api/teacher/students");
    const students = result.data?.students || [];
    if (!students.length) {
      root.innerHTML = '<section class="teacher-overview-empty"><h2>暂无分配学生</h2><p>超级管理员分配学生后，学生画像和学习数据会显示在这里。</p></section>';
      return;
    }
    const requestedId = new URL(window.location.href).searchParams.get(
      "student",
    );
    let currentStudentId = students.some((student) =>
        String(student.id) === String(requestedId)
      )
      ? String(requestedId)
      : String(students[0].id);
    root.innerHTML = `
      <div class="teacher-overview-layout">
        <aside class="teacher-student-directory" aria-label="学生列表">
          <header><h2>学生列表</h2><span>${students.length} 名学生</span></header>
          <p>选择学生查看成长分析</p>
          <div class="teacher-student-list">
            ${students.map((student) => {
              const name = student.full_name || student.username || "学生";
              return `
                <button type="button" data-overview-student-id="${student.id}" aria-pressed="false">
                  <span class="teacher-directory-avatar" aria-hidden="true">${escapeHtml(student.avatar_text || name.slice(0, 2))}</span>
                  <span class="teacher-directory-copy">
                    <strong>${escapeHtml(name)} <small>(${escapeHtml(student.username || "")})</small></strong>
                    <span>${escapeHtml([student.stage, student.grade].filter(Boolean).join(" · ") || "年级未填写")}</span>
                  </span>
                  <span class="teacher-directory-check" aria-hidden="true">✓</span>
                </button>`;
            }).join("")}
          </div>
          <footer class="teacher-directory-footer"><button class="teacher-directory-all-button" type="button" data-teacher-directory-all>查看全部学生</button></footer>
        </aside>
        <div class="teacher-overview-report" data-teacher-overview-report></div>
      </div>`;
    const report = root.querySelector("[data-teacher-overview-report]");
    let requestId = 0;
    const setActiveStudent = (studentId) => {
      currentStudentId = String(studentId);
      root.querySelectorAll("[data-overview-student-id]").forEach((button) => {
        const active = button.dataset.overviewStudentId === currentStudentId;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    };
    const loadOverview = async (studentId) => {
      if (!studentId || !report) return;
      const thisRequest = ++requestId;
      setActiveStudent(studentId);
      report.innerHTML = '<div class="teacher-overview-loading"><div class="page-transition-mark"></div><strong>正在读取学生数据</strong><span>汇总学习记录、练习和教师观察...</span></div>';
      try {
        const overview = await apiFetch(
          `/api/teacher/students/${studentId}/overview`,
          { cacheTtlMs: 60 * 1000 },
        );
        if (thisRequest !== requestId) return;
        report.innerHTML = renderTeacherOverview(overview.data || {});
        report.querySelector("[data-teacher-switch-student]")?.addEventListener(
          "click",
          () => {
            const currentIndex = students.findIndex((student) =>
              String(student.id) === String(currentStudentId)
            );
            const nextStudent = students[(currentIndex + 1) % students.length];
            root.querySelector(
              `[data-overview-student-id="${nextStudent?.id || ""}"]`,
            )?.click();
          },
        );
      } catch (error) {
        if (thisRequest !== requestId) return;
        report.innerHTML = `<section class="teacher-overview-empty"><h2>暂时无法读取</h2><p>${escapeHtml(error.message)}</p></section>`;
      }
    };
    root.querySelectorAll("[data-overview-student-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const studentId = button.dataset.overviewStudentId;
        if (!studentId || studentId === currentStudentId) return;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("student", studentId);
        history.replaceState(
          history.state,
          "",
          `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
        );
        syncTeacherStudentSelection(studentId);
        window.dispatchEvent(new CustomEvent("teacher-student-selected", {
          detail: { studentId },
        }));
      });
    });
    root.querySelector("[data-teacher-directory-all]")?.addEventListener(
      "click",
      () => {
        const list = root.querySelector(".teacher-student-list");
        if (list) list.scrollTop = 0;
        root.querySelector("[data-overview-student-id]")?.focus();
      },
    );
    window.addEventListener("teacher-student-selected", (event) => {
      const studentId = String(event.detail?.studentId || "");
      if (!studentId || studentId === currentStudentId) return;
      loadOverview(studentId);
    });
    window.addEventListener("teacher-management-view-changed", (event) => {
      if (event.detail?.view === "overview" && !report?.children.length) {
        loadOverview(currentStudentId);
      }
    });
    await loadOverview(currentStudentId);
  } catch (error) {
    root.innerHTML = `<section class="teacher-overview-empty"><h2>学生列表读取失败</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}

async function initTeacherRecordPanel(user) {
  const panel = document.getElementById("teacher-record-panel");
  const root = document.getElementById("teacher-record-root");
  if (!panel || !root || user.role !== "teacher") return;
  try {
    const result = await apiFetch("/api/teacher/students");
    const students = result.data?.students || [];
    if (!students.length) {
      root.innerHTML = '<p class="muted">暂时没有分配给你的学生。</p>';
      return;
    }
    root.innerHTML = `
      <form class="student-create-form" data-lesson-record-form>
        <label class="form-group form-group-compact teacher-local-student-field is-hidden"><span class="form-label">学生</span><select class="form-input" name="student_id" data-record-student-select required>${students.map((student) => `<option value="${student.id}">${escapeHtml(student.full_name || student.username)}</option>`).join("")}</select></label>
        <p class="teacher-current-student" data-current-teacher-student></p>
        <label class="form-group form-group-compact"><span class="form-label">课程主题</span><input class="form-input" name="title" placeholder="例如：一次函数复习" required /></label>
        <label class="form-group form-group-compact"><span class="form-label">课堂记录</span><textarea class="form-input" name="notes" rows="6" placeholder="记录本次辅导内容、学生表现、作业反馈和疑问" required></textarea></label>
        <div class="student-create-actions"><button class="primary-btn" type="submit">保存课后记录</button><span class="muted text-sm" data-record-status></span></div>
        <div class="record-analysis-progress is-hidden" data-record-analysis-progress aria-live="polite">
          <div class="record-analysis-progress-head"><strong data-analysis-progress-label>AI 分析中，可以继续其他操作</strong><span data-analysis-progress-state>处理中</span></div>
          <div class="record-analysis-progress-track"><span></span></div>
        </div>
      </form>`;
    const form = root.querySelector("[data-lesson-record-form]");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const button = form.querySelector("button[type=submit]");
      const status = form.querySelector("[data-record-status]");
      const progress = form.querySelector("[data-record-analysis-progress]");
      button.disabled = true;
      if (status) status.textContent = "正在保存记录...";
      try {
        const studentId = Number(data.get("student_id"));
        await apiFetch(`/api/teacher/students/${studentId}/records`, {
          method: "POST",
          body: JSON.stringify({
            title: data.get("title"),
            notes: data.get("notes"),
          }),
        });
        form.reset();
        syncTeacherStudentSelection(studentId);
        if (status) status.textContent = "记录已保存";
        runTeacherGrowthAnalysis(studentId, progress);
      } catch (error) {
        if (status) status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
    window.addEventListener("teacher-student-selected", (event) => {
      const studentId = String(event.detail?.studentId || "");
      const select = form?.querySelector("[data-record-student-select]");
      if (select && studentId) select.value = studentId;
    });
  } catch (error) {
    root.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}

async function runTeacherGrowthAnalysis(studentId, progress) {
  if (!studentId || !progress) return;
  const runId = `${Date.now()}-${Math.random()}`;
  progress.dataset.runId = runId;
  progress.dataset.state = "running";
  progress.classList.remove("is-hidden");
  const label = progress.querySelector("[data-analysis-progress-label]");
  const state = progress.querySelector("[data-analysis-progress-state]");
  if (label) label.textContent = "AI 分析中，可以继续其他操作";
  if (state) state.textContent = "处理中";
  try {
    const response = await fetch(
      `/api/teacher/students/${studentId}/growth/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: "{}",
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "AI 分析暂未完成");
    if (progress.dataset.runId !== runId) return;
    progress.dataset.state = "success";
    if (label) label.textContent = "AI 成长分析已完成并保存";
    if (state) state.textContent = "已完成";
    clearApiPrefetchCache(false);
    window.dispatchEvent(
      new CustomEvent("teacher-growth-updated", {
        detail: { studentId },
      }),
    );
  } catch (error) {
    if (progress.dataset.runId !== runId) return;
    progress.dataset.state = "error";
    if (label) label.textContent = "记录已保存，AI 分析可稍后继续";
    if (state) state.textContent = "暂未完成";
    console.warn(error);
  }
}

async function initTeacherGrowthPanel(user) {
  const panel = document.getElementById("teacher-growth-panel");
  const root = document.getElementById("teacher-growth-root");
  if (!panel || !root || user.role !== "teacher") return;
  try {
    const result = await apiFetch("/api/teacher/students");
    const students = result.data?.students || [];
    if (!students.length) {
      root.innerHTML = '<section class="growth-empty-report"><h2>暂无学生</h2><p>超级管理员分配学生后，可在这里查看成长规划。</p></section>';
      return;
    }
    root.innerHTML = `
      <div class="teacher-growth-toolbar">
        <select class="is-hidden" data-growth-student-select aria-hidden="true">${students.map((student) => `<option value="${student.id}">${escapeHtml(student.full_name || student.username)}</option>`).join("")}</select>
        <strong class="teacher-growth-current" data-current-teacher-student></strong>
        <button class="primary-btn" type="button" data-load-student-growth>查看成长规划</button>
        <span class="save-feedback" data-growth-load-status aria-live="polite"></span>
      </div>
      <div data-teacher-growth-report></div>`;
    const select = root.querySelector("[data-growth-student-select]");
    const button = root.querySelector("[data-load-student-growth]");
    const status = root.querySelector("[data-growth-load-status]");
    const report = root.querySelector("[data-teacher-growth-report]");
    if (!select || !button || !report) return;
    const loadGrowth = async (studentId = select?.value) => {
      if (!studentId || !report) return;
      const requestedStudentId = String(studentId);
      if (button.disabled) {
        report.dataset.pendingStudentId = requestedStudentId;
        return;
      }
      button.disabled = true;
      button.classList.add("is-saving");
      if (status) {
        status.className = "save-feedback is-saving-text";
        status.textContent = "AI 分析中...";
      }
      report.innerHTML = '<div class="growth-analysis-buffer"><div class="page-transition-mark"></div><strong>AI 分析中...</strong><span>正在读取教师课后记录</span></div>';
      try {
        const growth = await apiFetch(
          `/api/teacher/students/${requestedStudentId}/growth`,
          {
            cacheTtlMs: 60 * 1000,
          },
        );
        if (String(select.value) !== requestedStudentId) return;
        report.innerHTML = renderFocusedGrowth(
          growth.data || {},
          `/api/teacher/students/${requestedStudentId}/records`,
        );
        wireGrowthRecordDisclosure(report);
        if (status) {
          if (
            growth.data?.ai_pending ||
            growth.data?.analysis_status === "pending"
          ) {
            status.className = "save-feedback is-saving-text";
            status.textContent = "AI 分析尚未完成，可点击重试";
            button.dataset.growthPending = "1";
            button.textContent = "重试 AI 分析";
          } else if (!growth.data?.has_teacher_records) {
            status.className = "save-feedback";
            status.textContent = "等待教师课后记录";
            delete button.dataset.growthPending;
            button.textContent = "刷新成长规划";
          } else {
            status.className = "save-feedback is-success";
            status.textContent = "已读取固定成长规划";
            delete button.dataset.growthPending;
            button.textContent = "刷新成长规划";
          }
        }
      } catch (error) {
        if (String(select.value) !== requestedStudentId) return;
        report.innerHTML = `<section class="growth-empty-report"><h2>暂时无法读取</h2><p>${escapeHtml(error.message)}</p></section>`;
        if (status) {
          status.className = "save-feedback is-error";
          status.textContent = error.message;
        }
      } finally {
        button.disabled = false;
        button.classList.remove("is-saving");
        const pendingStudentId = report.dataset.pendingStudentId;
        delete report.dataset.pendingStudentId;
        if (pendingStudentId && pendingStudentId !== requestedStudentId) {
          loadGrowth(pendingStudentId);
        }
      }
    };
    button.addEventListener("click", async () => {
      if (button.dataset.growthPending !== "1") {
        loadGrowth();
        return;
      }
      const studentId = String(select.value || "");
      if (!studentId) return;
      button.disabled = true;
      button.classList.add("is-saving");
      if (status) {
        status.className = "save-feedback is-saving-text";
        status.textContent = "正在重新提交 AI 分析...";
      }
      try {
        await apiFetch(
          `/api/teacher/students/${studentId}/growth/generate`,
          { method: "POST", body: "{}" },
        );
        delete button.dataset.growthPending;
        button.disabled = false;
        button.classList.remove("is-saving");
        await loadGrowth(studentId);
      } catch (error) {
        if (status) {
          status.className = "save-feedback is-error";
          status.textContent = error.message;
        }
      } finally {
        button.disabled = false;
        button.classList.remove("is-saving");
      }
    });
    window.addEventListener("teacher-growth-updated", (event) => {
      if (
        String(event.detail?.studentId || "") === String(select?.value || "")
      ) {
        loadGrowth(event.detail.studentId);
      }
    });
    window.addEventListener("teacher-student-selected", (event) => {
      const studentId = String(event.detail?.studentId || "");
      if (!studentId) return;
      select.value = studentId;
      if (!panel.classList.contains("is-hidden")) loadGrowth(studentId);
    });
    window.addEventListener("teacher-management-view-changed", (event) => {
      if (event.detail?.view === "growth") loadGrowth(select.value);
    });
  } catch (error) {
    root.innerHTML = `<section class="growth-empty-report"><p>${escapeHtml(error.message)}</p></section>`;
  }
}

function modelSettingsSourceLabel(source) {
  const labels = {
    database: "管理员配置",
    db: "管理员配置",
    environment: "环境变量",
    env: "环境变量",
    mixed: "混合配置",
    missing: "未配置",
    default: "系统默认",
  };
  const key = String(source || "").trim().toLowerCase();
  return labels[key] || String(source || "").trim();
}

async function initModelSettingsPanel(user) {
  const panel = document.querySelector("[data-model-settings-panel]");
  const form = panel?.querySelector("[data-model-settings-form]");
  const baseUrlInput = form?.querySelector('[name="base_url"]');
  const apiKeyInput = form?.querySelector('[name="api_key"]');
  const modelInput = form?.querySelector('[name="model"]');
  const state = panel?.querySelector("[data-model-settings-state]");
  const status = panel?.querySelector("[data-model-settings-status]");
  const modelName = panel?.querySelector("[data-model-name]");
  const modelSource = panel?.querySelector("[data-model-source]");
  const modelProvider = panel?.querySelector("[data-model-provider]");
  const modelBaseUrl = panel?.querySelector("[data-model-base-url]");
  const modelUpdatedAt = panel?.querySelector("[data-model-updated-at]");
  const configRow = panel?.querySelector("[data-model-config-row]");
  const testButton = panel?.querySelector("[data-test-model-settings]");
  const saveButton = panel?.querySelector("[data-save-model-settings]");
  if (
    user?.role !== "admin" || !panel || !form || !baseUrlInput ||
    !apiKeyInput || !modelInput || !testButton || !saveButton ||
    form.dataset.modelSettingsInitialized === "1"
  ) {
    return;
  }
  form.dataset.modelSettingsInitialized = "1";

  let savedSettings = null;
  const testButtonLabel = testButton.textContent || "测试连接";
  const saveButtonLabel = saveButton.textContent || "保存配置";
  const setFeedback = (message, feedbackState = "") => {
    if (!status) {
      return;
    }
    status.textContent = message;
    status.className = `admin-reference-form-status${feedbackState ? ` is-${feedbackState}` : ""}`;
    status.dataset.state = feedbackState;
  };
  const setBusy = (isBusy, action = "") => {
    form.setAttribute("aria-busy", String(isBusy));
    testButton.disabled = isBusy;
    saveButton.disabled = isBusy;
    testButton.textContent = isBusy && action === "test" ? "测试中..." : testButtonLabel;
    saveButton.textContent = isBusy && action === "save" ? "保存中..." : saveButtonLabel;
  };
  const renderConfiguredState = (settings = {}) => {
    savedSettings = { ...settings };
    if (typeof settings.base_url === "string") {
      baseUrlInput.value = settings.base_url;
    }
    if (typeof settings.model === "string") {
      modelInput.value = settings.model;
    }
    apiKeyInput.value = "";
    const configured = Boolean(settings.api_key_configured);
    const sourceLabel = modelSettingsSourceLabel(settings.source);
    apiKeyInput.placeholder = configured ? "已配置，留空表示保留当前 API Key" : "请输入 API Key";
    if (modelName) modelName.textContent = settings.model || "—";
    if (modelSource) modelSource.textContent = sourceLabel || "—";
    if (modelBaseUrl) modelBaseUrl.textContent = settings.base_url || "—";
    if (modelUpdatedAt) {
      modelUpdatedAt.textContent = formatTeacherOverviewDate(
        settings.updated_at,
        "—",
      ) || "—";
    }
    if (modelProvider) {
      try {
        modelProvider.textContent = new URL(settings.base_url).hostname ||
          "兼容 OpenAI 接口";
      } catch {
        modelProvider.textContent = "兼容 OpenAI 接口";
      }
    }
    if (state) {
      state.className = `admin-status-pill ${configured ? "" : "is-expired"}`;
      state.dataset.configured = configured ? "true" : "false";
      state.textContent = configured ? "正常" : "未配置";
    }
    if (configRow) {
      const updatedAt = formatTeacherOverviewDate(settings.updated_at, "—") ||
        "—";
      configRow.innerHTML = `
        <tr>
          <td><strong>默认配置</strong><small class="admin-config-updated">更新于 ${escapeHtml(updatedAt)}</small></td>
          <td>${escapeHtml(settings.base_url || "—")}</td>
          <td>${escapeHtml(settings.model || "—")}</td>
          <td><span class="admin-status-pill ${configured ? "" : "is-expired"}">${configured ? `已启用 · ${escapeHtml(settings.api_key_hint || "已配置")}` : "未配置"}</span></td>
          <td><button class="admin-table-action" type="button" data-open-model-editor-row>编辑</button></td>
        </tr>`;
      configRow.querySelector("[data-open-model-editor-row]")?.addEventListener(
        "click",
        () => document.querySelector("[data-open-model-editor]")?.click(),
      );
    }
  };
  const readPayload = () => {
    const payload = {
      base_url: baseUrlInput.value.trim(),
      model: modelInput.value.trim(),
    };
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      payload.api_key = apiKey;
    }
    return payload;
  };

  panel.querySelectorAll("[data-open-model-editor]").forEach((button) => {
    button.addEventListener("click", () => {
      if (savedSettings) renderConfiguredState(savedSettings);
    });
  });
  panel.querySelectorAll("[data-close-model-editor]").forEach((button) => {
    button.addEventListener("click", () => {
      if (savedSettings) renderConfiguredState(savedSettings);
      setFeedback("", "");
    });
  });

  testButton.addEventListener("click", async () => {
    if (!form.reportValidity()) {
      return;
    }
    setBusy(true, "test");
    setFeedback("正在测试模型连接...", "saving-text");
    try {
      const result = await apiFetch("/api/admin/model-settings/test", {
        method: "POST",
        body: JSON.stringify(readPayload()),
      });
      const testedModel = String(result.data?.model || modelInput.value).trim();
      setFeedback(
        testedModel ? `连接成功，模型 ${testedModel} 可用` : "连接测试成功",
        "success",
      );
      showAdminNotice(
        testedModel ? `连接成功：${testedModel}` : "模型连接测试成功",
      );
    } catch (error) {
      setFeedback(`连接失败：${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }
    setBusy(true, "save");
    setFeedback("正在保存模型配置...", "saving-text");
    try {
      const result = await apiFetch("/api/admin/model-settings", {
        method: "PUT",
        body: JSON.stringify(readPayload()),
      });
      renderConfiguredState(result.data || {});
      setFeedback("模型配置已保存", "success");
      showAdminNotice("AI 模型配置已保存");
      document.querySelector("[data-model-editor]")?.classList.add("is-hidden");
    } catch (error) {
      setFeedback(`保存失败：${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  });

  setBusy(true);
  setFeedback("正在读取模型配置...", "saving-text");
  try {
    const result = await apiFetch("/api/admin/model-settings");
    renderConfiguredState(result.data || {});
    setFeedback("", "");
  } catch (error) {
    if (state) {
      state.className = "admin-status-pill is-expired";
      state.textContent = "配置状态读取失败";
    }
    setFeedback(`读取失败：${error.message}`, "error");
  } finally {
    setBusy(false);
  }
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
      closeAdminModal(document.querySelector("[data-student-create-modal]"));
      showAdminNotice(`学生账号 ${createdName} 已创建`);
    } catch (error) {
      if (status) {
        status.className = "admin-reference-form-status is-error";
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
  if (!panel || !root) return;
  if (user?.role !== "admin") {
    panel.classList.add("is-hidden");
    return;
  }

  let result;
  try {
    result = await apiFetch("/api/admin/enrollments");
  } catch (error) {
    console.warn(error);
    renderAdminLoadError(error.message || "管理数据读取失败，请刷新后重试");
    return;
  }

  const { students = [], teachers = [], courses = [] } = result.data || {};
  renderAdminDataViews(students, teachers, courses);

  if (!students.length) {
    root.innerHTML =
      '<p class="admin-reference-empty">请先创建学生账号，再配置课程。</p>';
    return;
  }

  root.innerHTML = `
    <h2 class="admin-reference-assignment-title">配置学生课程</h2>
    <div class="admin-reference-assignment-grid">
      <section class="admin-reference-picker admin-reference-student-picker">
        <h3>选择学生</h3>
        <div class="admin-reference-picker-toolbar">
          <label class="admin-reference-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <input class="admin-reference-field" type="search" placeholder="搜索学生姓名 / 学号" data-assignment-student-search>
          </label>
        </div>
        <div class="admin-reference-picker-list" data-assignment-student-list></div>
      </section>
      <div class="admin-reference-assignment-actions">
        <button class="admin-reference-primary" type="button" data-add-selected-courses>→ 添加</button>
        <button class="admin-reference-secondary" type="button" data-remove-selected-courses>← 移除</button>
      </div>
      <section class="admin-reference-picker admin-reference-course-picker">
        <h3>选择课程</h3>
        <div class="admin-reference-picker-toolbar">
          <label class="admin-reference-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <input class="admin-reference-field" type="search" placeholder="搜索课程名称 / 科目" data-assignment-course-search>
          </label>
        </div>
        <div class="admin-reference-picker-list" data-assignment-course-list></div>
      </section>
      <section class="admin-reference-picker">
        <h3>已分配课程</h3>
        <div class="admin-reference-selected-list" data-assignment-selected-list></div>
      </section>
    </div>
    <footer class="admin-reference-assignment-footer">
      <button class="admin-reference-secondary" type="button" data-reset-assignment>取消</button>
      <button class="admin-reference-primary" type="button" data-save-enrollment>保存配置</button>
      <span class="admin-reference-form-status" data-save-status aria-live="polite"></span>
    </footer>`;

  root.assignmentController?.abort();
  const controller = new AbortController();
  root.assignmentController = controller;
  const eventOptions = { signal: controller.signal };
  const studentList = root.querySelector("[data-assignment-student-list]");
  const courseList = root.querySelector("[data-assignment-course-list]");
  const selectedList = root.querySelector("[data-assignment-selected-list]");
  const studentSearch = root.querySelector("[data-assignment-student-search]");
  const courseSearch = root.querySelector("[data-assignment-course-search]");
  const saveStatus = root.querySelector("[data-save-status]");
  const sortedStudents = [...students].sort((a, b) =>
    (Number(b.id) || 0) - (Number(a.id) || 0)
  );
  const courseById = new Map(
    courses.map((course) => [Number(course.id), course]),
  );
  const requestedStudentId = Number(
    new URL(window.location.href).searchParams.get("student"),
  );
  let currentStudent = sortedStudents.find((student) =>
    Number(student.id) === requestedStudentId
  ) || sortedStudents[0];
  let draftCourseIds = new Set(
    (currentStudent.course_ids || []).map(Number),
  );
  let pendingCourseIds = new Set();

  const setStatus = (message = "", state = "") => {
    if (!saveStatus) return;
    saveStatus.textContent = message;
    saveStatus.className =
      `admin-reference-form-status${
        state ? ` is-${state}` : ""
      }`;
  };
  const studentSearchValue = () =>
    String(studentSearch?.value || "").trim().toLowerCase();
  const courseSearchValue = () =>
    String(courseSearch?.value || "").trim().toLowerCase();

  const renderStudentPicker = () => {
    const query = studentSearchValue();
    const visible = sortedStudents.filter((student) => {
      const text = `${student.full_name || ""} ${
        student.username || ""
      } ${student.stage || ""} ${student.grade || ""}`
        .toLowerCase();
      return !query || text.includes(query);
    });
    studentList.innerHTML = `
      <div class="admin-reference-picker-head"><span></span><span>学生信息</span><span>年级</span></div>
      ${
        visible.length
          ? visible.map((student) => {
            const name = student.full_name || student.username || "学生";
            const isSelected = Number(student.id) === Number(currentStudent.id);
            return `
              <label class="admin-reference-picker-row ${
                isSelected ? "is-selected" : ""
              }" data-assignment-student-row>
                <input type="radio" name="assignment-student" value="${
                  student.id
                }" ${isSelected ? "checked" : ""}>
                <span class="admin-reference-picker-copy"><strong>${
                  escapeHtml(name)
                }</strong><small>${
                  escapeHtml(student.username || "")
                }</small></span>
                <span>${
                  escapeHtml(
                    [student.stage, student.grade].filter(Boolean).join(" · ") ||
                      "未填写",
                  )
                }</span>
              </label>`;
          }).join("")
          : '<p class="admin-reference-empty">没有匹配的学生</p>'
      }`;
  };

  const renderCoursePicker = () => {
    const query = courseSearchValue();
    const visible = courses.filter((course) => {
      const text = `${course.title || ""} ${
        course.subject || ""
      } ${course.stage || ""} ${course.grade || ""}`
        .toLowerCase();
      return !query || text.includes(query);
    });
    courseList.innerHTML = `
      <div class="admin-reference-picker-head"><span></span><span>课程信息</span><span>课程类型</span></div>
      ${
        visible.length
          ? visible.map((course) => `
            <label class="admin-reference-picker-row">
              <input type="checkbox" data-assignment-course-id="${
                course.id
              }" ${
                pendingCourseIds.has(Number(course.id)) ? "checked" : ""
              }>
              <span class="admin-reference-picker-copy"><strong>${
                escapeHtml(cleanCourseDisplayTitle(course.title) || course.title)
              }</strong><small>${
                escapeHtml(
                  [course.stage, course.grade].filter(Boolean).join(" · "),
                )
              }</small></span>
              <span>${escapeHtml(course.subject || "课程")}</span>
            </label>`).join("")
          : '<p class="admin-reference-empty">没有匹配的课程</p>'
      }`;
  };

  const renderSelectedCourses = () => {
    const selectedCourses = [...draftCourseIds]
      .map((courseId) => courseById.get(Number(courseId)))
      .filter(Boolean);
    selectedList.innerHTML = `
      <div class="admin-reference-selected-head"><span>已分配课程（${
        selectedCourses.length
      } 门）</span><button class="admin-table-action" type="button" data-clear-draft>清空</button></div>
      ${
        selectedCourses.length
          ? selectedCourses.map((course, index) => `
            <div class="admin-reference-selected-row">
              <span class="admin-reference-course-mark ${
                index % 3 === 1 ? "is-green" : index % 3 === 2 ? "is-orange" : ""
              }" aria-hidden="true">课</span>
              <span class="admin-reference-picker-copy"><strong>${
                escapeHtml(cleanCourseDisplayTitle(course.title) || course.title)
              }</strong><small>${
                escapeHtml(
                  [course.stage, course.grade, course.subject].filter(Boolean)
                    .join(" · "),
                )
              }</small></span>
              <button class="admin-reference-icon-button" type="button" data-remove-draft-course="${
                course.id
              }" aria-label="移除 ${
                escapeHtml(course.title || "课程")
              }">×</button>
            </div>`).join("")
          : '<p class="admin-reference-empty">当前学生尚未分配课程</p>'
      }`;
  };

  const selectStudent = (studentId, updateUrl = true) => {
    const nextStudent = sortedStudents.find((student) =>
      Number(student.id) === Number(studentId)
    );
    if (!nextStudent) return;
    currentStudent = nextStudent;
    draftCourseIds = new Set((nextStudent.course_ids || []).map(Number));
    pendingCourseIds = new Set();
    setStatus();
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("student", String(nextStudent.id));
      history.replaceState(
        history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    renderStudentPicker();
    renderCoursePicker();
    renderSelectedCourses();
  };

  studentSearch?.addEventListener("input", renderStudentPicker, eventOptions);
  courseSearch?.addEventListener("input", renderCoursePicker, eventOptions);
  root.addEventListener("change", (event) => {
    const studentInput = event.target.closest(
      'input[name="assignment-student"]',
    );
    if (studentInput) {
      selectStudent(studentInput.value);
      return;
    }
    const courseInput = event.target.closest("[data-assignment-course-id]");
    if (!courseInput) return;
    const courseId = Number(courseInput.dataset.assignmentCourseId);
    if (courseInput.checked) pendingCourseIds.add(courseId);
    else pendingCourseIds.delete(courseId);
  }, eventOptions);
  root.addEventListener("click", async (event) => {
    const addButton = event.target.closest("[data-add-selected-courses]");
    if (addButton) {
      pendingCourseIds.forEach((courseId) => draftCourseIds.add(courseId));
      renderSelectedCourses();
      setStatus("课程选择已更新，点击“保存配置”后生效");
      return;
    }
    const removeButton = event.target.closest("[data-remove-selected-courses]");
    if (removeButton) {
      pendingCourseIds.forEach((courseId) => draftCourseIds.delete(courseId));
      renderSelectedCourses();
      setStatus("课程选择已更新，点击“保存配置”后生效");
      return;
    }
    const removeCourseButton = event.target.closest(
      "[data-remove-draft-course]",
    );
    if (removeCourseButton) {
      draftCourseIds.delete(
        Number(removeCourseButton.dataset.removeDraftCourse),
      );
      renderSelectedCourses();
      setStatus("课程选择已更新，点击“保存配置”后生效");
      return;
    }
    if (event.target.closest("[data-clear-draft]")) {
      draftCourseIds.clear();
      renderSelectedCourses();
      setStatus("已清空草稿，点击“保存配置”后生效");
      return;
    }
    if (event.target.closest("[data-reset-assignment]")) {
      draftCourseIds = new Set((currentStudent.course_ids || []).map(Number));
      pendingCourseIds = new Set();
      renderCoursePicker();
      renderSelectedCourses();
      setStatus("已恢复上次保存的配置");
      return;
    }
    const saveButton = event.target.closest("[data-save-enrollment]");
    if (!saveButton) return;
    const courseIds = [...draftCourseIds].sort((a, b) => a - b);
    const buttonLabel = saveButton.textContent || "保存配置";
    saveButton.disabled = true;
    saveButton.textContent = "正在保存...";
    setStatus("正在保存当前学生的课程配置...", "saving-text");
    try {
      await apiFetch("/api/admin/enrollments", {
        method: "POST",
        body: JSON.stringify({
          student_id: Number(currentStudent.id),
          course_ids: courseIds,
        }),
      });
      currentStudent.course_ids = courseIds;
      window.dispatchEvent(new CustomEvent("admin-data-updated"));
      setStatus(
        `配置已保存，共 ${courseIds.length} 门课程`,
        "success",
      );
      showAdminNotice(
        `${
          currentStudent.full_name || currentStudent.username
        } 的课程配置已保存`,
      );
    } catch (error) {
      setStatus(`保存失败：${error.message}`, "error");
      showAdminNotice(`课程配置保存失败：${error.message}`, "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = buttonLabel;
    }
  }, eventOptions);
  window.addEventListener("teacher-management-view-changed", (event) => {
    if (event.detail?.view !== "enrollments") return;
    const studentId = Number(
      new URL(window.location.href).searchParams.get("student"),
    );
    if (studentId && Number(currentStudent.id) !== studentId) {
      selectStudent(studentId, false);
    }
  }, eventOptions);
  window.addEventListener("admin-data-updated", () => {
    renderAdminDataViews(students, teachers, courses);
  }, eventOptions);

  selectStudent(currentStudent.id, false);
}

function renderFocusedGrowth(data, recordsUrl = "/api/growth/records") {
  const recordCount = Number(data.record_count || 0);
  if (!data.has_teacher_records || !recordCount) {
    return `
      <section class="growth-empty-report">
        <p class="growth-report-kicker">成长规划</p>
        <h2>等待教师课后记录</h2>
        <p>教师完成辅导记录后，系统会自动生成一份简洁、固定的 AI 成长规划。</p>
      </section>`;
  }
  if (data.ai_pending || data.analysis_status === "pending") {
    return `
      <section class="growth-empty-report growth-analysis-buffer" data-growth-record-count="${recordCount}" aria-live="polite">
        <div class="page-transition-mark"></div>
        <strong>AI 分析中...</strong>
        <span>教师已保存 ${recordCount} 次课后记录，分析完成后会自动固化到成长轨迹。</span>
      </section>`;
  }
  return `
    <section class="growth-focus-report">
      <header class="growth-report-hero">
        <div>
          <p class="growth-report-kicker">AI 成长规划${data.ai_model ? ` · ${escapeHtml(data.ai_model)}` : ""}</p>
          <h2>${escapeHtml(data.headline || "成长规划")}</h2>
          <p>${escapeHtml(data.summary || "")}</p>
        </div>
        <span class="growth-report-date">${escapeHtml(data.ai_updated_at || "")}</span>
      </header>
      <div class="growth-focus-columns">
        <section>
          <h3>做得好的地方</h3>
          <ul>${
    (data.strengths || []).map((item) => `<li>${escapeHtml(item)}</li>`).join(
      "",
    )
  }</ul>
        </section>
        <section>
          <h3>重点改进</h3>
          <ul>${
    (data.improvements || []).map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("")
  }</ul>
        </section>
      </div>
      <section class="growth-next-plan">
        <h3>下一步计划</h3>
        <ol>${
    (data.next_steps || []).map((item) => `<li>${escapeHtml(item)}</li>`).join(
      "",
    )
  }</ol>
      </section>
      <details class="growth-record-disclosure" data-growth-records data-growth-record-count="${recordCount}" data-records-url="${escapeHtml(recordsUrl)}">
        <summary><span>查看课后记录</span><small>${recordCount} 次</small></summary>
        <div class="growth-record-timeline" data-growth-record-list></div>
      </details>
    </section>`;
}

function wireGrowthRecordDisclosure(root) {
  root?.querySelectorAll("[data-growth-records]").forEach((details) => {
    if (details.dataset.bound === "1") return;
    details.dataset.bound = "1";
    details.addEventListener("toggle", async () => {
      if (
        !details.open || details.dataset.loaded === "1" ||
        details.dataset.loading === "1"
      ) return;
      const list = details.querySelector("[data-growth-record-list]");
      const recordsUrl = details.dataset.recordsUrl;
      if (!list || !recordsUrl) return;
      details.dataset.loading = "1";
      list.innerHTML = '<p class="growth-record-loading">正在读取已保存的课后记录...</p>';
      try {
        const result = await apiFetch(recordsUrl, { cacheTtlMs: 0 });
        const records = result.data?.records || [];
        list.innerHTML = records.length
          ? records.map((record) => `
            <article>
              <div class="growth-record-meta"><strong>${escapeHtml(record.title || "课后辅导")}</strong><span>${escapeHtml(record.created_at || "")}</span></div>
              <p>${escapeHtml(record.notes || "")}</p>
              <small>${escapeHtml(record.teacher_name || "教师")}</small>
            </article>`).join("")
          : '<p class="growth-record-loading">暂无课后记录</p>';
        details.dataset.loaded = "1";
      } catch (error) {
        list.innerHTML = `<p class="growth-record-loading">${escapeHtml(error.message)}</p>`;
      } finally {
        delete details.dataset.loading;
      }
    });
  });
}

async function initGrowthPage() {
  setPageLoading(true, "AI 分析中...");
  const user = await requireSession();
  if (!user) {
    setPageLoading(false);
    return;
  }
  if (redirectTeacherToPortal(user)) return;
  setUserProfile(user);
  wireLogoutButton();

  let result;
  try {
    result = await apiFetch("/api/growth", {
      cacheTtlMs: 60 * 1000,
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

  root.innerHTML = renderFocusedGrowth(data);
  wireGrowthRecordDisclosure(root);
  setPageLoading(false);
  if (data.ai_pending || data.analysis_status === "pending") {
    let attempts = 0;
    const intervalId = window.setInterval(async () => {
      attempts += 1;
      try {
        const refreshed = await apiFetch("/api/growth", { cacheTtlMs: 0 });
        const nextData = refreshed.data || {};
        if (!nextData.ai_pending && nextData.analysis_status !== "pending") {
          window.clearInterval(intervalId);
          writeApiCache(
            `${API_PREFETCH_CACHE_PREFIX}/api/growth`,
            refreshed,
          );
          root.innerHTML = renderFocusedGrowth(nextData);
          wireGrowthRecordDisclosure(root);
          return;
        }
      } catch (error) {
        console.warn(error);
      }
      if (attempts >= 20) {
        window.clearInterval(intervalId);
        const status = root.querySelector(".growth-analysis-buffer span");
        if (status) status.textContent = "分析仍在后台进行，可稍后回来查看。";
      }
    }, 3000);
    window.addEventListener(
      "pagehide",
      () => window.clearInterval(intervalId),
      { once: true },
    );
  }
}
