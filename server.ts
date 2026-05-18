﻿﻿﻿import { getCookies, setCookie } from "https://deno.land/std@0.224.0/http/cookie.ts";

const kv = await Deno.openKv(Deno.env.get("DENO_KV_PATH") || undefined); // Support local or Deno Deploy KV

async function getHtml(filename: string) {
  const content = await Deno.readTextFile(new URL(`./${filename}`, import.meta.url));
  return content;
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}

// Load static questions into memory safely for Deno Deploy
let questionsData = { questions: [] };
try {
  const questionsText = await Deno.readTextFile(new URL('./data/questions.json', import.meta.url));
  questionsData = JSON.parse(questionsText);
} catch (e) {
  console.warn("Could not load questions.json, proceeding with empty data.");
}

Deno.serve({ port: 8000 }, async (request) => {
  const url = new URL(request.url);
  const cookies = getCookies(request.headers);
  const sessionId = cookies.sessionId;
  
  let currentUserId: string | null = null;
  if (sessionId) {
    const sessionRecord = await kv.get(['sessions', sessionId]);
    if (sessionRecord.value) {
      currentUserId = sessionRecord.value as string;
    }
  }

  // --- Static Assets ---
  if (url.pathname === '/assets/style.css') {
    try {
      const content = await Deno.readTextFile(new URL('./assets/style.css', import.meta.url));
      return new Response(content, {
        headers: {
          'content-type': 'text/css; charset=utf-8',
          'cache-control': 'public, max-age=31536000',
        },
      });
    } catch (err) {
      return new Response('Not Found', { status: 404 });
    }
  }

  // --- API Routes ---
  if (url.pathname === '/api/health') {
    return json({ ok: true, service: 'ai-learning-page' });
  }

  if (url.pathname === '/api/login' && request.method === 'POST') {
    const form = await request.formData();
    const username = form.get('username')?.toString().trim();
    const password = form.get('password')?.toString().trim();
    
    // Simulate real auth validation (Only allow specific test accounts)
    const validStudents: Record<string, string> = {
      "Cary": "123456",
      "Alice": "123456",
      "Bob": "123456"
    };

    if (!username || !password || validStudents[username] !== password) {
      // Redirect back to login with error parameter
      return new Response('', { status: 302, headers: { 'Location': '/login?error=1' } });
    }

    // Auto-provision user for prototyping
    const userRecord = await kv.get(['users', username]);
    if (!userRecord.value) {
      await kv.set(['users', username], { username, level: 12, nickname: username });
    }

    // Create session
    const newSessionId = crypto.randomUUID();
    await kv.set(['sessions', newSessionId], username);

    const headers = new Headers();
    setCookie(headers, {
      name: "sessionId",
      value: newSessionId,
      path: "/",
      httpOnly: true,
      maxAge: 86400 * 7
    });
    headers.set('Location', '/dashboard');

    return new Response('', { status: 302, headers });
  }

  if (url.pathname === '/api/logout') {
    if (sessionId) {
      await kv.delete(['sessions', sessionId]);
    }
    const headers = new Headers();
    setCookie(headers, { name: "sessionId", value: "", path: "/", maxAge: 0 });
    headers.set('Location', '/login');
    return new Response('', { status: 302, headers });
  }

  if (url.pathname === '/api/me') {
    if (!currentUserId) return json({ error: 'Unauthorized' }, { status: 401 });
    const userRecord = await kv.get(['users', currentUserId]);
    return json(userRecord.value);
  }

  if (url.pathname === '/api/questions') {
    // Read-only static questions
    return json(questionsData.questions);
  }

  if (url.pathname === '/api/progress' && currentUserId) {
    // Dynamic user data
    const progressList = [];
    for await (const entry of kv.list({ prefix: ['progress', currentUserId] })) {
      progressList.push(entry.value);
    }
    const mistakeList = [];
    for await (const entry of kv.list({ prefix: ['mistakes', currentUserId] })) {
      mistakeList.push(entry.value);
    }
    return json({ progress: progressList, mistakes: mistakeList });
  }

  if (url.pathname === '/api/submit_answer' && request.method === 'POST' && currentUserId) {
    const { questionId, isCorrect } = await request.json();
    
    // Update progress
    await kv.set(['progress', currentUserId, questionId], {
      questionId,
      isCorrect,
      timestamp: Date.now()
    });

    // Update mistake book
    if (!isCorrect) {
      const mistakeRec = await kv.get(['mistakes', currentUserId, questionId]);
      const count = mistakeRec.value ? (mistakeRec.value as any).count + 1 : 1;
      await kv.set(['mistakes', currentUserId, questionId], {
        questionId,
        count,
        lastFailedAt: Date.now()
      });
    }

    return json({ ok: true });
  }

  // --- HTML Routes ---
  const routes: Record<string, string> = {
    '/': 'dashboard.html',
    '/login': 'login.html',
    '/dashboard': 'dashboard.html',
    '/subjects': 'subjects.html',
    '/course': 'course.html',
    '/mistakes': 'mistakes.html',
    '/growth': 'growth.html',
  };

  const targetFile = routes[url.pathname];

  if (targetFile) {
    // Protect routes
    if (targetFile !== 'login.html' && !currentUserId) {
      return new Response('', { status: 302, headers: { 'Location': '/login' } });
    }
    // Redirect logged-in users away from login
    if (targetFile === 'login.html' && currentUserId) {
      return new Response('', { status: 302, headers: { 'Location': '/dashboard' } });
    }

    try {
      const content = await getHtml(targetFile);
      return new Response(content, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    } catch (err) {
      console.error(err);
      return new Response('Internal Server Error or File Not Found', { status: 500 });
    }
  }

  return new Response('Not Found', { status: 404 });
});
